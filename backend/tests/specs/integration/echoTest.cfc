component extends="tests.resources.baseTest" asyncAll="true" {

    function beforeAll() {
        super.beforeAll();

        mockUser = getInstance('tests.resources.mockuser');

        /**
         * Setup user to be shared throughout the test suite
         */
        user = mockUser.make();
        jwt  = mockUser.login(user);
    }

    function afterAll() {
        super.afterAll();

        setup();
        mockUser.logout(user, jwt);
        mockUser.delete(user);
    }

    function run() {
        describe('Echo Endpoints', () => {
            beforeEach(() => {
                setup();
            });

            describe('GET /healthcheck (root level)', () => {
                it('Returns 200 with Ok data', () => {
                    var event    = get(route = '/healthcheck');
                    var response = event.getResponse();

                    expect(response.getStatusCode()).toBe(200);
                    expect(response.getData()).toBe('Ok!');
                });

                it('Does not require authentication', () => {
                    var event    = get(route = '/healthcheck');
                    var response = event.getResponse();

                    expect(response.getStatusCode()).toBe(200);
                    expect(response.getError()).toBeFalse();
                });
            });

            describe('GET /api/v1/healthcheck', () => {
                it('Returns 200 with Ok data', () => {
                    var event    = get(route = '/api/v1/healthcheck');
                    var response = event.getResponse();

                    expect(response.getStatusCode()).toBe(200);
                    expect(response.getData()).toBe('Ok!');
                });

                it('Does not require authentication', () => {
                    var event    = get(route = '/api/v1/healthcheck');
                    var response = event.getResponse();

                    expect(response.getStatusCode()).toBe(200);
                    expect(response.getError()).toBeFalse();
                });
            });

            describe('GET /api/v1/status', () => {
                it('Returns 200 with environment, version, and status keys', () => {
                    var event    = get(route = '/api/v1/status');
                    var response = event.getResponse();

                    expect(response.getStatusCode()).toBe(200);
                    expect(response.getData()).toHaveKey('environment');
                    expect(response.getData()).toHaveKey('version');
                    expect(response.getData()).toHaveKey('status');
                });

                it('Returns status value of ok', () => {
                    var event    = get(route = '/api/v1/status');
                    var response = event.getResponse();

                    expect(response.getData().status).toBe('ok');
                });

                it('Returns a recognized environment value', () => {
                    var event    = get(route = '/api/v1/status');
                    var response = event.getResponse();

                    expect(response.getData().environment).toBeIn(['development', 'staging', 'production']);
                });

                it('Does not require authentication', () => {
                    var event    = get(route = '/api/v1/status');
                    var response = event.getResponse();

                    expect(response.getStatusCode()).toBe(200);
                    expect(response.getError()).toBeFalse();
                });
            });

            describe('GET /unauthorized (root level)', () => {
                it('Returns 401 with an error message', () => {
                    var event    = get(route = '/unauthorized');
                    var response = event.getResponse();

                    expect(response.getStatusCode()).toBe(401);
                    expect(response.getError()).toBeTrue();
                    expect(response.getMessages()[1]).toInclude('Invalid access.');
                });
            });

            describe('GET /api/v1/unauthorized', () => {
                it('Returns 401 with an error message', () => {
                    var event    = get(route = '/api/v1/unauthorized');
                    var response = event.getResponse();

                    expect(response.getStatusCode()).toBe(401);
                    expect(response.getError()).toBeTrue();
                    expect(response.getMessages()[1]).toInclude('Invalid access.');
                });

                it('Does not require authentication to reach', () => {
                    var event    = get(route = '/api/v1/unauthorized');
                    var response = event.getResponse();

                    // Should reach the handler and return 401, not be blocked before it
                    expect(response.getStatusCode()).toBe(401);
                });
            });

            describe('Wildcard / unknown routes', () => {
                it('Returns 200 for an unknown route under /api/v1 (falls through to healthcheck)', () => {
                    var event    = get(route = '/api/v1/thisdoesnotexist');
                    var response = event.getResponse();

                    // Wildcard routes to echo.healthCheck which returns 200
                    expect(response.getStatusCode()).toBe(200);
                });

                it('Returns 200 for a completely unknown root-level route', () => {
                    var event    = get(route = '/thisdoesnotexist');
                    var response = event.getResponse();

                    expect(response.getStatusCode()).toBe(200);
                });
            });

            describe('Invalid HTTP methods', () => {
                it('Returns 405 when using GET on a POST-only route', () => {
                    var event    = get(route = '/api/v1/login');
                    var response = event.getResponse();

                    expect(response.getStatusCode()).toBe(405);
                    expect(response.getError()).toBeTrue();
                    expect(response.getMessages()[1]).toInclude('InvalidHTTPMethod Execution');
                });

                it('Returns 405 when using POST on a GET-only route', () => {
                    var event    = post(route = '/api/v1/me');
                    var response = event.getResponse();

                    expect(response.getStatusCode()).toBe(405);
                    expect(response.getError()).toBeTrue();
                    expect(response.getMessages()[1]).toInclude('InvalidHTTPMethod Execution');
                });

                it('Returns 405 when using DELETE on a non-DELETE route', () => {
                    var event    = delete(route = '/api/v1/login');
                    var response = event.getResponse();

                    expect(response.getStatusCode()).toBe(405);
                    expect(response.getError()).toBeTrue();
                });
            });

            describe('GET /warmup', () => {
                it('Returns 200 regardless of warmed up state', () => {
                    var event    = get(route = '/warmup');
                    var response = event.getResponse();

                    expect(response.getStatusCode()).toBe(200);
                });

                it('Returns Ok! message when already warmed up', () => {
                    // Force warmedUp = true so it hits the else branch
                    application.cbController.setSetting('warmedUp', true);

                    var event    = get(route = '/warmup');
                    var response = event.getResponse();

                    expect(response.getStatusCode()).toBe(200);
                    expect(response.getMessages()[1]).toBe('Ok!');
                });
            });

            describe('onException - CSRF token errors', () => {
                it('Returns 403 when a TokenNotFoundException is thrown', () => {
                    // Force the exception into prc so onException can read it
                    var prc       = getRequestContext().getPrivateCollection();
                    prc.exception = createObject('component', 'coldbox.system.web.context.ExceptionBean').init(
                        errorStruct = {type: 'TokenNotFoundException', message: 'The CSRF token was not included.'}
                    );

                    var event    = execute(event = 'echo.onException');
                    var response = event.getResponse();

                    expect(response.getStatusCode()).toBe(403);
                    expect(response.getError()).toBeTrue();
                    expect(response.getMessages()[1]).toInclude('Missing or invalid CSRF token.');
                });

                it('Returns 403 when a TokenMismatchException is thrown', () => {
                    var prc       = getRequestContext().getPrivateCollection();
                    prc.exception = createObject('component', 'coldbox.system.web.context.ExceptionBean').init(
                        errorStruct = {type: 'TokenMismatchException', message: 'The CSRF token does not match.'}
                    );

                    var event    = execute(event = 'echo.onException');
                    var response = event.getResponse();

                    expect(response.getStatusCode()).toBe(403);
                    expect(response.getError()).toBeTrue();
                    expect(response.getMessages()[1]).toInclude('Missing or invalid CSRF token.');
                });

                it('Returns 500 for a generic unhandled exception', () => {
                    var prc       = getRequestContext().getPrivateCollection();
                    prc.exception = createObject('component', 'coldbox.system.web.context.ExceptionBean').init(
                        errorStruct = {type: 'Application', message: 'Something went wrong.'}
                    );

                    var event    = execute(event = 'echo.onException');
                    var response = event.getResponse();

                    expect(response.getStatusCode()).toBe(500);
                    expect(response.getError()).toBeTrue();
                    expect(response.getMessages()[1]).toInclude('An exception ocurred please try again.');
                });
            });
        });
    }

}
