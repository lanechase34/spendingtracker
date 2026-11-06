component extends="tests.resources.baseTest" {

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
        describe('GuestOnly Interceptor Integration', () => {
            beforeEach((currentSpec) => {
                setup();
                cbauth.logout();
                jwtService.getTokenStorage().clearAll();

                user = null;
                jwt  = '';
            });

            afterEach(() => {
                cbauth.logout();
                jwtService.getTokenStorage().clearAll();

                if(!isNull(user)) {
                    mockUser.delete(user);
                }

                user = null;
                jwt  = '';
            });

            describe('POST /login - guest only', () => {
                it('Allows unauthenticated users to access /login', () => {
                    var event = post(
                        route  = '/api/v1/login',
                        params = {
                            email     : 'notauser@example.com',
                            password  : 'WrongPassword!',
                            rememberMe: false
                        }
                    );

                    // 401 means it reached the handler - not blocked by interceptor
                    expect(event.getResponse().getStatusCode()).toBe(401);
                });

                it('Blocks authenticated users from accessing /login', () => {
                    user = mockUser.make();
                    jwt  = mockUser.login(user);

                    setup();

                    var event = post(
                        route  = '/api/v1/login',
                        params = {
                            email     : user.getEmail(),
                            password  : 'anything',
                            rememberMe: false
                        },
                        headers = {'x-auth-token': jwt}
                    );

                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(400);
                    expect(response.getError()).toBeTrue();
                    expect(response.getMessages()[1]).toBe('You are already authenticated.');

                    // Check the rendered data and ensure json packet
                    var renderData = event.getRenderData();

                    expect(renderData.statusCode).toBe(400);
                    expect(renderData.type).toBe('json');
                    expect(renderData.data.error).toBeTrue();
                    expect(renderData.data.messages[1]).toBe('You are already authenticated.');

                    // Handler never ran - no new token was issued
                    expect(response.getHasData()).toBeFalse();
                });

                it('Blocks authenticated users sending the token as an Authorization bearer header', () => {
                    user = mockUser.make();
                    jwt  = mockUser.login(user);

                    setup();

                    var event = post(
                        route  = '/api/v1/login',
                        params = {
                            email     : user.getEmail(),
                            password  : 'anything',
                            rememberMe: false
                        },
                        headers = {'Authorization': 'Bearer #jwt#'}
                    );

                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(400);
                    expect(response.getMessages()[1]).toBe('You are already authenticated.');
                    expect(response.getHasData()).toBeFalse();
                });
            });

            describe('Rejected tokens are treated as guests', () => {
                /**
                 * POST /login with the given token, asserting the handler ran and issued a fresh token
                 */
                var expectLoginReachesHandler = (required string token) => {
                    setup();

                    var event = post(
                        route  = '/api/v1/login',
                        params = {
                            email     : user.getEmail(),
                            password  : createUUID(),
                            rememberMe: false
                        },
                        headers = {'x-auth-token': token}
                    );

                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(200);
                    expect(response.getError()).toBeFalse();
                    expect(response.getData()).toHaveKey('access_token');
                    expect(response.getData().access_token).notToBe(token);
                };

                beforeEach(() => {
                    user = mockUser.make();
                });

                it('Allows a garbage token through to /login', () => {
                    expectLoginReachesHandler('not-a-jwt');
                });

                it('Allows a token with a tampered signature through to /login', () => {
                    jwt = mockUser.login(user);
                    cbauth.logout();

                    expectLoginReachesHandler(jwt.listSetAt(3, 'tamperedsignature', '.'));
                });

                it('Allows an expired token through to /login', () => {
                    jwt = mockUser.login(user);
                    cbauth.logout();

                    // Re-sign the same claims with an expiration in the past
                    var payload = jwtService.decode(jwt);
                    payload.exp = int(getTickCount() / 1000) - 60;

                    expectLoginReachesHandler(jwtService.encode(payload));
                });

                it('Allows a revoked (logged out) token through to /login', () => {
                    jwt = mockUser.login(user);
                    mockUser.logout(user, jwt);

                    expectLoginReachesHandler(jwt);
                });
            });

            describe('POST /register - guest only', () => {
                it('Allows unauthenticated users to access /register', () => {
                    var event = post(
                        route  = '/api/v1/register',
                        params = {
                            email          : 'test_#createUUID()#@example.com',
                            password       : 'TestPassword123!',
                            salary         : 75000,
                            monthlyTakeHome: 5000
                        }
                    );

                    // 200 means it reached the handler - not blocked by interceptor
                    expect(event.getResponse().getStatusCode()).toBe(200);
                });

                it('Blocks authenticated users from accessing /register', () => {
                    user = mockUser.make();
                    jwt  = mockUser.login(user);

                    setup();

                    var event = post(
                        route  = '/api/v1/register',
                        params = {
                            email          : 'test_#createUUID()#@example.com',
                            password       : 'TestPassword123!',
                            salary         : 75000,
                            monthlyTakeHome: 5000
                        },
                        headers = {'x-auth-token': jwt}
                    );

                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(400);
                    expect(response.getError()).toBeTrue();
                    expect(response.getMessages()[1]).toBe('You are already authenticated.');

                    // Check the rendered data and ensure json packet
                    var renderData = event.getRenderData();

                    expect(renderData.statusCode).toBe(400);
                    expect(renderData.type).toBe('json');
                    expect(renderData.data.error).toBeTrue();
                    expect(renderData.data.messages[1]).toBe('You are already authenticated.');
                });
            });

            describe('POST /verify and /resendverificationcode - guest only', () => {
                it('Allows unauthenticated users to access /verify', () => {
                    var event = post(
                        route  = '/api/v1/verify',
                        params = {
                            email           : 'nobody_#createUUID()#@example.com',
                            password        : 'TestPassword123!',
                            verificationCode: 'ABCD2345'
                        }
                    );

                    // 400 with the handler's message means it reached the handler - not blocked by interceptor
                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(400);
                    expect(response.getMessages()[1]).toBe('Invalid or expired verification code.');
                });

                it('Allows unauthenticated users to access /resendverificationcode', () => {
                    var event = post(
                        route  = '/api/v1/resendverificationcode',
                        params = {email: 'nobody_#createUUID()#@example.com', password: 'TestPassword123!'}
                    );

                    expect(event.getResponse().getStatusCode()).toBe(200);
                });

                it('Blocks authenticated users from accessing /verify', () => {
                    user = mockUser.make();
                    jwt  = mockUser.login(user);

                    setup();

                    var event = post(
                        route  = '/api/v1/verify',
                        params = {
                            email           : user.getEmail(),
                            password        : 'TestPassword123!',
                            verificationCode: 'ABCD2345'
                        },
                        headers = {'x-auth-token': jwt}
                    );

                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(400);
                    expect(response.getError()).toBeTrue();
                    expect(response.getMessages()[1]).toBe('You are already authenticated.');
                    expect(response.getHasData()).toBeFalse();
                });

                it('Blocks authenticated users from accessing /resendverificationcode', () => {
                    user = mockUser.make();
                    jwt  = mockUser.login(user);

                    setup();

                    var event = post(
                        route   = '/api/v1/resendverificationcode',
                        params  = {email: user.getEmail(), password: 'TestPassword123!'},
                        headers = {'x-auth-token': jwt}
                    );

                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(400);
                    expect(response.getError()).toBeTrue();
                    expect(response.getMessages()[1]).toBe('You are already authenticated.');
                });
            });

            describe('Non guest-only routes are unaffected', () => {
                it('Does not block authenticated users from accessing protected routes', () => {
                    user = mockUser.make();
                    jwt  = mockUser.login(user);

                    setup();

                    var event = get(route = '/api/v1/me', headers = {'x-auth-token': jwt});

                    expect(event.getResponse().getStatusCode()).toBe(200);
                });

                it('Does not affect unauthenticated requests to non guest-only routes', () => {
                    var event = get(route = '/api/v1/me');
                    expect(event.getResponse().getStatusCode()).toBeIn([401, 403]);
                });
            });
        });
    }

}
