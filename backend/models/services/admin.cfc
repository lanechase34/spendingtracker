component singleton accessors="true" {

    property name="cacheStorage"     inject="cachebox:coldboxStorage";
    property name="rateCacheStorage" inject="cachebox:rateStorage";
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
     * Return detailed information about the current cache state
     * Includes list of all keys stored in cache
     */
    public struct function getCacheData() {
        var stats    = cacheStorage.getStats();
        var allKeys  = cacheStorage.getKeys();
        var data     = cacheStorage.getCachedObjectMetadataMulti(allKeys.toList(','));
        var rateData = rateCacheStorage.getCachedObjectMetadataMulti(rateCacheStorage.getKeys().toList(','));

        var info = {
            lastReapDateTime  : stats.getLastReapDateTime(),
            hits              : stats.getHits(),
            misses            : stats.getMisses(),
            evictionCount     : stats.getEvictionCount(),
            garbageCollections: stats.getGarbageCollections(),
            maxObjects        : cacheStorage.getConfiguration().maxObjects,
            data              : formatCacheData(data).append(formatCacheData(rateData), true)
        };

        return info;
    }

    private array function formatCacheData(required struct data) {
        return data.reduce((result, key, value) => {
            return result.append({
                id               : key,
                key              : key,
                created          : dateTimeFormat(value.created, 'long'),
                hits             : value.hits,
                expired          : value.isExpired,
                lastaccessed     : dateTimeFormat(value.lastAccessed, 'long'),
                lastaccesstimeout: value.lastAccessTimeout,
                timeout          : value.timeout
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

}
