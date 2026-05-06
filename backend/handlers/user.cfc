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
     * Get the user's profile
     *
     * @summary      Get Profile
     * @tags         User
     * @security     ApiKeyAuth
     * @hint         Returns profile information for the currently authenticated user.
     * @response-200 { "description": "User profile data." }
     * @response-401 ~errors/401.json
     */
    function getProfile(event, rc, prc) {
        prc.data = userService.retrieveUserDataById(id = prc.userid);
        event
            .getResponse()
            .setData(prc.data)
            .setStatusCode(200);
    }

    /**
     * Update the user's profile settings
     *
     * @summary      Update Profile
     * @tags         User
     * @security     [ { "ApiKeyAuth": [], "CSRFToken": [] } ]
     * @hint         Updates one or more profile fields for the authenticated user. All fields are optional - only provided fields will be updated. Password must be at least 10 characters. Salary and monthlyTakeHome must be positive numbers.
     * @requestBody  ~user/updateProfile/requestBody.json
     * @response-200 { "description": "Profile updated successfully." }
     * @response-400 ~errors/400.json
     * @response-401 ~errors/401.json
     */
    function updateProfile(event, rc, prc) {
        if(rc.keyExists('settings')) {
            try {
                rc.settings         = deserializeJSON(rc.settings);
                rc.settings.updated = true;
            }
            catch(any e) {
                event
                    .getResponse()
                    .setErrorMessage('Invalid Parameters.')
                    .setStatusCode(400);
                return;
            }
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
     * @summary        List Users
     * @tags           User
     * @security       ApiKeyAuth
     * @hint           Returns a paginated list of all users. Restricted to Admin role only.
     * @param-page     { "in": "query", "required": true,  "schema": { "type": "integer", "minimum": 1, "example": 1 } }
     * @param-records  { "in": "query", "required": true,  "schema": { "type": "integer", "minimum": 10, "maximum": 100, "example": 25 } }
     * @param-search   { "in": "query", "required": false, "schema": { "type": "string", "maxLength": 50 } }
     * @param-orderCol { "in": "query", "required": false, "schema": { "type": "string", "enum": ["email","security_level","verified","lastlogin"] } }
     * @param-orderDir { "in": "query", "required": false, "schema": { "type": "string", "enum": ["asc","desc"] } }
     * @response-200   { "description": "Paginated user results." }
     * @response-400   ~errors/400.json
     * @response-401   ~errors/401.json
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
     * Initiate 2FA setup
     * Calling this again before confirming will regenerate the secret and invalidate any previously scanned QR codes.
     * Throws an error if 2FA is already active on the account.
     *
     * @summary      Setup 2FA
     * @tags         User
     * @security     [ { "ApiKeyAuth": [], "CSRFToken": [] } ]
     * @hint         Begins the 2FA setup process for the authenticated user. Returns a QR code (base64 PNG) and plain text secret to register with an authenticator app.
     * @response-200 { "description": "Returns qrCode (base64 PNG) and secret for the authenticator app." }
     * @response-400 { "description": "2FA is already enabled on this account." }
     * @response-401 ~errors/401.json
     * @response-429 ~errors/429.json
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
     * Confirm and activate 2FA
     * On success, generates a set of one-time recovery codes which are returned once and never shown again.
     * setup2fa must be called before this endpoint. Throws if 2FA is already active or the code is invalid.
     *
     * @summary      Confirm 2FA
     * @tags         User
     * @security     [ { "ApiKeyAuth": [], "CSRFToken": [] } ]
     * @hint         Verifies the 6-digit code from the authenticator app and activates 2FA on the account.  
     * @requestBody  ~user/confirm2fa/requestBody.json
     * @response-200 { "description": "2FA activated. Returns array of single-use recovery codes." }
     * @response-400 { "description": "Invalid or expired code, 2FA not initiated, or 2FA already enabled." }
     * @response-401 ~errors/401.json
     * @response-429 ~errors/429.json
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
     * Disable 2FA
     * Throws if 2FA is not currently enabled or the code is invalid.
     *
     * @summary      Disable 2FA
     * @tags         User
     * @security     [ { "ApiKeyAuth": [], "CSRFToken": [] } ]
     * @hint         Disables 2FA on the account after verifying identity. Requires either a valid 6-digit TOTP code from the authenticator app or a recovery code in the format xxxx-xxxx-xxxx-xxxx.        
     * @requestBody  ~user/disable2fa/requestBody.json
     * @response-200 { "description": "2FA disabled successfully." }
     * @response-400 { "description": "Invalid or expired code, or 2FA is not currently enabled." }
     * @response-401 ~errors/401.json
     * @response-429 ~errors/429.json
     */
    function disable2fa(event, rc, prc) {
        totpService.disable(user = prc.authUser, code = rc.code);

        event
            .getResponse()
            .addMessage('Two-factor authentication has been disabled.')
            .setStatusCode(200);
    }

}
