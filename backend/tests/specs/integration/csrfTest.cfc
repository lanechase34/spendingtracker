component extends="tests.resources.baseTest" {

    property name="jwtService" inject="JwtService@cbsecurity";
    property name="cbauth"     inject="authenticationService@cbauth";

    function beforeAll() {
        super.beforeAll();
        mockUser = getInstance('tests.resources.mockuser');

        // Make sure interceptor not in 'test' mode
        // By default, Testbox bypass this interceptor to check CSRF token on non-GET requests
        test = getInstance(dsl = 'coldbox:interceptor:VerifyCsfr@cbcsrf');
        test.setIsTestMode(false);

        testMethods = ['post', 'delete', 'put', 'patch'];

        // Make sure nothing is logged in to start our calls
        cbauth.logout();
        jwtService.getTokenStorage().clearAll();

        // Setup test user
        user = mockUser.make();
        jwt  = mockUser.login(user);
    }

    function afterAll() {
        super.afterAll();
        test.setIsTestMode(true);
        mockUser.delete(user);
    }

    function run() {
        describe('CSRF Integration Tests', () => {
            beforeEach(() => {
                setup();
            });

            it('Can login and receive a CSRF token', () => {
                var csrf = mockUser.getCSRF(jwt); // get csrf using jwt
                expect(csrf.len()).toBeGT(2);
            });

            it('Throws a TokenNotFoundException when accessing a non-GET endpoint without CSRF token', () => {
                // This should work even without the x-csrf-token key present, but the mock will fail if it's not there
                testMethods.each((method) => {
                    expect(() => {
                        this[method](route = '/api/v1/expenses', headers = {'x-auth-token': jwt, 'x-csrf-token': ''});
                    }).toThrow(type = 'TokenNotFoundException', message = 'The CSRF token was not included.');
                });
            });

            it('Throws a TokenMismatchException when accessing non-GET endpoint with invalid CSRF token', () => {
                var csrf = mockUser.getCSRF(jwt); // create CSRF

                testMethods.each((method) => {
                    expect(() => {
                        this[method](
                            route = '/api/v1/expenses', headers = {'x-auth-token': jwt, 'x-csrf-token': createUUID()}
                        );
                    }).toThrow(type = 'TokenMismatchException', message = 'The CSRF token is invalid.');
                });
            });

            it('Can access non-GET endpoint with valid CSRF token', () => {
                var csrf = mockUser.getCSRF(jwt); // create CSRF

                var event    = post(route = '/api/v1/expenses', headers = {'x-auth-token': jwt, 'x-csrf-token': csrf});
                var response = event.getResponse();

                /**
                 * Expect we failed validation for endpoint
                 */
                expect(response.getStatusCode()).toBe(400);
                expect(response.getError()).toBeTrue();
                expect(response.getMessages()[1]).toInclude('Invalid Parameters');
            });
        });
    }

}
