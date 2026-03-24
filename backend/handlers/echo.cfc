component extends="base" hint="Not Resource Specific Endpoints" {

    property name="securityService" inject="services.security";

    /**
     * Warmup the server on first start
     */
    function warmup(event, rc, prc) {
        var trustedIPs = ['0:0:0:0:0:0:0:1', '127.0.0.1'];
        if(
            !getSetting('warmedUp')
            && trustedIPs.contains(securityService.getRequestIP())
            && findNoCase('Java', cgi.http_user_agent) > 0
        ) {
            setting requestTimeout=300;

            var start      = getTickCount();
            application.ws = new WebSocket();
            if(getSetting('environment') == 'development') {
                /**
                 * Data setup by forcing tasks to run
                 */
                for(var i = 0; i <= 12; i++) {
                    getInstance('services.subscription').charge();
                    getInstance('services.income').payMonthly(
                        dateFormat(
                            dateAdd(
                                'm',
                                -i,
                                createDate(year(now()), month(now()), 1)
                            ),
                            'short'
                        )
                    );
                }
            }

            setSetting('warmedUp', true);

            event
                .getResponse()
                .addMessage('Successfully warmed up server in #getTickCount() - start#ms.')
                .setStatusCode(200);
        }
        else {
            event
                .getResponse()
                .addMessage('Ok!')
                .setStatusCode(200);
        }
    }

    /**
     * Healthcheck status
     */
    function healthCheck(event, rc, prc) {
        if(!getSetting('healthCheck')) {
            throw('Failed health check');
        }

        event
            .getResponse()
            .setData('Ok!')
            .setStatusCode(200);
    }

    /**
     * Returns current status of backend
     * Shows environment and version
     */
    function status(event, rc, prc) {
        event
            .getResponse()
            .setData({
                environment: getSetting('environment'),
                version    : getSetting('version'),
                status     : 'ok'
            })
            .setStatusCode(200);
    }

    /**
     * Invalid HTTP Method Handler
     */
    function invalidHTTPMethod(event, rc, prc) {
        event
            .getResponse()
            .setErrorMessage('Method Not Allowed')
            .setStatusCode(405);
    }

    /**
     * Invalid Event Handler
     */
    function invalidEvent(event, rc, prc) {
        event
            .getResponse()
            .setErrorMessage('Bad Request Invalid Event')
            .setStatusCode(400);
    }

    /**
     * Missing Action Handler
     */
    function onMissingAction(event, rc, prc) {
        event
            .getResponse()
            .setErrorMessage('Bad Request Missing Action')
            .setStatusCode(400);
    }

    /**
     * Exception Handler
     */
    function onException(event, rc, prc) {
        /**
         * Handle CB CSRF Exceptions
         */
        var type = prc.exception.getType();
        if(type == 'TokenNotFoundException' || type == 'TokenMismatchException') {
            event
                .getResponse()
                .setErrorMessage('Missing or invalid CSRF token.')
                .setStatusCode(403);
            return;
        }

        event
            .getResponse()
            .setErrorMessage('An exception ocurred please try again.')
            .setStatusCode(500);
    }

    /**
     * 401 Unauthorized endpoint
     */
    function unauthorized(event, rc, prc) {
        event
            .getResponse()
            .setErrorMessage('Invalid access.')
            .setStatusCode(401);
    }

    /**
     * Missing Template Handler
     */
    function missingTemplate(event, rc, prc) {
        event
            .getResponse()
            .setErrorMessage('Invalid access.')
            .setStatusCode(401);
    }

}
