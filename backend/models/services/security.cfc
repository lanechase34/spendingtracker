component singleton accessors="true" {

    property name="authTokenTTL"    inject="coldbox:setting:authTokenTTL";
    property name="bcrypt"          inject="provider:@BCrypt";
    property name="encryptionKey"   inject="coldbox:setting:encryptionKey";
    property name="environment"     inject="coldbox:setting:environment";
    property name="refreshTokenTTL" inject="coldbox:setting:refreshTokenTTL";

    /**
     * Return the Request's IP
     */
    public string function getRequestIP() {
        var ipAddress = '';
        if(getEnvironment() == 'production') {
            ipAddress = getHeaderValue('CF-Connecting-IP'); // cloudflare injected header
        }

        if(!ipAddress.len()) {
            ipAddress = getHeaderValue('X-Forwarded-For').listFirst().trim();
        }

        if(!ipAddress.len()) {
            ipAddress = cgi.remote_addr;
        }

        return ipAddress;
    }

    /**
     * Return the request's user agent
     */
    public string function getUserAgent() {
        return cgi?.http_user_agent ?: 'Unknown';
    }

    /**
     * Get an HTTP header value
     */
    private string function getHeaderValue(required string headername) {
        var headers = getHTTPRequestData(false).headers;
        if(!headers.keyExists(headername)) {
            return '';
        }

        var value = headers[headername];

        if(isSimpleValue(value)) {
            return value.trim();
        }

        // Collapse complex values (multi header struct) to comma separated lists
        return value
            .reduce((acc, key, item) => {
                return acc.listAppend(item);
            }, '')
            .trim();
    }

    /**
     *Sets a cookie for the JWT
     */
    public void function setAuthTokenCookie(required string token, numeric maxAge = getAuthTokenTTL()) {
        cfheader(name = "Set-Cookie", value = "x-auth-token=#token#; Path=/; Max-Age=#maxAge#; Secure; HttpOnly");
    }

    /**
     * Sets a cookie for the Refresh Token
     * Restrict cookie's path to only be used in the refresh endpoint
     */
    public void function setRefreshTokenCookie(required string token, numeric maxAge = getRefreshTokenTTL()) {
        cfheader(
            name  = "Set-Cookie",
            value = "x-refresh-token=#token#; Path=/spendingtracker/api/v1/security/refreshtoken; Max-Age=#maxAge#; Secure; HttpOnly"
        );
    }

    /**
     * Delete JWT in cookies
     * Invalidate the cookies by setting maxAge to 0
     */
    public void function deleteTokenCookies() {
        // setAuthTokenCookie(token = 'delete', maxAge = 0);
        setRefreshTokenCookie(token = 'delete', maxAge = 0);
    }

    /**
     * Encrypt a simple value (string, number) using AES
     * Numeric values are always stored as an integer to avoid floating point precision errors
     */
    public string function encryptValue(required any toEncrypt) {
        if(isNumeric(toEncrypt)) {
            // Ensure we are storing cents int
            var dollars = round(toEncrypt, 2);
            var cents   = round(dollars * 100, 0);
            toEncrypt   = toString(cents);
        }

        return encrypt(toEncrypt, getEncryptionKey(), 'AES', 'Base64');
    }

    /**
     * Decrypts an AES encrypted value back
     *
     * @toDecrypt the encrypted AES value
     * @type      string / numeric
     */
    public string function decryptValue(required string toDecrypt, string type = 'string') {
        if(!len(trim(toDecrypt))) {
            return type == 'string' ? '' : 0;
        }

        try {
            var decrypted = decrypt(toDecrypt, getEncryptionKey(), 'AES', 'Base64');

            if(type == 'numeric') {
                return int(decrypted);
            }

            return decrypted;
        }
        catch(any e) {
            return type == 'string' ? '' : 0;
        }
    }

    /**
     * Returns int value back to floating point precision
     * Use this at the very last possible moment, do all calculations using int value, then use
     * this to convert for output
     */
    public numeric function intToFloat(required numeric intVal) {
        return precisionEvaluate(intVal / 100);
    }

    /**
     * Generate salt and hashed password using bcrypt
     *
     * @return hashedPassword
     */
    public string function generateBcryptPassword(required string password) {
        var salt           = bcrypt.generateSalt();
        var hashedPassword = bcrypt.hashPassword(password = password, salt = salt);
        return hashedPassword;
    }

    /**
     * Encryption for TOTP secret
     *
     * @secret TOTP Secret
     */
    public string function encryptTOTPSecret(required string secret) {
        return encrypt(
            secret,
            getEncryptionKey(),
            'AES/CBC/PKCS5Padding',
            'Base64'
        );
    }

    /**
     * Decryption for TOTP secret
     *
     * @encryptedSecret Encrypted TOTP secret
     */
    public string function decryptTOTPSecret(required string encryptedSecret) {
        return decrypt(
            encryptedSecret,
            getEncryptionKey(),
            'AES/CBC/PKCS5Padding',
            'Base64'
        );
    }

}
