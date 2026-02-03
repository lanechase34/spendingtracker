component extends="tests.resources.baseTest" asyncAll="true" {

    property name="jwtService" inject="JwtService@cbsecurity";
    property name="cbauth"     inject="authenticationService@cbauth";

    function beforeAll() {
        super.beforeAll();
        mockUser = getInstance('tests.resources.mockuser');
    }

    function afterAll() {
        super.afterAll();
    }

    function run() {
        describe('Login Tests', () => {
            beforeEach((currentSpec) => {
                setup();

                // Make sure nothing is logged in to start our calls
                cbauth.logout();
                jwtService.getTokenStorage().clearAll();
            });

            afterEach(() => {
                // Make sure we log any user(s) made
                cbauth.logout();
                jwtService.getTokenStorage().clearAll();
            });

            it('Will receive a 400 with bad parameters', () => {
                expect(cbauth.isLoggedIn()).toBeFalse();
                // Login with an invalid email
                var event = post(route = '/api/v1/login', params = {email: 'notARealUser', rememberMe: false});

                var response = event.getResponse();
                expect(response.getStatusCode()).toBe(400);
                expect(response.getError()).toBeTrue();
                expect(response.getMessages()[1]).toInclude('Invalid Parameters.');
                expect(response.getMessages()[1]).toInclude('The ''email'' has an invalid type, expected type is email');
                expect(response.getMessages()[1]).toInclude('The ''password'' value is required');

                /**
                 * Still logged out
                 */
                expect(cbauth.isLoggedIn()).toBeFalse();
            })

            it('Will receive a 401 with bad credentials', () => {
                expect(cbauth.isLoggedIn()).toBeFalse();
                var event = post(
                    route  = '/api/v1/login',
                    params = {
                        email     : 'notARealUser@gmail.com',
                        password  : createUUID(),
                        rememberMe: false
                    }
                );

                var response = event.getResponse();
                expect(response.getStatusCode()).toBe(401);
                expect(response.getError()).toBeTrue();
                expect(response.getMessages()[1]).toBe('Invalid Login.');

                /**
                 * Still logged out
                 */
                expect(cbauth.isLoggedIn()).toBeFalse();
            });

            it('Will receive unauthorized error trying to access secured location', () => {
                var event = get(route = '/api/v1/expenses');

                /**
                 * Check that we have been denied
                 */
                var response = event.getResponse();
                expect(response.getStatusCode()).toBe(401);
                expect(response.getError()).toBeTrue();
                expect(response.getMessages()[1]).toInclude('Invalid access.');

                /**
                 * Check the validation results
                 */
                var cbSecure = event.getPrivateValue('cbSecurity_validatorResults');
                expect(cbSecure.allow).toBeFalse();
                expect(cbSecure.messages).toInclude('TokenNotFoundException');

                expect(cbauth.isLoggedIn()).toBeFalse();
            });

            it('Will forbid an unverified user from logging in', () => {
                var user = mockUser.make(verified = false); // unverified user
                expect(cbauth.isLoggedIn()).toBeFalse();
                var event = post(
                    route  = '/api/v1/login',
                    params = {
                        email     : user.getEmail(),
                        password  : createUUID(),
                        rememberMe: false
                    }
                );

                var response = event.getResponse();
                expect(response.getStatusCode()).toBe(403);
                expect(response.getMessages()[1]).toInclude('Please verify your email. Email is not verified.');
                expect(response.getData()).toHaveKey('access_token'); // pending JWT
                mockUser.delete(user);
            });

            it('Can login and receive a JWT and use the JWT for secured endpoint', () => {
                var user = mockUser.make();
                var jwt  = mockUser.login(user); // login and receive JWT

                /**
                 * Attempt secured route with JWT
                 */
                var event    = get(route = '/api/v1/expenses', headers = {'x-auth-token': jwt});
                var response = event.getResponse();

                /**
                 * Expect we failed validation for endpoint
                 */
                expect(response.getStatusCode()).toBe(400);
                expect(response.getError()).toBeTrue();
                expect(response.getMessages()[1]).toInclude('Invalid Parameters');
                mockUser.delete(user);
            });

            it('Can logout and invalidate JWT', () => {
                var user = mockUser.make();
                var jwt  = mockUser.login(user); // login and receive JWT

                expect(cbauth.isLoggedIn()).toBeTrue(); // logged in

                mockUser.logout(user, jwt); // logout
                expect(cbauth.isLoggedIn()).toBeFalse();

                /**
                 * Try secured endpoint and expect to receive unauthorized
                 */
                var event = get(route = '/api/v1/expenses', headers = {'x-auth-token': jwt});

                var response = event.getResponse();
                expect(response.getStatusCode()).toBe(401);
                expect(response.getError()).toBeTrue();
                expect(response.getMessages()[1]).toInclude('Invalid access.');

                var cbSecure = event.getPrivateValue('cbSecurity_validatorResults');
                expect(cbSecure.allow).toBeFalse();
                mockUser.delete(user);
            });

            it('Will block invalid refresh token request', () => {
                var event    = post(route = '/api/v1/security/refreshtoken');
                var response = event.getResponse();
                expect(response.getStatusCode()).toBe(400);
                expect(response.getError()).toBeTrue();
                expect(response.getMessages()[1]).toInclude('The refresh token was not passed via the header or the rc. Cannot refresh the unrefreshable!');
            });
        });
    }

}
