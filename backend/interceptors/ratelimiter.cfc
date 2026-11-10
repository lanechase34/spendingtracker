component extends="coldbox.system.Interceptor" hint="Interceptor to enforce rate limits on a per request basis" {

    property name="jwtService"       inject="provider:JwtService@cbsecurity";
    property name="metricsService"   inject="services.metrics";
    property name="securityService"  inject="services.security";
    property name="rateLimitService" inject="services.ratelimit";
    property name="rateLimits"       inject="coldbox:setting:rateLimits";
    property name="useRateLimiter"   inject="coldbox:setting:useRateLimiter";

    // Fields a rule can be scoped by - ip and user are resolved here, the rest are read from rc
    // Add new rc fields here before using them in a rule
    variables.BY_FIELDS = ["ip", "user", "email"];

    /**
     * Validate the rate limit rules on startup
     */
    function configure() {
        rateLimits.each((currentEvent, rules) => {
            var prefix = "Invalid rate limit rule for [#currentEvent#]";

            // Events are looked up lowercased
            if(compare(currentEvent, lCase(currentEvent)) != 0) {
                throw(type = "RateLimitConfigError", message = "#prefix#: event name must be lowercase");
            }

            if(!isArray(rules) || !rules.len()) {
                throw(type = "RateLimitConfigError", message = "#prefix#: rules must be a non empty array");
            }

            rules.each((rule) => {
                if(!isStruct(rule)) {
                    throw(type = "RateLimitConfigError", message = "#prefix#: each rule must be a struct");
                }

                var by = listToArray(rule?.by ?: "");
                if(!by.len()) {
                    throw(type = "RateLimitConfigError", message = "#prefix#: by is required");
                }

                by.each((field) => {
                    if(!BY_FIELDS.find(field)) {
                        throw(
                            type    = "RateLimitConfigError",
                            message = "#prefix#: unknown by field [#field#], allowed: #BY_FIELDS.toList(", ")#"
                        );
                    }
                });

                for(var settingName in ["limit", "window"]) {
                    var value = rule[settingName] ?: "";
                    if(!isValid("integer", value) || value < 1) {
                        throw(
                            type    = "RateLimitConfigError",
                            message = "#prefix#: #settingName# must be a positive integer"
                        );
                    }
                }

                for(var flag in ["resetOnSuccess", "refundOnFailure"]) {
                    if(rule.keyExists(flag) && !isBoolean(rule[flag])) {
                        throw(type = "RateLimitConfigError", message = "#prefix#: #flag# must be a boolean");
                    }
                }
            });
        });
    }

    /**
     * Rate limit requests on a per route basis on server side
     */
    function preProcess(event, data, buffer, rc, prc) {
        // Skip requests an earlier interceptor already rejected (e.g. guestOnly) - they shouldn't count
        if(!useRateLimiter || event.isNoExecution()) {
            return;
        }

        prc.currEvent = prc?.currEvent ?: lCase(event.getCurrentEvent());

        /**
         * Check if there's a rate limit in place for incoming handler.action
         */
        if(!rateLimits.keyExists(prc.currEvent)) {
            return;
        }

        /**
         * For each rule, build the key and check
         */
        var rules  = rateLimits[prc.currEvent];
        var ip     = securityService.getRequestIP();
        var userid = getUserid(rules = rules, prc = prc);

        // Keys of refundOnFailure rules that counted a hit - postProcess refunds these if the request fails
        prc.rateLimitRefunds = [];

        var allowed = true;
        rules.each((rule) => {
            var key = rateLimitService.buildKey(
                currentEvent = prc.currEvent,
                by           = listToArray(rule.by),
                window       = rule.window,
                ip           = ip,
                userid       = userid,
                context      = rc
            );

            if(!key.len()) {
                return;
            }

            var hitAllowed = rateLimitService.hit(
                key    = key,
                limit  = rule.limit,
                window = rule.window
            );

            if(!hitAllowed) {
                allowed = false;
            }
            else if(rule.refundOnFailure ?: false) {
                prc.rateLimitRefunds.append(key);
            }
        });

        // Not allowed - too many requests
        if(!allowed) {
            metricsService.recordRateLimitBlock(event = prc.currEvent);

            var message = "Too many attempts. Please try again later.";
            event
                .getResponse()
                .setErrorMessage(message)
                .setStatusCode(429);

            event.renderData(
                data       = {error: true, messages: [message]},
                statusCode = 429,
                type       = "json"
            );

            // Stop execution of the current request - the response is handled above
            event.noExecution();
            return;
        }
    }

    /**
     * When the request succeeded (2xx), clear the counters of rules marked resetOnSuccess
     * When the request failed (>= 400), refund the hits of rules marked refundOnFailure
     */
    function postProcess(event, data, buffer, rc, prc) {
        if(!useRateLimiter) {
            return;
        }

        prc.currEvent = prc?.currEvent ?: lCase(event.getCurrentEvent());

        if(!rateLimits.keyExists(prc.currEvent)) {
            return;
        }

        var refunds = prc?.rateLimitRefunds ?: [];
        var rules   = rateLimits[prc.currEvent].filter((rule) => rule.resetOnSuccess ?: false);

        if(!refunds.len() && !rules.len()) {
            return;
        }

        var statusCode = event.getResponse().getStatusCode();

        // Failed - the hits reserved in preProcess shouldn't count
        if(statusCode >= 400) {
            refunds.each((key) => rateLimitService.release(key = key));
            return;
        }

        if(statusCode < 200 || statusCode >= 300 || !rules.len()) {
            return;
        }

        var ip     = securityService.getRequestIP();
        var userid = getUserid(rules = rules, prc = prc);
        rules.each((rule) => {
            var key = rateLimitService.buildKey(
                currentEvent = prc.currEvent,
                by           = listToArray(rule.by),
                window       = rule.window,
                ip           = ip,
                userid       = userid,
                context      = rc
            );

            if(key.len()) {
                rateLimitService.clear(key = key);
            }
        });
    }

    /**
     * Resolve the authenticated user's id for rules scoped by 'user'
     * Returns an empty string when not authenticated - those rules are skipped
     *
     * @rules the rules for the current event
     * @prc   the prc scope
     */
    private string function getUserid(required array rules, required struct prc) {
        if(!rules.some((rule) => listToArray(rule.by).find("user"))) {
            return "";
        }

        // Auth user loaded
        if(!isNull(prc?.authUser)) {
            return prc.authUser.getId();
        }

        // Check if jwt present
        try {
            var authUser = jwtService.getUser();
            if(!isNull(authUser) && authUser.isLoaded()) {
                return authUser.getId();
            }
        }
        catch(any e) {
            // No valid JWT present - rules scoped by user are skipped
        }

        return "";
    }

}
