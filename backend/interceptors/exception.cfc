component extends="coldbox.system.Interceptor" hint="Interceptor for handling exceptions and validation exceptions" {

    property name="async"        inject="asyncManager@coldbox";
    property name="bugService"   inject="services.bug";
    property name="emailService" inject="provider:services.email";

    // Events and exception types that are expected and shouldn't be logged as bugs
    variables.EXCLUDED_EVENTS = {"cbsecurity:jwt.refreshtoken": true, "auth.logout": true};
    variables.EXCLUDED_TYPES  = {"tokenmismatchexception": true};

    /**
     * Generic exception interceptor
     * Announced in onAnyOtherException
     */
    function onException(event, data, buffer, rc, prc, interceptData) {
        /**
         * Check if curr event is excluded
         */
        var currEvent = lCase(event.getCurrentEvent());
        if(EXCLUDED_EVENTS.keyExists(currEvent)) {
            return;
        }

        /**
         * Check if this specific error type is excluded
         */
        var currType = lCase(interceptData?.exception?.type ?: "");
        if(EXCLUDED_TYPES.keyExists(currType)) {
            return;
        }

        /**
         * Log and email the bug
         */
        var bugSnapshot = buildBugSnapshot(
            event  = event,
            prc    = prc,
            detail = "onException",
            stack  = interceptData
        );

        async.newFuture(() => {
            bugService.log(argumentCollection = bugSnapshot);
        });

        async.newFuture(() => {
            emailService.sendBug(bugInfo = bugSnapshot);
        });

        /**
         * Dump detail in development environment
         */
        if(
            getSetting("environment") == "development"
            && (url.keyExists("debug") || getSetting("debugging"))
        ) {
            cfsavecontent(variable = "local.dump") {
                writeDump(var = interceptData.exception);
            }
            event.renderData(type = "HTML", data = local.dump);
        }
    }

    /**
     * Validation exception interceptor
     * Announced in onValidationException
     */
    function onValidationException(event, data, buffer, rc, prc, interceptData) {
        var bugSnapshot = buildBugSnapshot(
            event  = event,
            prc    = prc,
            detail = "onValidationException",
            stack  = interceptData
        );

        async.newFuture(() => {
            bugService.log(argumentCollection = bugSnapshot);
        });
    }

    /**
     * Build a standalone copy of the request audit for bug logging
     *
     * @event  the request context
     * @prc    the prc scope
     * @detail bug detail
     * @stack  intercept data containing the exception
     */
    private struct function buildBugSnapshot(
        required event,
        required struct prc,
        required string detail,
        required struct stack
    ) {
        // Fallbacks when requestAudit.preProcess didn't run (e.g. an earlier interceptor threw)
        var snapshot = {
            ip     : "-1",
            urlpath: event.getFullPath(),
            method : event.getHTTPMethod(),
            agent  : ""
        };

        snapshot.append(prc?.requestAudit ?: {}, true);
        snapshot.append(
            {
                userid: prc?.userid ?: -1,
                detail: detail,
                stack : stack
            },
            true
        );

        return duplicate(snapshot);
    }

}
