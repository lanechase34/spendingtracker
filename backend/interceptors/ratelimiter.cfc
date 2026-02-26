component extends="coldbox.system.Interceptor" hint="Interceptor to enforce rate limits on a per request basis" {

    property name="securityService"  inject="services.security";
    property name="rateLimitService" inject="services.ratelimit";
    property name="settings"         inject="coldbox:setting:rateLimits";
    property name="useRateLimiter"   inject="coldbox:setting:useRateLimiter";

    /**
     * Rate limit requests on a per route basis on server side
     */
    function preProcess(event, data, buffer, rc, prc) {
        if(!useRateLimiter) {
            return;
        }

        /**
         * Check if there's a rate limit in place for incoming handler.action
         */
        var currentEvent = lCase(event.getCurrentEvent());
        if(!settings.keyExists(currentEvent)) {
            return;
        }

        /**
         * Build key based on the current event's rules
         */
        var rule  = settings[currentEvent];
        var ip    = securityService.getRequestIP();
        var email = rc?.email ?: prc.authUser?.getEmail() ?: ip; // fallback to ip (just in case)

        var key = rateLimitService.buildKey(mode = rule.key, ip = ip, email = email);
        if(!key.len()) {
            return;
        }

        var cacheKey = 'ratelimit:#currentEvent#:#key#';
        var valid    = rateLimitService.hit(
            key    = cacheKey,
            limit  = rule.limit,
            window = rule.window
        );

        // Not valid - too many requests
        if(!valid) {
            event.renderData(
                data       = {error: true, messages: ['Too many attempts. Please try again later.']},
                statusCode = 429,
                type       = 'json'
            );
            // Stop execution
            event.noExecution();
            return;
        }
    }

}
