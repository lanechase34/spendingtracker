component extends="coldbox.system.testing.BaseTestCase" {

    /**
     * Setup and confirm TOTP for a user, returning the plain secret and recovery codes
     */
    public struct function setupAndConfirmTOTP(required string token) {
        // Initiate setup
        setup();
        var setupEvent = post(route = '/api/v1/me/2fa/setup', headers = {'x-auth-token': token});
        var secret     = setupEvent.getResponse().getData().secret;

        // Generate a valid code using the secret
        var totpService = getInstance('services.totp');
        var plainCode   = getInstance('@totp').generateCode(secret = secret);

        // Confirm setup
        setup();
        var confirmEvent = post(
            route   = '/api/v1/me/2fa/confirm',
            params  = {code: plainCode},
            headers = {'x-auth-token': token}
        );

        return {secret: secret, recoveryCodes: confirmEvent.getResponse().getData().recoveryCodes};
    }

}
