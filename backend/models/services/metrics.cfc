component singleton accessors="true" hint="Collects live metrics and diagnostics for the admin dashboard" {

    property name="appName"     inject="coldbox:setting:appName";
    property name="basePath"    inject="coldbox:setting:basePath";
    property name="concurrency" inject="coldbox:setting:concurrency";
    property name="environment" inject="coldbox:setting:environment";
    property name="adminLog"    inject="logbox:logger:Admin";
    property name="logPath"     inject="coldbox:setting:logPath";
    property name="settings"    inject="coldbox:setting:metrics";
    property name="uploadPath"  inject="coldbox:setting:uploadPath";

    // Cached diagnostics snapshot - {data, tick}
    variables.diagnosticsCache = {};

    /**
     * Counters are java atomics so hot paths (every query, every blocked request)
     * Window counters are reset by the metrics scheduler task, totals live for the life of the app
     */
    function onDIComplete() {
        var AtomicLong = createObject("java", "java.util.concurrent.atomic.AtomicLong");

        variables.queries = {
            count  : AtomicLong.init(0),
            errors : AtomicLong.init(0),
            totalMs: AtomicLong.init(0),
            maxMs  : AtomicLong.init(0),
            total  : AtomicLong.init(0),
            peak   : AtomicLong.init(0)
        };
        variables.slowQueries = [];

        variables.rateLimit = {
            blocked: AtomicLong.init(0),
            total  : AtomicLong.init(0),
            byEvent: createObject("java", "java.util.concurrent.ConcurrentHashMap").init()
        };

        // Last gc total and when it was read - only advanced by markWindow
        variables.gcMark = {totalMs: -1, tick: getTickCount()};
    }

    /**
     * Return struct containing live server metric information
     */
    public struct function getMetrics() {
        var mf = createObject("java", "java.lang.management.ManagementFactory");

        // JVM Memory
        var runtime  = createObject("java", "java.lang.Runtime").getRuntime();
        var totalMem = runtime.totalMemory();
        var freeMem  = runtime.freeMemory();
        var maxMem   = runtime.maxMemory();
        var usedMem  = totalMem - freeMem;

        // Threads - ThreadMXBean sees every JVM thread
        var threadBean = mf.getThreadMXBean();
        var deadlocked = threadBean.findDeadlockedThreads();

        // CPU
        var osBean         = mf.getOperatingSystemMXBean();
        var systemCpuLoad  = "";
        var processCpuLoad = "";
        try {
            try {
                systemCpuLoad = osBean.getCpuLoad() * 100;
            }
            catch(any e) {
                systemCpuLoad = osBean.getSystemCpuLoad() * 100;
            }
            processCpuLoad = osBean.getProcessCpuLoad() * 100;
        }
        catch(any e) {
            adminLog.error("Error retrieving system cpu stats.");
        }

        var runtimeBean = mf.getRuntimeMXBean();

        var metrics = {
            timestamp: now(),
            uptimeMs : runtimeBean.getUptime(),
            startedAt: runtimeBean.getStartTime(),
            memory   : {
                usedMB : round(usedMem / 1024 / 1024),
                totalMB: round(totalMem / 1024 / 1024),
                maxMB  : round(maxMem / 1024 / 1024)
            },
            threads: {
                live      : threadBean.getThreadCount(),
                peak      : threadBean.getPeakThreadCount(),
                daemon    : threadBean.getDaemonThreadCount(),
                deadlocked: isNull(deadlocked) ? 0 : arrayLen(deadlocked)
            },
            cpu: {
                systemPercent : normalizeCPU(systemCpuLoad),
                processPercent: normalizeCPU(processCpuLoad),
                cores         : osBean.getAvailableProcessors()
            },
            gc         : getGcStats(getGcTotalMs()),
            concurrency: {
                activeRequests: concurrency.activeRequests,
                maxRequests   : concurrency.maxRequests,
                slowRequests  : concurrency.slowRequests
            },
            queries  : getQueryStats(),
            database : getLiveDatabaseStats(),
            rateLimit: getRateLimitStats()
        };

        return metrics;
    }

    /**
     * Cumulative gc time across all collectors
     */
    private numeric function getGcTotalMs() {
        var gcBeans = createObject("java", "java.lang.management.ManagementFactory").getGarbageCollectorMXBeans();
        return gcBeans.reduce((prev, b) => {
            return prev + max(b.getCollectionTime(), 0);
        }, 0);
    }

    /**
     * Get database stats
     */
    private struct function getLiveDatabaseStats() {
        var stats = {
            up                 : false,
            pingMs             : javacast("null", ""),
            connections        : javacast("null", ""),
            longestQuerySeconds: 0
        };

        try {
            var start = getTickCount();
            queryExecute("select 1", {});
            stats.pingMs = getTickCount() - start;
            stats.up     = true;

            var activity = queryExecute(
                "
                select count(*)                                                         as total,
                       count(*) filter (where state = 'active')                       as active,
                       count(*) filter (where state = 'idle')                         as idle,
                       count(*) filter (where state like 'idle in transaction%')      as idleintransaction,
                       count(*) filter (where wait_event_type = 'Lock')               as waitingonlock,
                       coalesce(max(extract(epoch from now() - query_start))
                                filter (where state = 'active'), 0)                   as longestqueryseconds,
                       cast(current_setting('max_connections') as int)                as maxconnections
                from pg_stat_activity
                where datname = current_database()
                  and backend_type = 'client backend'
                  and pid <> pg_backend_pid()
            ",
                {}
            );

            stats.connections = {
                total            : val(activity.total),
                active           : val(activity.active),
                idle             : val(activity.idle),
                idleInTransaction: val(activity.idleintransaction),
                waitingOnLock    : val(activity.waitingonlock),
                max              : val(activity.maxconnections)
            };
            stats.longestQuerySeconds = round(activity.longestqueryseconds * 10) / 10;
        }
        catch(any e) {
            adminLog.error("Error retrieving live database stats: #e.message#");
        }

        return stats;
    }

    /**
     * Close the current window
     * Resets the active request count, query and rate limit window counters, and the gc mark
     *
     * @gcTotalMs current cumulative gc time across all collectors, read from the JVM when omitted
     */
    public void function markWindow(numeric gcTotalMs) {
        lock name="concurrencyLock" timeout="5" type="exclusive" throwOnTimeout=false {
            concurrency.activeRequests = 0;
        }

        var count = queries.count.getAndSet(0);
        setMax(queries.peak, count);
        queries.errors.set(0);
        queries.totalMs.set(0);
        queries.maxMs.set(0);

        rateLimit.blocked.set(0);

        variables.gcMark = {totalMs: arguments.gcTotalMs ?: getGcTotalMs(), tick: getTickCount()};
    }

    /**
     * Record an executed query
     *
     * @sql the executed sql
     * @ms  execution time in ms
     */
    public void function recordQuery(required string sql, required numeric ms) {
        queries.count.incrementAndGet();
        queries.total.incrementAndGet();
        queries.totalMs.addAndGet(javacast("long", ms));
        setMax(queries.maxMs, ms);

        if(ms >= settings.slowQueryThreshold) {
            var timestamp = now();

            lock name="slowQueriesLock" timeout="5" type="exclusive" throwOnTimeout=false {
                // Delete queries older than 24 hours
                var twentyFourHoursAgo = dateAdd("h", -24, timestamp);
                variables.slowQueries  = slowQueries.filter((q) => {
                    return q.time > twentyFourHoursAgo;
                });

                // Bindings are left out on purpose - they can contain user data
                slowQueries.append({
                    sql : left(reReplace(trim(sql), "\s+", " ", "all"), settings.sqlLength),
                    ms  : ms,
                    time: timestamp,
                    uuid: createUUID()
                });

                while(slowQueries.len() > settings.maxSlowQueries) {
                    slowQueries.shift();
                }
            }
        }
    }

    /**
     * Record a query that threw
     */
    public void function recordQueryError() {
        queries.errors.incrementAndGet();
    }

    /**
     * Record a request blocked by the rate limiter
     *
     * @event the handler.action that was blocked
     */
    public void function recordRateLimitBlock(required string event) {
        rateLimit.blocked.incrementAndGet();
        rateLimit.total.incrementAndGet();
        rateLimit.byEvent.putIfAbsent(event, createObject("java", "java.util.concurrent.atomic.AtomicLong").init(0));
        rateLimit.byEvent.get(event).incrementAndGet();
    }

    /**
     * Current window and lifetime query stats
     */
    public struct function getQueryStats() {
        var count = queries.count.get();

        return {
            count      : count,
            errors     : queries.errors.get(),
            avgMs      : count ? round(queries.totalMs.get() / count * 10) / 10 : 0,
            maxMs      : queries.maxMs.get(),
            peak       : max(queries.peak.get(), count),
            total      : queries.total.get(),
            slowQueries: duplicate(slowQueries)
        };
    }

    /**
     * Current window and lifetime rate limit stats
     */
    public struct function getRateLimitStats() {
        var byEvent = {};
        var iter    = rateLimit.byEvent.entrySet().iterator();
        while(iter.hasNext()) {
            var entry               = iter.next();
            byEvent[entry.getKey()] = entry.getValue().get();
        }

        return {
            blocked: rateLimit.blocked.get(),
            total  : rateLimit.total.get(),
            byEvent: byEvent
        };
    }

    /**
     * Garbage collection time since the last window mark
     *
     * @gcTotalMs current cumulative gc time across all collectors
     */
    public struct function getGcStats(required numeric gcTotalMs) {
        // First read since startup - nothing to compare against yet
        if(gcMark.totalMs < 0) {
            return {
                totalMs: gcTotalMs,
                deltaMs: 0,
                percent: 0
            };
        }

        var deltaMs   = max(gcTotalMs - gcMark.totalMs, 0);
        var elapsedMs = max(getTickCount() - gcMark.tick, 1);

        return {
            totalMs: gcTotalMs,
            deltaMs: deltaMs,
            percent: round(min(deltaMs / elapsedMs * 100, 100) * 10) / 10
        };
    }

    /**
     * App/runtime info, disk space and postgres internals
     * Cached for metrics.diagnosticsTTL seconds
     *
     * @force bypass the cache
     */
    public struct function getDiagnostics(boolean force = false) {
        var ttlMs = settings.diagnosticsTTL * 1000;

        if(!force && !diagnosticsCache.isEmpty() && getTickCount() - diagnosticsCache.tick < ttlMs) {
            return diagnosticsCache.data;
        }

        var data = {
            generatedAt: now(),
            app        : getAppInfo(),
            disk       : getDiskStats(),
            database   : getDatabaseDiagnostics()
        };

        variables.diagnosticsCache = {data: data, tick: getTickCount()};

        return data;
    }

    /**
     * Static application and runtime information
     */
    private struct function getAppInfo() {
        if(isNull(variables.appInfo)) {
            var version = "unknown";
            try {
                version = deserializeJSON(fileRead("#basePath#/box.json")).version;
            }
            catch(any e) {
                // Missing or unreadable box.json - report the version as unknown
            }

            var runtimeBean = createObject("java", "java.lang.management.ManagementFactory").getRuntimeMXBean();

            variables.appInfo = {
                name       : appName,
                version    : version,
                environment: environment,
                startedAt  : runtimeBean.getStartTime(),
                lucee      : server.lucee.version,
                java       : "#server.java.version# (#server.java.vendor#)",
                os         : "#server.os.name# #server.os.version# (#server.os.arch#)",
                timezone   : getTimezone()
            };
        }

        return variables.appInfo;
    }

    /**
     * Free space on the volumes the app writes to
     */
    private array function getDiskStats() {
        var paths = [
            {name: "Logs", path: logPath},
            {name: "Uploads", path: uploadPath}
        ];

        return paths.map((item) => {
            var file    = createObject("java", "java.io.File").init(item.path);
            var mb      = 1024 * 1024;
            var totalMB = round(file.getTotalSpace() / mb);
            var freeMB  = round(file.getUsableSpace() / mb);

            return {
                name       : item.name,
                path       : file.getCanonicalPath(),
                totalMB    : totalMB,
                freeMB     : freeMB,
                usedPercent: totalMB ? round((totalMB - freeMB) / totalMB * 1000) / 10 : 0
            };
        });
    }

    /**
     * Postgres internals - database size and counters, table health, top statements
     * Counters in pg_stat_database are cumulative since statsReset
     */
    private struct function getDatabaseDiagnostics() {
        var result = {
            available : false,
            version   : "",
            sizeMB    : 0,
            stats     : javacast("null", ""),
            tables    : [],
            statements: {
                available: false,
                message  : "",
                rows     : []
            }
        };

        try {
            var db = queryExecute(
                "
                select current_setting('server_version')     as version,
                       pg_database_size(current_database())  as sizebytes,
                       d.xact_commit, d.xact_rollback, d.blks_hit, d.blks_read,
                       d.deadlocks, d.temp_files, d.temp_bytes, d.conflicts, d.stats_reset
                from pg_stat_database d
                where d.datname = current_database()
            ",
                {}
            );

            var blocks = db.blks_hit + db.blks_read;

            result.available = true;
            result.version   = db.version;
            result.sizeMB    = round(db.sizebytes / 1024 / 1024 * 10) / 10;
            result.stats     = {
                commits      : val(db.xact_commit),
                rollbacks    : val(db.xact_rollback),
                cacheHitRatio: blocks ? round(db.blks_hit / blocks * 10000) / 100 : 100,
                deadlocks    : val(db.deadlocks),
                tempFiles    : val(db.temp_files),
                tempMB       : round(db.temp_bytes / 1024 / 1024 * 10) / 10,
                conflicts    : val(db.conflicts),
                statsReset   : nullIfEmpty(db.stats_reset)
            };

            var tables = queryExecute(
                "
                select relname                                  as name,
                       n_live_tup                               as liverows,
                       n_dead_tup                               as deadrows,
                       seq_scan                                 as seqscan,
                       coalesce(idx_scan, 0)                    as idxscan,
                       pg_total_relation_size(relid)            as sizebytes,
                       greatest(last_vacuum, last_autovacuum)   as lastvacuum,
                       greatest(last_analyze, last_autoanalyze) as lastanalyze
                from pg_stat_user_tables
                order by pg_total_relation_size(relid) desc
                limit 25
            ",
                {},
                {returntype: "array"}
            );

            result.tables = tables.map((row) => {
                return {
                    name       : row.name,
                    liveRows   : val(row.liverows),
                    deadRows   : val(row.deadrows),
                    seqScan    : val(row.seqscan),
                    idxScan    : val(row.idxscan),
                    sizeMB     : round(row.sizebytes / 1024 / 1024 * 100) / 100,
                    lastVacuum : nullIfEmpty(row.lastvacuum),
                    lastAnalyze: nullIfEmpty(row.lastanalyze)
                };
            });
        }
        catch(any e) {
            adminLog.error("Error retrieving database diagnostics: #e.message#");
            return result;
        }

        result.statements = getTopStatements();

        return result;
    }

    /**
     * Top statements by total execution time from pg_stat_statements
     */
    private struct function getTopStatements() {
        var statements = {
            available: false,
            message  : "",
            rows     : []
        };

        try {
            var top = queryExecute(
                "
                select query,
                       calls,
                       total_exec_time as totalms,
                       mean_exec_time  as meanms,
                       max_exec_time   as maxms,
                       rows
                from pg_stat_statements
                where dbid = (select oid from pg_database where datname = current_database())
                  and query not ilike '%pg_stat%'
                order by total_exec_time desc
                limit 15
            ",
                {},
                {returntype: "array"}
            );

            statements.available = true;
            statements.rows      = top.map((row) => {
                return {
                    query  : left(reReplace(trim(row.query), "\s+", " ", "all"), settings.sqlLength),
                    calls  : val(row.calls),
                    totalMs: round(row.totalms),
                    meanMs : round(row.meanms * 100) / 100,
                    maxMs  : round(row.maxms * 100) / 100,
                    rows   : val(row.rows)
                };
            });
        }
        catch(any e) {
            statements.message = e.message;
        }

        return statements;
    }

    /**
     * Empty strings from nullable columns become null for the json response
     */
    private any function nullIfEmpty(any value) {
        if(isNull(value) || (isSimpleValue(value) && !len(value))) {
            return javacast("null", "");
        }
        return value;
    }

    /**
     * Normalizes the CPU percentage
     */
    private number function normalizeCPU(any cpuVal) {
        if(!isNumeric(cpuVal)) return null;
        if(cpuVal < 0 || cpuVal > 100) return null;
        return round(cpuVal);
    }

    /**
     * Raise an AtomicLong to value if value is larger, without locking
     *
     * @atomic the AtomicLong to update
     * @value  candidate value
     */
    private void function setMax(required any atomic, required numeric value) {
        var newValue = javacast("long", value);
        var current  = atomic.get();
        while(newValue > current && !atomic.compareAndSet(current, newValue)) {
            current = atomic.get();
        }
    }

}
