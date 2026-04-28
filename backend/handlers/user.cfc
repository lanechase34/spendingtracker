component extends="base" hint="User Endpoints" secured="User,Admin" {

    this.allowedMethods = {
        getProfile   : 'GET',
        updateProfile: 'PATCH',
        view         : 'GET',
        setup2fa     : 'POST',
        confirm2fa   : 'POST',
        disable2fa   : 'POST'
    };

    property name="totpService" inject="services.totp";
    property name="userService" inject="services.user";

    /**
     * Return information about the logged in user
     */
    function getProfile(event, rc, prc) {
        prc.data = userService.retrieveUserDataById(id = prc.userid);
        event
            .getResponse()
            .setData(prc.data)
            .setStatusCode(200);
    }

    /**
     * Save a user's profile settings
     *
     * @rc.password        (optional) new password
     * @rc.salary          (optional) salary
     * @rc.monthlyTakehome (optional) monthly take home
     */
    function updateProfile(event, rc, prc) {
        if(rc.keyExists('settings')) {
            rc.settings         = deserializeJSON(rc.settings);
            rc.settings.updated = true;
        }

        userService.updateProfile(
            id              = prc.userid,
            password        = rc?.password ?: '',
            salary          = rc?.salary ?: -1,
            monthlyTakeHome = rc?.monthlyTakeHome ?: -1,
            settings        = rc?.settings ?: {}
        );

        event
            .getResponse()
            .addMessage('Successfully updated')
            .setStatusCode(200);
    }

    /**
     * Paginated view for users
     *
     * @rc.page     page num
     * @rc.records  total records to return
     * @rc.search   (optional) search param
     * @rc.orderCol (optional) which col to order
     * @rc.orderDir (optional) order direction
     */
    function view(event, rc, prc) secured="Admin" {
        prc.data = userService.paginate(
            userid   = prc.userid,
            page     = rc.page,
            records  = rc.records,
            search   = rc?.search ?: '',
            orderCol = rc?.orderCol ?: '',
            orderDir = rc?.orderDir ?: ''
        );

        event
            .getResponse()
            .setDataWithPagination(
                data          = prc.data,
                resultsKey    = 'results',
                paginationKey = 'pagination'
            )
            .setStatusCode(200);
    }

    /**
     * Initiates 2FA setup for the authenticated user.
     *
     * Calling this endpoint again before confirming will regenerate the
     * secret, invalidating any previously scanned QR codes.
     *
     * @return qrCode (base64 PNG) and secret (plain text code)
     *
     * @throws TOTP.AlreadyEnabled If 2FA is already active on this account
     */
    function setup2fa(event, rc, prc) {
        var result = totpService.initiateSetup(user = prc.authUser);

        event
            .getResponse()
            .setData({qrCode: result.qrCode, secret: result.secret})
            .addMessage('Scan the QR code with your authenticator app then confirm with a valid code.')
            .setStatusCode(200);
    }

    /**
     * Confirms and activates 2FA for the authenticated user.
     *
     * If valid, enables 2FA on the account and generates
     * a set of one-time recovery codes.
     * Recovery codes are returned ONCE and never shown again.
     *
     * @rc.code The 6-digit code from the authenticator app
     *
     * @return Array of single-use recovery codes
     *
     * @throws TOTP.NotInitiated   If setup2fa has not been called first
     * @throws TOTP.AlreadyEnabled If 2FA is already active on this account
     * @throws TOTP.InvalidCode    If the submitted code is invalid or expired
     */
    function confirm2fa(event, rc, prc) {
        var result = totpService.confirmSetup(user = prc.authUser, code = rc.code);

        event
            .getResponse()
            .setData({recoveryCodes: result.recoveryCodes})
            .addMessage('Two-factor authentication has been enabled. Store your recovery codes somewhere safe - they will not be shown again.')
            .setStatusCode(200);
    }

    /**
     * Disables 2FA for the authenticated user after verifying their identity.
     * Requires a valid TOTP code or recovery code to prevent unauthorized disabling.
     *
     * or a recovery code in the format xxxx-xxxx-xxxx-xxxx.
     *
     * @rc.code Required. A valid 6-digit TOTP code from the authenticator app,
     *
     * @return 200 with success message
     *
     * @throws TOTP.NotEnabled  If 2FA is not currently enabled on this account
     * @throws TOTP.InvalidCode If the submitted code is invalid or expired
     */
    function disable2fa(event, rc, prc) {
        totpService.disable(user = prc.authUser, code = rc.code);

        event
            .getResponse()
            .addMessage('Two-factor authentication has been disabled.')
            .setStatusCode(200);
    }

}
