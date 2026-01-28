component extends="coldbox.system.Interceptor" {

    property name="securityService" inject="services.security";

    /**
     * Adds JWT auth, refresh tokens to rc scope
     * Setup and use custom apiResponseObj
	 */
    function preProcess(event, data, buffer, rc, prc) {
        if(cookie.keyExists('x-auth-token') && len(trim(cookie['x-auth-token']))) {
            rc['x-auth-token'] = trim(cookie['x-auth-token']);
        }

        if(cookie.keyExists('x-refresh-token') && len(trim(cookie['x-refresh-token']))) {
            rc['x-refresh-token'] = trim(cookie['x-refresh-token']);
        }

        /**
         * Set up API Response obj
         */
        prc.response = getInstance('objects.apiresponseobj');
    }

    /**
     * Interceptor to set the authUser Id to request scope to use inside CBStorage
     * to get the 'session' identifier
     */
    function onIdentifier(event, data, buffer, rc, prc) {
        request.userid = prc?.authUser?.getId() ?: createUUID();
    }

    /**
     * Inject the authUser information into prc scope for every request
     */
    function preEvent(event, data, buffer, rc, prc) {
        prc.userid  = prc?.authUser?.getId() ?: -1;
        prc.userDir = prc?.authUser?.getDir() ?: '';
    }

    /**
     * If the api response has newTokens, set them in the cookies
     */
    function postProcess(event, rc, prc) {
        var currEvent = lCase(rc?.event ?: '');
        if(
            prc.keyExists('newTokens')
            && currEvent == 'cbsecurity:jwt.refreshtoken'
            && prc.newTokens.keyExists('access_token')
            && prc.newTokens.keyExists('refresh_token')
        ) {
            securityService.setRefreshTokenCookie(token = prc.newTokens.refresh_token);
        }
    }

    /**
     * Delete the refresh token cookie if it no longer exists in storage
     */
    function cbSecurity_onJWTStorageRejection(event, data, buffer, rc, prc) {
        if(data?.payload?.cbsecurity_refresh ?: false) {
            securityService.deleteTokenCookies();
        }
    }

    /**
     * Delete the refresh token cookie if it expired
     */
    function cbSecurity_onJWTExpiration(event, data, buffer, rc, prc) {
        if(data?.payload?.cbsecurity_refresh ?: false) {
            securityService.deleteTokenCookies();
        }
    }

}
