component singleton accessors="true" hint="Service for managing TOTP two-factor auth" {

    property name="appName"         inject="coldbox:setting:appName";
    property name="bcrypt"          inject="@BCrypt";
    property name="cacheStorage"    inject="cachebox:coldboxStorage";
    property name="encryptionKey"   inject="coldbox:setting:encryptionKey";
    property name="q"               inject="provider:QueryBuilder@qb";
    property name="securityService" inject="services.security";
    property name="totp"            inject="@totp";

    property name="recoveryCodeCount" type="numeric";
    function init() {
        setRecoveryCodeCount(8);
    }

    /**
     * Initiates 2FA setup for a user
     * Generates a secret and QR code but does NOT enable 2FA yet
     * The user must confirm a valid code before 2FA is activated
     *
     * @user The UserObj
     *
     * @return Struct with qrCode (base64) and secret (code if qr code fails)
     */
    public struct function initiateSetup(required userObj user) {
        var record = getUserTOTPRecord(user.getId());

        if(record.totp_enabled) {
            throw(type = 'TOTP.AlreadyEnabled', message = '2FA is already enabled for this user.');
        }

        var config = totp.generate(email = user.getEmail(), issuer = getAppName());

        // Store the encrypted secret as pending - not fully enabled yet
        q.from('users')
            .where(
                'id',
                '=',
                {value: user.getId(), cfsqltype: 'numeric'}
            )
            .update({
                totp_secret : {value: securityService.encryptTOTPSecret(config.secret), cfsqltype: 'varchar'},
                totp_enabled: {value: false, cfsqltype: 'boolean'}
            });

        return {
            qrCode: toBase64(config.qrCode),
            secret: config.secret // returned once so user can manually enter if QR fails
        };
    }

    /**
     * Confirms and activates 2FA for a user after verifying their first code
     * Also generates and returns recovery codes - shown once, never again
     *
     * @user The userObj
     * @code The 6-digit code from the authenticator app
     *
     * @return Struct of recovery codes
     *
     * @throws (TOTP.InvalidCode)
     * @throws (TOTP.NotInitiated)
     */
    public struct function confirmSetup(required userObj user, required string code) {
        var record = getUserTOTPRecord(user.getId());

        if(isNull(record.totp_secret) || !record.totp_secret.len()) {
            throw(type = 'TOTP.NotInitiated', message = 'TOTP setup has not been initiated for this user.');
        }

        if(record.totp_enabled) {
            throw(type = 'TOTP.AlreadyEnabled', message = '2FA is already enabled for this user.');
        }

        // confirmSetup only accepts a TOTP code, not a recovery code, since they haven't been generated at this point
        var secret = securityService.decryptTOTPSecret(record.totp_secret);

        if(!totp.verifyCode(secret = secret, code = code)) {
            throw(type = 'TOTP.InvalidCode', message = 'Invalid or expired verification code.');
        }

        // Generate recovery codes
        var plainCodes  = totp.generateRecoveryCodes(getRecoveryCodeCount());
        var hashedCodes = hashRecoveryCodes(plainCodes);

        // Activate 2FA
        q.from('users')
            .where(
                'id',
                '=',
                {value: user.getId(), cfsqltype: 'numeric'}
            )
            .update({
                totp_enabled       : {value: true, cfsqltype: 'boolean'},
                totp_recovery_codes: q.raw('cast(''#serializeJSON(hashedCodes)#'' as jsonb)')
            });

        // Invalidate user cache
        cacheStorage.clearByKeySnippet(keySnippet = 'user_#user.getId()#');

        // Return plain codes - shown once only
        return {recoveryCodes: plainCodes};
    }

    /**
     * Verifies a TOTP code for a user during login.
     *
     * @userid The userObj
     * @code   The 6-digit code from the authenticator app or a recovery code
     *
     * @throws (TOTP.InvalidCode)
     * @throws (TOTP.NotEnabled) 
     */
    public void function verifyTOTP(required userObj user, required string code) {
        var record = getUserTOTPRecord(user.getId());

        if(!record.totp_enabled) {
            throw(type = 'TOTP.NotEnabled', message = '2FA is not enabled for this user.');
        }

        verifyCode(user = user, code = code, record = record);

        return;
    }

    /**
     * Disables 2FA for a user after verifying their current code
     *
     * @user The userObj
     * @code The 6-digit code from the authenticator app or a recovery code
     *
     * @throws (TOTP.InvalidCode)
     * @throws (TOTP.NotEnabled)                         
     */
    public void function disable(required userObj user, required string code) {
        var record = getUserTOTPRecord(user.getId());

        if(!record.totp_enabled) {
            throw(type = 'TOTP.NotEnabled', message = '2FA is not enabled for this user.');
        }

        verifyCode(user = user, code = code, record = record);

        q.from('users')
            .where(
                'id',
                '=',
                {value: user.getId(), cfsqltype: 'numeric'}
            )
            .update({
                totp_secret        : {value: '', null: true},
                totp_enabled       : {value: false, cfsqltype: 'boolean'},
                totp_recovery_codes: q.raw('NULL')
            });

        // Invalidate user cache
        cacheStorage.clearByKeySnippet(keySnippet = 'user_#user.getId()#');
        return;
    }

    /**
     * Verifies a TOTP code or recovery code for a user
     * Routes to verifyAndConsumeRecoveryCode if the code matches recovery code format,
     * otherwise verifies against the TOTP secret
     *
     * @user   The userObj
     * @code   The 6-digit TOTP code or recovery code
     * @record Result of getUserTOTPRecord()
     *
     * @throws TOTP.InvalidCode
     */
    private void function verifyCode(
        required userObj user,
        required string  code,
        required struct  record
    ) {
        if(isRecoveryCode(code)) {
            verifyAndConsumeRecoveryCode(
                userid = user.getId(),
                code   = code,
                record = record
            );
            return;
        }

        var secret = securityService.decryptTOTPSecret(record.totp_secret);

        if(!totp.verifyCode(secret = secret, code = code)) {
            throw(type = 'TOTP.InvalidCode', message = 'Invalid or expired verification code.');
        }

        return;
    }

    /**
     * Return TOTP information attached to the user record
     *
     * @userid The user's id (PK)
     */
    private struct function getUserTOTPRecord(required numeric userid) {
        var result = q
            .from('users')
            .where('id', '=', {value: userid, cfsqltype: 'numeric'})
            .select([
                'id',
                'totp_secret',
                'totp_enabled',
                'totp_recovery_codes'
            ])
            .first();

        if(isNull(result) || result.isEmpty()) {
            throw(type = 'EntityNotFound', message = 'User not found.');
        }

        if(!isNull(result.totp_recovery_codes)) {
            result.totp_recovery_codes = deserializeJSON(result.totp_recovery_codes);
        }

        return result;
    }

    /**
     * Check if the incoming userid has totp enabled
     *
     * @userid The user's id (PK)
     *
     * @return T/F if enabled
     */
    public boolean function isEnabled(required numeric userid) {
        var record = getUserTOTPRecord(userid);
        return record.totp_enabled;
    }

    /**
     * Create a bcrypt hash for each recovery code
     *
     * @codes array of plan text recovery codes
     */
    private array function hashRecoveryCodes(required array codes) {
        return codes.map((code) => {
            return securityService.generateBcryptPassword(password = code);
        });
    }

    /**
     * Regex to confirm whether the incoming string is in valid recovery code format
     * Recovery codes are in format: xxxx-xxxx-xxxx-xxxx
     *
     * @code incoming recovery code to check
     */
    private boolean function isRecoveryCode(required string code) {
        return reFind('^[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$', code) > 0;
    }

    /**
     * Verify the incoming recovery code is valid
     * If valid, delete it from the stored codes
     *
     * @userid The user's id (PK)
     * @code   The entered recovery code
     * @record Result of getUserTOTPRecord()
     */
    private void function verifyAndConsumeRecoveryCode(
        required numeric userid,
        required string  code,
        required struct  record
    ) {
        if(isNull(record.totp_recovery_codes) || !record.totp_recovery_codes.len()) {
            throw(type = 'TOTP.InvalidCode', message = 'Invalid recovery code.');
        }

        var hashedCodes = record.totp_recovery_codes;
        var matchIndex  = 0;

        for(var i = 1; i <= hashedCodes.len(); i++) {
            if(bcrypt.checkPassword(candidate = code, BCryptHash = hashedCodes[i])) {
                matchIndex = i;
                break;
            }
        }

        if(!matchIndex) {
            throw(type = 'TOTP.InvalidCode', message = 'Invalid recovery code.');
        }

        // Consume the code - remove it so it can never be used again
        hashedCodes.deleteAt(matchIndex);

        q.from('users')
            .where('id', '=', {value: userid, cfsqltype: 'numeric'})
            .update({totp_recovery_codes: q.raw('cast(''#serializeJSON(hashedCodes)#'' as jsonb)')});

        // Invalidate user cache
        cacheStorage.clearByKeySnippet(keySnippet = 'user_#userid#');
        return;
    }

}
