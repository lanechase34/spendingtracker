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
