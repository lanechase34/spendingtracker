component extends="coldbox.system.Interceptor" hint="Block authenticated users from accessing guest-only routes" {

    property name="jwtService" inject="provider:JwtService@cbsecurity";
    property name="settings"   inject="coldbox:setting:guestOnlyRoutes";

    /**
     * Intercept incoming requests and block authenticated users
     * from accessing routes that are intended for unauthenticated users only
     * (e.g. login, register, forgot password)
     *
     * WHY WE MANUALLY CALL jwtService.authenticate() HERE:
     * cbsecurity only decodes the JWT and populates prc.authUser when the target
     * handler/action has a cbsecurity annotation (e.g. secured, secured="").
     * Guest-only routes are intentionally unannotated and unsecured, so cbsecurity's
     * firewall never runs its authentication pipeline for these events - meaning
     * prc.authUser is never populated by the time preProcess fires.
     *
     * To check whether the incoming request carries a valid JWT token on these
     * unannotated routes, we must manually call jwtService.authenticate() ourselves.
     * If it succeeds and returns a loaded user, the requester is already authenticated
     * and should be rejected with a 400. If it throws (invalid/missing/expired token),
     * we allow the request through - the user is genuinely a guest.
     */
    function preProcess(event, data, buffer, rc, prc) {
        var currentEvent = lCase(event.getCurrentEvent());

        if(!settings.findNoCase(currentEvent)) {
            return;
        }

        try {
            var authUser = jwtService.authenticate();
            if(!isNull(authUser) && authUser.isLoaded()) {
                var message = 'You are already authenticated.';
                event
                    .getResponse()
                    .setErrorMessage(message)
                    .setStatusCode(400);

                event.renderData(
                    data       = {error: true, messages: [message]},
                    statusCode = 400,
                    type       = 'json'
                );

                // Stop execution of the current request - the response is handled above
                event.noExecution();
                return;
            }
        }
        catch(any e) {
            // No valid JWT present - allow through
        }
    }

}
