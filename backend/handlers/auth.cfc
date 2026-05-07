component extends="base" hint="Auth Endpoints" {

    this.allowedMethods = {
        login                 : 'POST',
        verify2fa             : 'POST',
        logout                : 'POST',
        register              : 'POST',
        verify                : 'POST',
        resendVerificationCode: 'GET',
        generateCSRF          : 'GET'
    };

    property name="csrfService"          inject="cbcsrf@cbcsrf";
    property name="jwtService"           inject="JwtService@cbsecurity";
    property name="securityService"      inject="services.security";
    property name="totpService"          inject="services.totp";
    property name="userService"          inject="services.user";
    property name="verificationCooldown" inject="coldbox:setting:verificationCooldown";

    /**
     * Login a user and return a JWT access token
     *
     * @summary      Login
     * @tags         Auth
     * @security     []
     * @hint         Authenticates a user and returns a JWT. If 2FA is enabled a pending token is returned instead. If rememberMe is true a refresh token cookie is set.
     * @requestBody  ~auth/login/requestBody.json
     * @response-200 { "description": "Authenticated successfully. Returns access_token. If 2FA required, also returns mfa_required: true." }
     * @response-400 ~errors/400.json
     * @response-403 { "description": "Email not verified. Returns access_token to use with /verify endpoints." }
     * @response-429 ~errors/429.json
     */
    function login(event, rc, prc) {
        try {
            var token = jwtService.attempt(username = rc.email, password = rc.password);
        }
        catch(VerificationException e) {
            // Verification Exception only thrown after email/password validated
            var token = jwtService.fromUser(user = userService.retrieveUserByUsername(rc.email));
            event
                .getResponse()
                .setData({access_token: token.access_token})
                .addMessage('Please verify your email. Email is not verified.')
                .setStatusCode(403);
            return;
        }
        catch(any e) {
            securityService.deleteTokenCookies(); // force delete any lingering cookies
            event
                .getResponse()
                .setErrorMessage('Invalid Login.')
                .setStatusCode(401);
            return;
        }

        // Check if user has 2FA enabled
        var user = userService.retrieveUserByUsername(rc.email);
        if(user.getTotp_Enabled()) {
            // Issue a short lived Pending2FA token
            var pendingUser = getInstance('objects.userobj');

            var pendingToken = jwtService.fromUser(
                user         = pendingUser,
                customClaims = {
                    pending2fa: true,
                    rememberMe: rc.rememberMe,
                    scope     : 'Pending2FA',
                    sub       : user.getId(),
                    exp       : int(getTickCount() / 1000) + 300 // 5 minutes
                }
            );
            event
                .getResponse()
                .setData({access_token: pendingToken.access_token, mfa_required: true})
                .addMessage('Please complete two-factor authentication.')
                .setStatusCode(200);
            return;
        }

        // Normal login - no 2FA

        // Set refresh token if they selected option
        if(rc.rememberMe) {
            securityService.setRefreshTokenCookie(token = token.refresh_token);
        }

        event
            .getResponse()
            .setData({access_token: token.access_token})
            .addMessage('Bearer token created and it expires in #jwtService.getSettings().jwt.expiration# minutes')
            .setStatusCode(200);
    }

    /**
     * Verify 2FA code during login
     *
     * @summary      Verify 2FA
     * @tags         Auth
     * @security     ApiKeyAuth
     * @hint         Verifies a 6-digit TOTP code or recovery code during login. Requires the pending JWT returned from /login. Returns a full JWT on success.
     * @requestBody  ~auth/verify2fa/requestBody.json
     * @response-200 { "description": "2FA verified successfully. Returns full access_token." }
     * @response-400 { "description": "Invalid or expired code." }
     * @response-401 ~errors/401.json
     * @response-429 ~errors/429.json
     */
    function verify2fa(event, rc, prc) secured="Pending2FA" {
        try {
            totpService.verifyTOTP(user = prc.authUser, code = rc.code);
        }
        catch('TOTP.InvalidCode' e) {
            event
                .getResponse()
                .setErrorMessage('Invalid or expired code.')
                .setStatusCode(400);
            return;
        }

        // Issue full JWT now that 2FA is confirmed
        var token = jwtService.fromUser(user = userService.retrieveUserById(id = prc.userid, checkPending = false));

        // Set refresh token if remember me was checked in login
        if(prc?.jwt_payload?.rememberMe ?: false) {
            securityService.setRefreshTokenCookie(token = token.refresh_token);
        }

        event
            .getResponse()
            .setData({access_token: token.access_token})
            .addMessage('Bearer token created and it expires in #jwtService.getSettings().jwt.expiration# minutes')
            .setStatusCode(200);
    }

    /**
     * Logout the current user
     *
     * @summary      Logout
     * @tags         Auth
     * @security     ApiKeyAuth
     * @hint         Invalidates the user's JWT and refresh token, and clears the refresh token cookie.
     * @response-200 { "description": "Successfully logged out." }
     * @response-401 ~errors/401.json
     */
    function logout(event, rc, prc) {
        /**
         * Logout user, invalidate their refresh token from the server, tell browser to delete refresh token cookie
         */
        try {
            jwtService.logout();
        }
        catch(any e) {
        }

        try {
            securityService.deleteTokenCookies();
        }
        catch(any e) {
        }

        event
            .getResponse()
            .addMessage('Successfully logged out')
            .setStatusCode(200);
    }

    /**
     * Register a new user
     *
     * @summary      Register
     * @tags         Auth
     * @security     []
     * @hint         Creates a new user account and sends an email verification code. Returns a pending JWT to use with /verify endpoints.
     * @requestBody  ~auth/register/requestBody.json
     * @response-200 { "description": "Registered successfully. Returns access_token. Check email for verification code." }
     * @response-400 ~errors/400.json
     * @response-429 ~errors/429.json
     */
    function register(event, rc, prc) {
        userService.register(
            email           = rc.email,
            password        = rc.password,
            salary          = rc.salary,
            monthlyTakeHome = rc.monthlyTakeHome
        );

        // Send the user the pending JWT
        var token = jwtService.fromUser(user = userService.retrieveUserByUsername(rc.email));
        event
            .getResponse()
            .setData({access_token: token.access_token})
            .addMessage('Successfully registered. Please check your email for a verification code.')
            .setStatusCode(200);
    }

    /**
     * Verify email address with a verification code
     *
     * @summary      Verify Email
     * @tags         Auth
     * @security     ApiKeyAuth
     * @hint         Verifies the code sent to the user's email. Returns a full JWT and sets a refresh token cookie on success.
     * @requestBody  ~auth/verify/requestBody.json
     * @response-200 { "description": "Email verified successfully. Returns full access_token." }
     * @response-400 { "description": "Invalid or expired verification code, or account already verified." }
     * @response-401 ~errors/401.json
     * @response-429 ~errors/429.json
     */
    function verify(event, rc, prc) secured="Unverified" {
        try {
            // Check if this is a valid code for this user
            userService.findByVerificationCode(userid = prc.userid, code = rc.verificationCode);
        }
        catch(UserNotFound e) {
            event
                .getResponse()
                .setStatusCode(400)
                .setErrorMessage('Invalid or expired verification code.');
            return;
        }
        catch(UserAlreadyVerified e) {
            event
                .getResponse()
                .setStatusCode(400)
                .setErrorMessage('Account already verified.');
            return;
        }

        /**
         * Mark verified
         */
        userService.markVerified(userid = prc.userid);

        /**
         * Create new JWT and refresh token
         */
        var token = jwtService.fromUser(user = userService.retrieveUserById(id = prc.userid, checkPending = false));
        securityService.setRefreshTokenCookie(token = token.refresh_token);
        event
            .getResponse()
            .setData({access_token: token.access_token})
            .setStatusCode(200)
            .addMessage('Successfully verified!');
    }

    /**
     * Resend the email verification code
     *
     * @summary      Resend Verification Code
     * @tags         Auth
     * @security     ApiKeyAuth
     * @hint         Resends the verification code to the user's email. Subject to a cooldown period between requests.
     * @response-200 { "description": "Verification code resent successfully." }
     * @response-401 ~errors/401.json
     * @response-429 ~errors/429.json
     */
    function resendVerificationCode(event, rc, prc) secured="Unverified" {
        /**
         * Check the cooldown and only send once cooldown has passed
         */
        if(
            !isNull(prc.authUser.getVerificationSentDate()) &&
            dateDiff(
                'n',
                prc.authUser.getVerificationSentDate(),
                now()
            ) <= verificationCooldown
        ) {
            // Let user know they need to wait for cooldown
            event
                .getResponse()
                .setErrorMessage('Please wait before requesting another verification email.')
                .setStatusCode(429);
            return;
        }

        /**
         * Send new email
         */
        userService.sendVerificationCode(userid = prc.userid);

        event
            .getResponse()
            .addMessage('Verification code resent!')
            .setStatusCode(200);
    }

    /**
     * Generate a CSRF token for the authenticated user
     *
     * @summary      Generate CSRF Token
     * @tags         Auth
     * @security     ApiKeyAuth
     * @hint         Generates and returns a CSRF token. Required before any state-changing requests (POST, PUT, PATCH, DELETE).
     * @response-200 { "description": "CSRF token generated successfully. Returns csrf_token." }
     * @response-401 ~errors/401.json
     */
    function generateCSRF(event, rc, prc) secured="Unverified,Pending2FA,User,Admin" {
        prc.csrfToken = csrfService.generate();
        event
            .getResponse()
            .setData({csrf_token: prc.csrfToken})
            .addMessage('CSRF token created and it expires in #csrfService.getSettings().rotationTimeout# minutes')
            .setStatusCode(200);
    }

}
