component singleton accessors="true" {

    property name="authTokenTTL"    inject="coldbox:setting:authTokenTTL";
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
        // Collapse complex values (multi header struct) to comma separated lists
        if(!isSimpleValue(value)) {
            var items = [];
            value.each((key, item) => {
                items.append(item);
            });
            return items.toList(',').trim();
        }
        return value.trim();
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

}
