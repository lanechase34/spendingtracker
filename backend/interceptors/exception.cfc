component extends="coldbox.system.Interceptor" hint="Interceptor for handling exceptions and validation exceptions" {

    property name="async"      inject="asyncManager@coldbox";
    property name="bugService" inject="services.bug";
    property name="excludedEvents" type="struct" default="{}";
    property name="excludedTypes"  type="struct" default="{}";

    /**
     * Configuration
     */
    function configure() {
        this.excludedEvents = {'cbsecurity:jwt.refreshtoken': true, 'auth.logout': true};
        this.excludedTypes  = {'tokenmismatchexception': true};
    }

    /**
     * Generic exception interceptor
     * Announced in onAnyOtherException
     */
    function onException(event, data, buffer, rc, prc, interceptData) {
        /**
         * Check if curr event is excluded
         */
        var currEvent = lCase(event.getCurrentEvent());
        if(this.excludedEvents.keyExists(currEvent)) {
            return;
        }

        /**
         * Check if this specific error type is excluded
         */
        var currType = lCase(interceptData?.exception?.type ?: '');
        if(this.excludedTypes.keyExists(currType)) {
            return;
        }

        /**
         * Handle exceptions here. Including logging, audit, email, etc
         */
        prc.requestAudit.userid = prc?.userid ?: -1;
        prc.requestAudit.detail = 'onException';
        prc.requestAudit.stack  = interceptData;
        async.newFuture(() => {
            bugService.log(argumentCollection = prc.requestAudit);
            getInstance('services.email').sendBug(bugInfo = prc.requestAudit);
        });

        /**
         * Dump detail in development environment
         */
        if(
            getSetting('environment') == 'development'
            && (url.keyExists('debug') || getSetting('debugging'))
        ) {
            writeDump(interceptData.exception);
            abort;
        }
    }

    /**
     * Validation exception interceptor
     * Announced in onValidationException
     */
    function onValidationException(event, data, buffer, rc, prc, interceptData) {
        prc.requestAudit.detail = 'onValidationException';
        prc.requestAudit.stack  = interceptData;
        async.newFuture(() => {
            bugService.log(argumentCollection = prc.requestAudit);
        });
    }

}
