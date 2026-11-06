component extends="coldbox.system.testing.BaseInterceptorTest" interceptor="interceptors.tokenrevocation" {

    function beforeAll() {
        super.beforeAll();

        // Init interceptor
        super.setup();
    }

    function afterAll() {
        super.afterAll();
    }

    /**
     * Run onJWTValidAuthentication with the given token payload
     *
     * @prc passed by reference so tests can inspect what was cleared
     */
    private function announce(required struct payload, struct prc = {}) {
        interceptor.cbSecurity_onJWTValidAuthentication(
            event  = mockRequestContext,
            data   = {payload: payload},
            buffer = '',
            rc     = {},
            prc    = prc
        );
    }

    function run() {
        describe('TokenRevocation Interceptor Unit Tests', () => {
            beforeEach(() => {
                setup();

                mockJwtService      = createStub();
                mockSecurityService = createEmptyMock('models.services.security');
                mockUserService     = createEmptyMock('models.services.user');
                mockCbauth          = createStub();
                mockTokenStorage    = createStub();
                interceptor.$property(propertyName = 'jwtService', mock = mockJwtService);
                interceptor.$property(propertyName = 'securityService', mock = mockSecurityService);
                interceptor.$property(propertyName = 'userService', mock = mockUserService);
                interceptor.$property(propertyName = 'cbauth', mock = mockCbauth);

                mockCbauth.$('logout');
                mockTokenStorage.$('clear', true);
                mockJwtService.$('getTokenStorage', mockTokenStorage);
                mockJwtService.$('getSettings', {authentication: {prcUserVariable: 'authUser'}});

                mockSecurityService.$('deleteTokenCookies');

                // Password changed at epoch 1000
                changedAt = now();
                mockJwtService.$('toEpoch', 1000);

                mockUser = createEmptyMock(className = 'models.objects.userobj');
                mockUser.$('getPassword_changed_at', changedAt);
                mockUserService.$('retrieveUserById', mockUser);
            });

            it('Can be created', () => {
                expect(interceptor).toBeComponent();
            });

            it('Allows tokens issued after the password change', () => {
                expect(() => announce({sub: 7, iat: 1001})).notToThrow();
                expect(mockSecurityService.$never('deleteTokenCookies')).toBeTrue();
            });

            it('Rejects tokens issued before the password change', () => {
                expect(() => announce({sub: 7, iat: 999})).toThrow(type = 'TokenRejectionException');
            });

            it('Rejects tokens issued in the same second as the password change', () => {
                expect(() => announce({sub: 7, iat: 1000})).toThrow(type = 'TokenRejectionException');
            });

            it('Converts a decoded date iat to epoch before comparing', () => {
                // The jwt library decodes iat to a date - a raw date vs epoch comparison would reject every token
                var issuedAt = dateAdd('s', 1, changedAt);
                mockJwtService
                    .$('toEpoch')
                    .$args(changedAt)
                    .$results(1000);
                mockJwtService
                    .$('toEpoch')
                    .$args(issuedAt)
                    .$results(1001);

                expect(() => announce({sub: 7, iat: issuedAt})).notToThrow();

                mockJwtService
                    .$('toEpoch')
                    .$args(changedAt)
                    .$results(1000);
                expect(() => announce({sub: 7, iat: changedAt})).toThrow(type = 'TokenRejectionException');
            });

            it('Loads the real user, even for pending 2FA tokens', () => {
                announce({sub: 7, iat: 1001});

                var retrieveCall = mockUserService.$callLog().retrieveUserById[1];
                expect(retrieveCall.id).toBe(7);
                expect(retrieveCall.checkPending).toBeFalse();
            });

            it('Clears the cached auth state and token storage when rejecting', () => {
                // The rate limiter swallows the exception - nothing cached may let the firewall trust the token
                var prc = {
                    jwt_token  : 'abc',
                    jwt_payload: {sub: 7},
                    authUser   : mockUser
                };

                expect(() => announce(payload = {sub: 7, iat: 999, jti: 'jti-1'}, prc = prc)).toThrow(
                    type = 'TokenRejectionException'
                );

                expect(prc).notToHaveKey('jwt_token');
                expect(prc).notToHaveKey('jwt_payload');
                expect(prc).notToHaveKey('authUser');
                expect(mockCbauth.$once('logout')).toBeTrue();
                expect(mockTokenStorage.$callLog().clear[1][1]).toBe('jti-1');
            });

            it('Leaves auth state alone for valid tokens', () => {
                var prc = {
                    jwt_token  : 'abc',
                    jwt_payload: {sub: 7},
                    authUser   : mockUser
                };

                announce(payload = {sub: 7, iat: 1001, jti: 'jti-1'}, prc = prc);

                expect(prc).toHaveKey('jwt_payload');
                expect(prc).toHaveKey('authUser');
                expect(mockCbauth.$never('logout')).toBeTrue();
                expect(mockTokenStorage.$never('clear')).toBeTrue();
            });

            it('Deletes the token cookies when rejecting a refresh token', () => {
                expect(() => announce({
                    sub               : 7,
                    iat               : 999,
                    cbsecurity_refresh: true
                })).toThrow(type = 'TokenRejectionException');
                expect(mockSecurityService.$once('deleteTokenCookies')).toBeTrue();
            });

            it('Does not delete cookies when rejecting an access token', () => {
                expect(() => announce({sub: 7, iat: 999})).toThrow(type = 'TokenRejectionException');
                expect(mockSecurityService.$never('deleteTokenCookies')).toBeTrue();
            });

            it('Allows any token when the password has never been changed', () => {
                mockUser.$('getPassword_changed_at').$results(javacast('null', ''));

                expect(() => announce({sub: 7, iat: 1})).notToThrow();
                expect(mockJwtService.$never('toEpoch')).toBeTrue();
            });

            it('Ignores payloads without sub or iat', () => {
                expect(() => announce({iat: 1})).notToThrow();
                expect(() => announce({sub: 7})).notToThrow();
                expect(mockUserService.$never('retrieveUserById')).toBeTrue();
            });
        });
    }

}
