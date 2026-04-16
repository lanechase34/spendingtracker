component extends="tests.resources.baseTest" asyncAll="true" {

    property name="jwtService" inject="JwtService@cbsecurity";
    property name="cbauth"     inject="authenticationService@cbauth";

    function beforeAll() {
        super.beforeAll();
    }

    function afterAll() {
        super.afterAll();
    }

    function run() {
        describe('Registration Tests', () => {
            beforeEach((currentSpec) => {
                setup();

                // Make sure nothing is logged in to start our calls
                cbauth.logout();
                jwtService.getTokenStorage().clearAll();

                // Test vars
                testEmail    = 'test_#createUUID()#@example.com';
                testPassword = 'TestPassword123!';
                testSalary   = 75000;
                testTakeHome = 5000;
                testUserId   = -1;
            });

            afterEach(() => {
                // Make sure we log any user(s) made
                cbauth.logout();
                jwtService.getTokenStorage().clearAll();

                testUserId = -1;
            });

            describe('POST /register - invalid inputs', () => {
                it('Fails when email is missing', () => {
                    var event = post(
                        route  = '/api/v1/register',
                        params = {
                            password       : testPassword,
                            salary         : testSalary,
                            monthlyTakeHome: testTakeHome
                        }
                    );
                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBeGTE(400);
                    expect(response.getError()).toBeTrue();
                });

                it('Fails when password is missing', () => {
                    var event = post(
                        route  = '/api/v1/register',
                        params = {
                            email          : testEmail,
                            salary         : testSalary,
                            monthlyTakeHome: testTakeHome
                        }
                    );
                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBeGTE(400);
                    expect(response.getError()).toBeTrue();
                });

                it('Fails when salary is missing', () => {
                    var event = post(
                        route  = '/api/v1/register',
                        params = {
                            email          : testEmail,
                            password       : testPassword,
                            monthlyTakeHome: testTakeHome
                        }
                    );
                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBeGTE(400);
                    expect(response.getError()).toBeTrue();
                });

                it('Fails with an invalid email format', () => {
                    var event = post(
                        route  = '/api/v1/register',
                        params = {
                            email          : 'not-a-valid-email',
                            password       : testPassword,
                            salary         : testSalary,
                            monthlyTakeHome: testTakeHome
                        }
                    );
                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBeGTE(400);
                    expect(response.getError()).toBeTrue();
                });

                it('Fails when the email is already registered', () => {
                    // First registration
                    post(
                        route  = '/api/v1/register',
                        params = {
                            email          : testEmail,
                            password       : testPassword,
                            salary         : testSalary,
                            monthlyTakeHome: testTakeHome
                        }
                    );

                    setup();

                    // Duplicate attempt
                    var event = post(
                        route  = '/api/v1/register',
                        params = {
                            email          : testEmail,
                            password       : testPassword,
                            salary         : testSalary,
                            monthlyTakeHome: testTakeHome
                        }
                    );
                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBeGTE(400);
                    expect(response.getError()).toBeTrue();
                });
            });

            describe('POST /register - success', () => {
                it('Returns a 200 with an access_token', () => {
                    var event = post(
                        route  = '/api/v1/register',
                        params = {
                            email          : testEmail,
                            password       : testPassword,
                            salary         : testSalary,
                            monthlyTakeHome: testTakeHome
                        }
                    );
                    var response = event.getResponse();

                    expect(response.getStatusCode()).toBe(200);
                    expect(response.getData()).toHaveKey('access_token');
                    expect(response.getData().access_token).toBeString().notToBeEmpty();
                });

                it('Creates the user in an unverified state with security_level 0', () => {
                    post(
                        route  = '/api/v1/register',
                        params = {
                            email          : testEmail,
                            password       : testPassword,
                            salary         : testSalary,
                            monthlyTakeHome: testTakeHome
                        }
                    );

                    var record = queryExecute(
                        'SELECT verified, security_level FROM users WHERE email = :email',
                        {email: {value: lCase(testEmail), cfsqltype: 'varchar'}},
                        {returnType: 'array'}
                    );

                    expect(record).toHaveLength(1);
                    expect(record[1].verified).toBeFalse();
                    expect(record[1].security_level).toBe(0);
                });
            });

            describe('Access control while unverified', () => {
                beforeEach(() => {
                    var event = post(
                        route  = '/api/v1/register',
                        params = {
                            email          : testEmail,
                            password       : testPassword,
                            salary         : testSalary,
                            monthlyTakeHome: testTakeHome
                        }
                    );
                    storeTestUserId(testEmail);
                    unverifiedToken = event.getResponse().getData().access_token;
                    setup();
                });

                it('Cannot access User-secured routes', () => {
                    var event    = get(route = '/api/v1/me', headers = {'x-auth-token': unverifiedToken});
                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBeIn([401, 403]);
                });

                it('Can reach the /verify route (blocked by bad code, not by auth)', () => {
                    var event = post(
                        route   = '/api/v1/verify',
                        params  = {verificationCode: 'BADCODE1'},
                        headers = {'x-auth-token': unverifiedToken}
                    );
                    var response = event.getResponse();

                    // 400 = reached the handler; not blocked at the auth layer
                    expect(response.getStatusCode()).toBe(400);
                });

                it('Can reach the /resendverificationcode route', () => {
                    var event = get(
                        route   = '/api/v1/resendverificationcode',
                        headers = {'x-auth-token': unverifiedToken}
                    );
                    var response = event.getResponse();

                    // 200 = success, 429 = cooldown active - either confirms route access
                    expect(response.getStatusCode()).toBeIn([200, 429]);
                });

                it('Can access the /csrf route (secured to Unverified,User,Admin)', () => {
                    var event    = get(route = '/api/v1/csrf', headers = {'x-auth-token': unverifiedToken});
                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(200);
                    expect(response.getData()).toHaveKey('csrf_token');
                });
            });

            describe('POST /verify - invalid code', () => {
                beforeEach(() => {
                    var event = post(
                        route  = '/api/v1/register',
                        params = {
                            email          : testEmail,
                            password       : testPassword,
                            salary         : testSalary,
                            monthlyTakeHome: testTakeHome
                        }
                    );
                    storeTestUserId(testEmail);
                    unverifiedToken = event.getResponse().getData().access_token;
                    setup();
                });

                it('Returns 400 with a wrong code', () => {
                    var event = post(
                        route   = '/api/v1/verify',
                        params  = {verificationCode: 'WRONGCOD'},
                        headers = {'x-auth-token': unverifiedToken}
                    );
                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(400);
                    expect(response.getError()).toBeTrue();
                });

                it('Returns 400 with an empty code', () => {
                    var event = post(
                        route   = '/api/v1/verify',
                        params  = {verificationCode: ''},
                        headers = {'x-auth-token': unverifiedToken}
                    );
                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(400);
                    expect(response.getError()).toBeTrue();
                });

                it('Returns 400 when the code has expired', () => {
                    // Backdate verificationsentdate beyond the lifespan
                    queryExecute(
                        'UPDATE users SET verificationsentdate = :expiredDate WHERE email = :email',
                        {
                            expiredDate: {value: dateAdd('n', -9999, now()), cfsqltype: 'datetime'},
                            email      : {value: lCase(testEmail), cfsqltype: 'varchar'}
                        }
                    );

                    var event = post(
                        route   = '/api/v1/verify',
                        params  = {verificationCode: 'EXPIR3D1'},
                        headers = {'x-auth-token': unverifiedToken}
                    );
                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(400);
                    expect(response.getError()).toBeTrue();
                });
            });

            describe('POST /verify - already verified account', () => {
                it('Returns 400 with an ''already verified'' message', () => {
                    var event = post(
                        route  = '/api/v1/register',
                        params = {
                            email          : testEmail,
                            password       : testPassword,
                            salary         : testSalary,
                            monthlyTakeHome: testTakeHome
                        }
                    );
                    storeTestUserId(testEmail);
                    var token = event.getResponse().getData().access_token;

                    // Force-verify the user directly
                    queryExecute(
                        'UPDATE users SET verified = true, security_level = 10 WHERE email = :email',
                        {email: {value: lCase(testEmail), cfsqltype: 'varchar'}}
                    );

                    var verifyEvent = post(
                        route   = '/api/v1/verify',
                        params  = {verificationCode: 'ANYCODE1'},
                        headers = {'x-auth-token': token}
                    );
                    var response = verifyEvent.getResponse();
                    expect(response.getStatusCode()).toBe(400);
                    expect(response.getError()).toBeTrue();
                    expect(response.getMessages()[1]).toInclude('already verified');
                });
            });

            describe('GET /resendverificationcode', () => {
                beforeEach(() => {
                    var event = post(
                        route  = '/api/v1/register',
                        params = {
                            email          : testEmail,
                            password       : testPassword,
                            salary         : testSalary,
                            monthlyTakeHome: testTakeHome
                        }
                    );
                    storeTestUserId(testEmail);
                    unverifiedToken = event.getResponse().getData().access_token;
                    setup();
                });

                it('Returns 429 when called immediately after registration (cooldown active)', () => {
                    var event = get(
                        route   = '/api/v1/resendverificationcode',
                        headers = {'x-auth-token': unverifiedToken}
                    );
                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(429);
                    expect(response.getError()).toBeTrue();
                });

                it('Returns 200 when the cooldown period has passed', () => {
                    queryExecute(
                        'UPDATE users SET verificationsentdate = :oldDate WHERE email = :email',
                        {
                            oldDate: {value: dateAdd('n', -9999, now()), cfsqltype: 'datetime'},
                            email  : {value: lCase(testEmail), cfsqltype: 'varchar'}
                        }
                    );

                    var oldCode = queryExecute(
                        'SELECT verificationcode FROM users WHERE email = :email',
                        {email: {value: lCase(testEmail), cfsqltype: 'varchar'}}
                    ).verificationcode;

                    // Invalidate the user cache
                    getInstance('cachebox:coldboxStorage').clearByKeySnippet(keySnippet = 'user_');

                    var event = get(
                        route   = '/api/v1/resendverificationcode',
                        headers = {'x-auth-token': unverifiedToken}
                    );
                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(200);

                    var newCode = queryExecute(
                        'SELECT verificationcode FROM users WHERE email = :email',
                        {email: {value: lCase(testEmail), cfsqltype: 'varchar'}}
                    ).verificationcode;

                    expect(oldCode).notToBe(newCode);
                });

                it('Updates verificationsentdate in the database after a successful resend', () => {
                    var backdatedTime = dateAdd('n', -9999, now());
                    queryExecute(
                        'UPDATE users SET verificationsentdate = :oldDate WHERE email = :email',
                        {
                            oldDate: {value: backdatedTime, cfsqltype: 'datetime'},
                            email  : {value: lCase(testEmail), cfsqltype: 'varchar'}
                        }
                    );

                    // Invalidate the user cache
                    getInstance('cachebox:coldboxStorage').clearByKeySnippet(keySnippet = 'user_');

                    get(route = '/api/v1/resendverificationcode', headers = {'x-auth-token': unverifiedToken});

                    var record = queryExecute(
                        'SELECT verificationsentdate FROM users WHERE email = :email',
                        {email: {value: lCase(testEmail), cfsqltype: 'varchar'}},
                        {returnType: 'array'}
                    );

                    expect(record[1].verificationsentdate).toBeGT(backdatedTime);
                });
            });

            describe('POST /verify - success', () => {
                beforeEach(() => {
                    var event = post(
                        route  = '/api/v1/register',
                        params = {
                            email          : testEmail,
                            password       : testPassword,
                            salary         : testSalary,
                            monthlyTakeHome: testTakeHome
                        }
                    );
                    storeTestUserId(testEmail);
                    unverifiedToken = event.getResponse().getData().access_token;

                    // Seed a known plaintext code directly, bypassing the email
                    var bcryptService = getInstance('@BCrypt');
                    plainCode         = 'SEED1234';
                    var hashedCode    = bcryptService.hashPassword(
                        password = plainCode,
                        salt     = bcryptService.generateSalt()
                    );
                    queryExecute(
                        'UPDATE users SET verificationcode = :code, verificationsentdate = :now WHERE email = :email',
                        {
                            code : {value: hashedCode, cfsqltype: 'varchar'},
                            now  : {value: now(), cfsqltype: 'datetime'},
                            email: {value: lCase(testEmail), cfsqltype: 'varchar'}
                        }
                    );
                    setup();
                });

                it('Returns 200 with a new access_token', () => {
                    var event = post(
                        route   = '/api/v1/verify',
                        params  = {verificationCode: plainCode},
                        headers = {'x-auth-token': unverifiedToken}
                    );
                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(200);
                    expect(response.getData()).toHaveKey('access_token');
                    expect(response.getData().access_token).toBeString().notToBeEmpty();
                });

                it('Marks the user verified with security_level 10 (USER) in the database', () => {
                    post(
                        route   = '/api/v1/verify',
                        params  = {verificationCode: plainCode},
                        headers = {'x-auth-token': unverifiedToken}
                    );

                    var record = queryExecute(
                        'SELECT verified, security_level FROM users WHERE email = :email',
                        {email: {value: lCase(testEmail), cfsqltype: 'varchar'}},
                        {returnType: 'array'}
                    );
                    expect(record[1].verified).toBeTrue();
                    expect(record[1].security_level).toBe(10);
                });

                it('Grants access to User-secured routes with the returned token', () => {
                    var verifyEvent = post(
                        route   = '/api/v1/verify',
                        params  = {verificationCode: plainCode},
                        headers = {'x-auth-token': unverifiedToken}
                    );

                    var verifiedToken = verifyEvent.getResponse().getData().access_token;

                    setup();
                    var profileEvent = get(route = '/api/v1/me', headers = {'x-auth-token': verifiedToken});
                    expect(profileEvent.getResponse().getStatusCode()).toBe(200);
                });

                it('Allows access to /csrf with the returned token', () => {
                    var verifyEvent = post(
                        route   = '/api/v1/verify',
                        params  = {verificationCode: plainCode},
                        headers = {'x-auth-token': unverifiedToken}
                    );

                    var verifiedToken = verifyEvent.getResponse().getData().access_token;

                    setup();
                    var csrfEvent = get(route = '/api/v1/csrf', headers = {'x-auth-token': verifiedToken});
                    var response  = csrfEvent.getResponse();
                    expect(response.getStatusCode()).toBe(200);
                    expect(response.getData()).toHaveKey('csrf_token');
                });
            });

            describe('POST /login - during registration', () => {
                beforeEach(() => {
                    post(
                        route  = '/api/v1/register',
                        params = {
                            email          : testEmail,
                            password       : testPassword,
                            salary         : testSalary,
                            monthlyTakeHome: testTakeHome
                        }
                    );
                    storeTestUserId(testEmail);

                    // Turn off impersonation
                    var userService     = getInstance('services.user');
                    storedImpersonation = userService.getImpersonation();
                    userService.setImpersonation(false);
                    setup();
                });

                afterEach(() => {
                    getInstance('services.user').setImpersonation(storedImpersonation);
                });

                it('Returns 403 with an access_token when credentials are valid but account is unverified', () => {
                    var event = post(
                        route  = '/api/v1/login',
                        params = {
                            email     : testEmail,
                            password  : testPassword,
                            rememberMe: false
                        }
                    );
                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(403);
                    expect(response.getData()).toHaveKey('access_token');
                });

                it('Returns 401 when the password is wrong', () => {
                    var event = post(
                        route  = '/api/v1/login',
                        params = {
                            email     : testEmail,
                            password  : 'WrongPassword!',
                            rememberMe: false
                        }
                    );
                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(401);
                    expect(response.getError()).toBeTrue();
                });
            });
        });
    }

    private void function storeTestUserId(required string email) {
        var result = queryExecute(
            'SELECT id FROM users WHERE email = :email LIMIT 1',
            {email: {value: lCase(arguments.email), cfsqltype: 'varchar'}}
        );

        if(result.recordCount()) {
            testUserId = result.id;
        }
    }

}
