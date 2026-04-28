component extends="coldbox.system.Interceptor" hint="Block authenticated users from accessing guest-only routes" {

    property name="jwtService" inject="provider:JwtService@cbsecurity";
    property name="settings"   inject="coldbox:setting:guestOnlyRoutes";

    /**
     * Intercept incoming requests and block authenticated users
     * from accessing routes that are intended for unauthenticated users only
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
