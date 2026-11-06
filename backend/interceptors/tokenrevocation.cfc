component extends="coldbox.system.Interceptor" hint="Reject tokens issued before the user's last password change" {

    property name="cbauth"          inject="provider:authenticationService@cbauth";
    property name="jwtService"      inject="provider:JwtService@cbsecurity";
    property name="securityService" inject="services.security";
    property name="userService"     inject="provider:services.user";

    /**
     * Runs after cbsecurity authenticates any access or refresh token
     * Changing the password sets users.password_changed_at, so every token issued up to then stops working
     *
     * By the time this runs cbsecurity has already cached the payload on prc and logged the user in,
     * and callers like the rate limiter swallow the exception - so undo all of that before throwing,
     * otherwise the firewall would trust the cached state and let the revoked token through
     */
    function cbSecurity_onJWTValidAuthentication(event, data, buffer, rc, prc) {
        var payload = data?.payload ?: {};
        if(!payload.keyExists("sub") || !payload.keyExists("iat")) {
            return;
        }

        // Always the real user - pending 2FA tokens are revoked too
        var user      = userService.retrieveUserById(id = payload.sub, checkPending = false);
        var changedAt = user.getPassword_changed_at();
        if(isNull(changedAt) || !isValid("date", changedAt)) {
            return;
        }

        // The jwt library decodes iat to a date - comparing that to an epoch would reject every token
        var issuedAt = reFind("^\d+$", payload.iat) ? payload.iat : jwtService.toEpoch(payload.iat);
        if(issuedAt > jwtService.toEpoch(changedAt)) {
            return;
        }

        if(payload?.cbsecurity_refresh ?: false) {
            securityService.deleteTokenCookies();
        }

        // Drop it from storage so any later parse in this or another request fails on its own
        if(payload.keyExists("jti")) {
            jwtService.getTokenStorage().clear(payload.jti);
        }

        // Undo what parseToken/authenticate cached for this request
        prc.delete("jwt_token");
        prc.delete("jwt_payload");
        prc.delete(jwtService.getSettings().authentication.prcUserVariable);
        cbauth.logout(quiet = true);

        throw(message = "Token was issued before the last password change", type = "TokenRejectionException");
    }

}
