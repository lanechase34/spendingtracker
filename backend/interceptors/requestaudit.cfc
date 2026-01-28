component extends="coldbox.system.Interceptor" {

    property name="async"           inject="asyncManager@coldbox";
    property name="auditService"    inject="services.audit";
    property name="concurrency"     inject="coldbox:setting:concurrency";
    property name="securityService" inject="services.security";

    // Audit Settings
    property name="AUDIT_SETTINGS" inject="coldbox:setting:audit";
    property name="LOG_REQUESTS"   inject="coldbox:setting:logRequests";

    property name="URLPATH_LENGTH" type="numeric";
    property name="METHOD_LENGTH"  type="numeric";
    property name="AGENT_LENGTH"   type="numeric";
    property name="DETAIL_LENGTH"  type="numeric";

    // Slow Request Settings
    property name="SLOW_REQUEST_THRESHOLD";
    property name="MAX_SLOW_REQUESTS";

    /**
     * Set configuration based on AUDIT_SETTINGS struct
     */
    function configure() {
        URLPATH_LENGTH         = AUDIT_SETTINGS.urlpathLength;
        METHOD_LENGTH          = AUDIT_SETTINGS.methodLength;
        AGENT_LENGTH           = AUDIT_SETTINGS.agentLength;
        DETAIL_LENGTH          = AUDIT_SETTINGS.detailLength;
        SLOW_REQUEST_THRESHOLD = AUDIT_SETTINGS.slowRequestThreshold;
        MAX_SLOW_REQUESTS      = AUDIT_SETTINGS.maxSlowRequests;
    }

    /**
     * Set up audit object for each request
     */
    function preProcess(event, data, buffer, rc, prc) {
        prc.requestAudit = {
            ip        : securityService.getRequestIP(),
            urlpath   : left(event.getFullPath(), URLPATH_LENGTH),
            method    : left(event.getHTTPMethod(), METHOD_LENGTH),
            start     : getTickCount(),
            agent     : left(securityService.getUserAgent(), AGENT_LENGTH),
            detail    : '',
            statuscode: -1,
            userid    : -1
        };
    }

    /**
     * Fire async task to audit the request
     * Adds slow requests to concurrency array
     */
    function postProcess(event, rc, prc) {
        /**
         * Add last details to request audit and audit it
         */
        prc.requestAudit.userid     = prc?.userid ?: -1;
        prc.requestAudit.delta      = getTickCount() - prc.requestAudit.start;
        prc.requestAudit.statuscode = prc?.response?.getStatusCode() ?: -1;
        prc.requestAudit.detail     = left(prc?.response?.getMessagesString() ?: '', DETAIL_LENGTH);

        if(LOG_REQUESTS) {
            var auditData = duplicate(prc.requestAudit);
            async.newFuture(() => {
                auditService.audit(argumentCollection = auditData);
            });
        }

        /**
         * If this was a slow request, add it up to a max of 25 for display
         */
        if(prc.requestAudit.delta > SLOW_REQUEST_THRESHOLD) {
            var timestamp = now();

            lock name="slowRequestsLock" timeout="5" type="exclusive" throwOnTimeout=false {
                // Delete requests older than 24 hours
                var oneHourAgo           = dateAdd('h', -24, timestamp);
                concurrency.slowRequests = concurrency.slowRequests.filter((req) => {
                    return req.time > oneHourAgo;
                });

                // Add new request
                concurrency.slowRequests.append({
                    urlpath: prc.requestAudit.urlpath,
                    method : prc.requestAudit.method,
                    delta  : prc.requestAudit.delta,
                    userid : prc.requestAudit.userid,
                    time   : timestamp,
                    uuid   : createUUID()
                });

                // Enforces max array size
                while(concurrency.slowRequests.len() > MAX_SLOW_REQUESTS) {
                    concurrency.slowRequests.shift();
                }
            }
        }
    }

}
