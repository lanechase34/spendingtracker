component extends="coldbox.system.Interceptor" {

    property name="async"       inject="asyncManager@coldbox";
    property name="concurrency" inject="coldbox:setting:concurrency";
    property name="environment" inject="coldbox:setting:environment";
    property name="uploadPath"  inject="coldbox:setting:uploadPath";
    property name="queryLogPath" type="string";

    function configure() {
        this.queryLogPath = environment == 'development' ? '#getDirectoryFromPath(getCurrentTemplatePath())#/../../../stuploads/q.html' : '';
    }

    /**
     * Runs after Coldbox configuration loads - similar to onApplicationStart
     * Will verify dependencies on prod
     */
    function afterAspectsLoad(event, data, buffer, rc, prc) {
        if(!directoryExists(uploadPath)) {
            directoryCreate(uploadPath);
        }

        if(environment == 'production' && !getInstance('services.image').verifyImageMagick()) {
            throw('Imagemagick is not running');
        }

        if(environment == 'production' && !getInstance('services.email').verifyConnection()) {
            throw('Cannot connect to email server');
        }

        if(environment == 'development' && fileExists(this.queryLogPath)) {
            try {
                fileDelete(this.queryLogPath);
            }
            catch(any e) {
            }
        }
    }

    /**
     * Track number of active requests
     */
    function preProcess(event, data, buffer, rc, prc) {
        lock name="concurrencyLock" timeout="5" type="exclusive" throwOnTimeout=false {
            concurrency.activeRequests += 1;
            concurrency.maxRequests = max(concurrency.maxRequests, concurrency.activeRequests);
        }
    }

    /**
     * Log QB results for debugging in development
     */
    function postQBExecute(event, data, buffer, rc, prc, interceptData) {
        if(
            environment == 'development'
            && getSetting('logQueries')
        ) {
            async.newFuture(() => {
                writeDump(
                    var    = {sql: interceptData?.sql ?: '', result: interceptData?.result ?: ''},
                    format = 'html',
                    output = this.queryLogPath
                );
            });
        }
    }

}
