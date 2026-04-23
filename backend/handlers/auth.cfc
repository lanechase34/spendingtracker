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
     * Login a user and return the JWT and refresh token
     *
     * @rc.email      Email
     * @rc.password   Password
     * @rc.rememberMe (boolean) sets refresh token cookie if true
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
        if(totpService.isEnabled(user.getId())) {
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
     * Returns valid user JWT on success
     *
     * @rc.code The 6-digit code from the authenticator app or a recovery code
     */
    function verify2fa(event, rc, prc) secured="Pending2FA" {
        try {
            totpService.verifyTOTP(user = prc.authUser, code = rc.code);
        }
        catch('TOTP.InvalidCode' e) {
            event
                .getResponse()
                .setErrorMessage('Invalid or expired code.')
                .setStatusCode(401);
            return;
        }

        // Issue full JWT now that 2FA is confirmed
        var token = jwtService.fromUser(user = userService.retrieveUserById(id = prc.userid, checkPending = false));

        // Set refresh token if remember me was checked in login
        if(prc?.rememberMe ?: false) {
            securityService.setRefreshTokenCookie(token = token.refresh_token);
        }

        event
            .getResponse()
            .setData({access_token: token.access_token})
            .addMessage('Bearer token created and it expires in #jwtService.getSettings().jwt.expiration# minutes')
            .setStatusCode(200);
    }

    /**
     * Logout a user and invalidate their JWT 
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
            jwtService.refreshToken();
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
     * @rc.email           unique email
     * @rc.password        user password
     * @rc.salary          salary
     * @rc.monthlyTakehome monthly take home
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
     * Verify the code sent to a user's email
     *
     * @rc.verificationCode the emailed verification code
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
            .addMessage('Succesfully verified!');
    }

    /**
     * Resend a verification code to the user's email
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
     * Generate CSRF token for Authenticated User
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
