component singleton accessors="true" {

    property name="adminLog"         inject="logbox:logger:Admin";
    property name="cacheStorage"     inject="cachebox:coldboxStorage";
    property name="logPath"          inject="coldbox:setting:logPath";
    property name="rateCacheStorage" inject="cachebox:rateStorage";
    property name="wsCacheStorage"   inject="cachebox:wsStorage";
    property name="concurrency"      inject="coldbox:setting:concurrency";
    property name="schedulerService" inject="coldbox:schedulerService";

    /**
     * Return struct containing server metric information
     */
    public struct function getMetrics() {
        // JVM Memory
        var runtime  = createObject('java', 'java.lang.Runtime').getRuntime();
        var totalMem = runtime.totalMemory();
        var freeMem  = runtime.freeMemory();
        var maxMem   = runtime.maxMemory();
        var usedMem  = totalMem - freeMem;

        // Active threads
        var threadCount = createObject('java', 'java.lang.Thread').activeCount();

        // CPU
        var osBean         = createObject('java', 'java.lang.management.ManagementFactory').getOperatingSystemMXBean();
        var systemCpuLoad  = '';
        var processCpuLoad = '';
        try {
            systemCpuLoad  = osBean.getSystemCpuLoad() * 100;
            processCpuLoad = osBean.getProcessCpuLoad() * 100;
        }
        catch(any e) {
            adminLog.error('Error retrieving system cpu stats.');
        }

        // Garbage collection
        var gcBeans = createObject('java', 'java.lang.management.ManagementFactory').getGarbageCollectorMXBeans();
        var gcTime  = gcBeans.reduce((prev, b) => {
            return prev + b.getCollectionTime()
        }, 0);
        var gcDelta = gcTime - application.cbController.getSetting('gcTime');
        application.cbController.setSetting('gcTime', gcTime);

        var metrics = {
            timestamp: now(),
            uptimeMs : getTickCount(),
            memory   : {
                usedMB : round(usedMem / 1024 / 1024),
                totalMB: round(totalMem / 1024 / 1024),
                maxMB  : round(maxMem / 1024 / 1024)
            },
            threads: {active: threadCount},
            cpu    : {
                systemPercent : normalizeCPU(systemCpuLoad),
                processPercent: normalizeCPU(processCpuLoad),
                cores         : osBean.getAvailableProcessors()
            },
            gc         : {totalMs: gcTime, deltaMs: gcDelta},
            concurrency: {
                activeRequests: concurrency.activeRequests,
                maxRequests   : concurrency.maxRequests,
                slowRequests  : concurrency.slowRequests
            }
        };

        return metrics;
    }

    /**
     * Reset the active requests count
     */
    public void function resetActiveRequests() {
        lock name="concurrencyLock" timeout="5" type="exclusive" throwOnTimeout=false {
            concurrency.activeRequests = 0;
        }
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
     * Returns detailed information the current cache state
     * Includes list of all keys stored in coldbox, rate, and ws caches
     */
    public struct function getCacheData() {
        var stats = cacheStorage.getStats();

        var cacheData = formatCacheData(cacheStorage, 'cache');
        var rateData  = formatCacheData(rateCacheStorage, 'rate');
        var wsData    = formatCacheData(wsCacheStorage, 'ws');

        var data = cacheData.append(rateData, true).append(wsData, true);

        var info = {
            lastReapDateTime  : stats.getLastReapDateTime(),
            hits              : stats.getHits(),
            misses            : stats.getMisses(),
            evictionCount     : stats.getEvictionCount(),
            garbageCollections: stats.getGarbageCollections(),
            maxObjects        : cacheStorage.getConfiguration().maxObjects,
            data              : data
        };

        return info;
    }

    /**
     * Format the data stored in the cached passed in
     * Returns an array of structs
     *
     * @cacheInstance cache instance
     * @name          what the cache is called
     */
    private array function formatCacheData(required component cacheInstance, required string name) {
        var data = cacheInstance.getCachedObjectMetadataMulti(cacheInstance.getKeys().toList(','));

        return data.reduce((result, key, value) => {
            return result.append({
                id               : key,
                key              : key,
                created          : dateTimeFormat(value.created, 'long'),
                hits             : value.hits,
                expired          : value.isExpired,
                lastaccessed     : dateTimeFormat(value.lastAccessed, 'long'),
                lastaccesstimeout: value.lastAccessTimeout,
                timeout          : value.timeout,
                storage          : name
            });
        }, []);
    }

    /**
     * Get Coldbox task info
     */
    public array function getTaskData() {
        var tasks = [];

        schedulerService
            .getSchedulers()
            .each((key, scheduler) => {
                var executorName = scheduler
                    .getExecutor()
                    .getName()
                    .reReplace(
                        'coldbox\.system\.web\.tasks.|-scheduler',
                        '',
                        'all'
                    );
                var moduleName = key == 'appScheduler@coldbox' ? 'global' : key.replace('cbScheduler@', '');

                scheduler
                    .getRegisteredTasks()
                    .each((taskName) => {
                        var task  = scheduler.getTaskRecord(taskName);
                        var stats = task.task.getStats();

                        tasks.append({
                            name             : taskName,
                            created          : dateTimeFormat(stats.created, 'long'),
                            executor         : executorName,
                            module           : moduleName,
                            lastRun          : dateTimeFormat(stats.lastRun, 'long'),
                            nextRun          : dateTimeFormat(stats.nextRun, 'long'),
                            totalFailures    : stats.totalFailures,
                            totalSuccess     : stats.totalSuccess,
                            totalRuns        : stats.totalRuns,
                            lastExecutionTime: stats.lastExecutionTime,
                            error            : task.error,
                            errorMessage     : task.errorMessage,
                            scheduled        : task.task.getScheduled()
                        });
                    });
            });

        return tasks;
    }

    /**
     * Returns a query of all discoverable log files across
     * CommandBox and Lucee runtimes, ordered by last modified desc.
     */
    public query function getLogs() {
        // Commandbox Logs
        var cbLogs = directoryList(
            path    : '#logPath#/../logs',
            recurse : false,
            listInfo: 'query',
            filter  : '*.log|*.txt',
            sort    : ''
        );

        // Lucee Logs
        var luceeServerLogs = directoryList(
            path    : '#logPath#/lucee-server/context/logs',
            recurse : false,
            listInfo: 'query',
            filter  : '*.log',
            sort    : ''
        );

        return queryExecute(
            '
            select name, size, type, dateLastModified, directory
            from cbLogs
            where type = :type
            union
            select name, size, type, dateLastModified, directory
            from luceeServerLogs
            where type = :type
            order by dateLastModified desc
        ',
            {type: {value: 'File', cfsqltype: 'varchar'}},
            {dbtype: 'query'}
        );
    }

    /**
     * Reads the tail of a validated log file, with optional line filtering.
     * Derives the directory by matching the filename against discovered logs.
     *
     * @filename name of the log file
     * @lines    number of lines to tail
     * @search   optional string to filter lines by
     */
    public struct function readLog(
        required string  filename,
        numeric          lines  = 200,
        string           search = ''
    ) {
        // Derive directory from discovered logs by matching filename
        var logs  = getLogs();
        var match = logs.filter((row) => {
            return row.name == filename;
        });

        if(!match.recordCount) {
            throw(type = 'LogViewer.FileNotFound', message = 'Log file not found in available logs: #filename#');
        }

        var fullPath = match.directory[1] & '/' & filename;

        // Final safety check on the resolved path
        if(!fileExists(fullPath)) {
            throw(type = 'LogViewer.FileNotFound', message = 'Log file could not be found on disk: #fullPath#');
        }

        var readLines = tailFile(fullPath, lines, lCase(search));

        return {
            'filename': filename,
            'lines'   : readLines,
            'count'   : readLines.len(),
            'filtered': search.len() > 0
        };
    }

    /**
     * Streams a file line by line, keeping only the last N matching lines
     * in a bounded deque to avoid loading large files into memory.
     *
     * @path     absolute path to log file
     * @maxLines maximum lines to return
     * @search   lowercase search term, empty string means no filter
     */
    private array function tailFile(
        required string  path,
        required numeric maxLines,
        string           search = ''
    ) {
        var result = [];
        var buffer = createObject('java', 'java.util.ArrayDeque');
        var reader = createObject('java', 'java.io.BufferedReader').init(
            createObject('java', 'java.io.FileReader').init(path)
        );

        try {
            var line = reader.readLine();

            while(!isNull(line)) {
                if(!search.len() || lCase(line).find(search)) {
                    buffer.addLast(line);
                    if(buffer.size() > maxLines) {
                        buffer.removeFirst();
                    }
                }
                line = reader.readLine();
            }
        }
        finally {
            reader.close();
        }

        var iter = buffer.iterator();
        while(iter.hasNext()) {
            result.append(iter.next());
        }

        return result;
    }

}
