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
        describe('TOTP Integration Tests', () => {
            beforeEach((currentSpec) => {
                setup();

                // Make sure nothing is logged in to start our calls
                cbauth.logout();
                jwtService.getTokenStorage().clearAll();

                // Test vars
                jwt = '';
            });

            afterEach(() => {
                // Make sure we log out any user(s) made
                cbauth.logout();
                jwtService.getTokenStorage().clearAll();

                user = null;
                jwt  = '';
            });

            describe('POST /me/2fa/setup', () => {
                beforeEach(() => {
                    user = mockUser.make();
                    jwt  = mockUser.login(user);
                    setup();
                });

                afterEach(() => {
                    mockUser.delete(user);

                    jwt = null;
                });

                it('Returns 200 with a qrCode and secret', () => {
                    var event    = post(route = '/api/v1/me/2fa/setup', headers = {'x-auth-token': jwt});
                    var response = event.getResponse();

                    expect(response.getStatusCode()).toBe(200);
                    expect(response.getData()).toHaveKey('qrCode');
                    expect(response.getData()).toHaveKey('secret');
                    expect(response.getData().qrCode).toBeString().notToBeEmpty();
                    expect(response.getData().secret).toBeString().notToBeEmpty();
                });

                it('Returns a valid Base32 secret', () => {
                    var event = post(route = '/api/v1/me/2fa/setup', headers = {'x-auth-token': jwt});

                    expect(event.getResponse().getData().secret).toMatchWithCase(
                        '^[A-Z2-7]+=*$',
                        'Secret must be a valid Base32 string'
                    );
                });

                it('Stores an encrypted secret in the database but does not enable 2FA yet', () => {
                    post(route = '/api/v1/me/2fa/setup', headers = {'x-auth-token': jwt});

                    var record = queryExecute(
                        'SELECT totp_secret, totp_enabled FROM users WHERE id = :id',
                        {id: {value: user.getId(), cfsqltype: 'integer'}},
                        {returnType: 'array'}
                    );

                    expect(record[1].totp_secret).toBeString().notToBeEmpty();
                    expect(record[1].totp_enabled).toBeFalse();
                });

                it('Returns 400 if 2FA is already enabled', () => {
                    // Setup and confirm first
                    totpHelper.setupAndConfirmTOTP(jwt);

                    // Try to setup again
                    setup();
                    var event = post(route = '/api/v1/me/2fa/setup', headers = {'x-auth-token': jwt});

                    expect(event.getResponse().getStatusCode()).toBe(400);
                    expect(event.getResponse().getError()).toBeTrue();
                });

                it('Regenerates the secret if setup is called again before confirming', () => {
                    // First setup
                    var firstEvent  = post(route = '/api/v1/me/2fa/setup', headers = {'x-auth-token': jwt});
                    var firstSecret = firstEvent.getResponse().getData().secret;

                    setup();

                    // Second setup before confirming
                    var secondEvent  = post(route = '/api/v1/me/2fa/setup', headers = {'x-auth-token': jwt});
                    var secondSecret = secondEvent.getResponse().getData().secret;

                    expect(firstSecret).notToBe(secondSecret);
                });

                it('Returns 401 when called without a token', () => {
                    var event = post(route = '/api/v1/me/2fa/setup');
                    expect(event.getResponse().getStatusCode()).toBeIn([401]);
                });
            });

            describe('POST /me/2fa/confirm', () => {
                beforeEach(() => {
                    user = mockUser.make();
                    jwt  = mockUser.login(user);

                    // Initiate setup so confirm has something to work with
                    setup();
                    var setupEvent = post(route = '/api/v1/me/2fa/setup', headers = {'x-auth-token': jwt});
                    pendingSecret  = setupEvent.getResponse().getData().secret;
                    setup();
                });

                afterEach(() => {
                    mockUser.delete(user);

                    jwt           = null;
                    pendingSecret = null;
                });

                it('Returns 200 with recovery codes when a valid code is submitted', () => {
                    var code  = getInstance('@totp').generateCode(secret = pendingSecret);
                    var event = post(
                        route   = '/api/v1/me/2fa/confirm',
                        params  = {code: code},
                        headers = {'x-auth-token': jwt}
                    );
                    var response = event.getResponse();

                    expect(response.getStatusCode()).toBe(200);
                    expect(response.getData()).toHaveKey('recoveryCodes');
                    expect(response.getData().recoveryCodes).toBeArray();
                    expect(response.getData().recoveryCodes).toHaveLength(8);
                });

                it('Returns 8 recovery codes in the correct format', () => {
                    var code  = getInstance('@totp').generateCode(secret = pendingSecret);
                    var event = post(
                        route   = '/api/v1/me/2fa/confirm',
                        params  = {code: code},
                        headers = {'x-auth-token': jwt}
                    );

                    var codes = event.getResponse().getData().recoveryCodes;
                    codes.each((recoveryCode) => {
                        expect(recoveryCode).toMatchWithCase(
                            '[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}',
                            'Recovery code must match expected format'
                        );
                    });
                });

                it('Marks totp_enabled as true in the database', () => {
                    var code = getInstance('@totp').generateCode(secret = pendingSecret);
                    post(
                        route   = '/api/v1/me/2fa/confirm',
                        params  = {code: code},
                        headers = {'x-auth-token': jwt}
                    );

                    var record = queryExecute(
                        'SELECT totp_enabled, totp_recovery_codes FROM users WHERE id = :id',
                        {id: {value: user.getId(), cfsqltype: 'integer'}},
                        {returnType: 'array'}
                    );

                    expect(record[1].totp_enabled).toBeTrue();
                    expect(record[1].totp_recovery_codes).notToBeNull();

                    var recovery_codes = deserializeJSON(record[1].totp_recovery_codes);
                    expect(recovery_codes).toBeArray();
                    expect(recovery_codes.len()).toBeGT(1);
                });

                it('Returns 400 with an invalid code', () => {
                    var event = post(
                        route   = '/api/v1/me/2fa/confirm',
                        params  = {code: '000000'},
                        headers = {'x-auth-token': jwt}
                    );

                    expect(event.getResponse().getStatusCode()).toBe(400);
                    expect(event.getResponse().getError()).toBeTrue();
                });

                it('Returns 400 if setup has not been initiated', () => {
                    // New user with no setup
                    var freshEmail = 'test_#createUUID()#@example.com';
                    var freshEvent = post(
                        route  = '/api/v1/register',
                        params = {
                            email          : freshEmail,
                            password       : createUUID(),
                            salary         : 1,
                            monthlyTakeHome: 2
                        }
                    );

                    queryExecute(
                        'UPDATE users SET verified = true, security_level = 10 WHERE email = :email',
                        {email: {value: lCase(freshEmail), cfsqltype: 'varchar'}}
                    );

                    setup();

                    var freshLoginEvent = post(
                        route  = '/api/v1/login',
                        params = {
                            email     : freshEmail,
                            password  : createUUID(),
                            rememberMe: false
                        }
                    );
                    var freshToken = freshLoginEvent.getResponse().getData().access_token;

                    setup();

                    var event = post(
                        route   = '/api/v1/me/2fa/confirm',
                        params  = {code: '123456'},
                        headers = {'x-auth-token': freshToken}
                    );

                    expect(event.getResponse().getStatusCode()).toBe(400);
                    expect(event.getResponse().getError()).toBeTrue();
                });

                it('Returns 400 if 2FA is already enabled', () => {
                    // Confirm once
                    var code = getInstance('@totp').generateCode(secret = pendingSecret);
                    post(
                        route   = '/api/v1/me/2fa/confirm',
                        params  = {code: code},
                        headers = {'x-auth-token': jwt}
                    );

                    setup();

                    // Try to confirm again
                    var event = post(
                        route   = '/api/v1/me/2fa/confirm',
                        params  = {code: getInstance('@totp').generateCode(secret = pendingSecret)},
                        headers = {'x-auth-token': jwt}
                    );

                    expect(event.getResponse().getStatusCode()).toBe(400);
                    expect(event.getResponse().getError()).toBeTrue();
                });
            });

            describe('POST /me/2fa/disable', () => {
                beforeEach(() => {
                    user = mockUser.make();
                    jwt  = mockUser.login(user);

                    // Confirm the TOTP for the user
                    var result    = totpHelper.setupAndConfirmTOTP(jwt);
                    totpSecret    = result.secret;
                    recoveryCodes = result.recoveryCodes;
                    setup();
                });

                afterEach(() => {
                    mockUser.delete(user);
                    totpSecret    = null;
                    recoveryCodes = null;
                });

                it('Returns 200 and disables 2FA with a valid TOTP code', () => {
                    var code  = getInstance('@totp').generateCode(secret = totpSecret);
                    var event = post(
                        route   = '/api/v1/me/2fa/disable',
                        params  = {code: code},
                        headers = {'x-auth-token': jwt}
                    );

                    expect(event.getResponse().getStatusCode()).toBe(200);

                    var record = queryExecute(
                        'SELECT totp_enabled, totp_secret, totp_recovery_codes FROM users WHERE id = :id',
                        {id: {value: user.getId(), cfsqltype: 'integer'}},
                        {returnType: 'array'}
                    );

                    expect(record[1].totp_enabled).toBeFalse();
                    expect(record[1].totp_secret).toBeNull();
                    expect(record[1].totp_recovery_codes).toBeNull();
                });

                it('Returns 200 and disables 2FA with a valid recovery code', () => {
                    var event = post(
                        route   = '/api/v1/me/2fa/disable',
                        params  = {code: recoveryCodes[1]},
                        headers = {'x-auth-token': jwt}
                    );

                    expect(event.getResponse().getStatusCode()).toBe(200);

                    var record = queryExecute(
                        'SELECT totp_enabled FROM users WHERE id = :id',
                        {id: {value: user.getId(), cfsqltype: 'integer'}},
                        {returnType: 'array'}
                    );

                    expect(record[1].totp_enabled).toBeFalse();
                });

                it('Returns 400 with an invalid code', () => {
                    var event = post(
                        route   = '/api/v1/me/2fa/disable',
                        params  = {code: '000000'},
                        headers = {'x-auth-token': jwt}
                    );

                    expect(event.getResponse().getStatusCode()).toBe(400);
                    expect(event.getResponse().getError()).toBeTrue();
                });

                it('Returns 400 if 2FA is not enabled', () => {
                    // Disable first
                    var code = getInstance('@totp').generateCode(secret = totpSecret);
                    post(
                        route   = '/api/v1/me/2fa/disable',
                        params  = {code: code},
                        headers = {'x-auth-token': jwt}
                    );

                    setup();

                    // Try to disable again
                    var event = post(
                        route   = '/api/v1/me/2fa/disable',
                        params  = {code: getInstance('@totp').generateCode(secret = totpSecret)},
                        headers = {'x-auth-token': jwt}
                    );

                    expect(event.getResponse().getStatusCode()).toBe(400);
                    expect(event.getResponse().getError()).toBeTrue();
                });

                it('Recovery code is consumed after use and cannot be reused', () => {
                    var recoveryCode = recoveryCodes[1];

                    // Use the recovery code to disable
                    post(
                        route   = '/api/v1/me/2fa/disable',
                        params  = {code: recoveryCode},
                        headers = {'x-auth-token': jwt}
                    );

                    // Re-enable 2FA
                    setup();
                    var setupEvent = post(route = '/api/v1/me/2fa/setup', headers = {'x-auth-token': jwt});
                    var newSecret  = setupEvent.getResponse().getData().secret;
                    var newCode    = getInstance('@totp').generateCode(secret = newSecret);

                    setup();
                    post(
                        route   = '/api/v1/me/2fa/confirm',
                        params  = {code: newCode},
                        headers = {'x-auth-token': jwt}
                    );

                    setup();

                    // Try to use the same recovery code again
                    var event = post(
                        route   = '/api/v1/me/2fa/disable',
                        params  = {code: recoveryCode},
                        headers = {'x-auth-token': jwt}
                    );

                    expect(event.getResponse().getStatusCode()).toBe(400);
                    expect(event.getResponse().getError()).toBeTrue();
                });
            });

            describe('POST /auth/verify2fa', () => {
                beforeEach(() => {
                    user = mockUser.make();
                    jwt  = mockUser.login(user);

                    // Confirm the TOTP for the user
                    var result    = totpHelper.setupAndConfirmTOTP(jwt);
                    totpSecret    = result.secret;
                    recoveryCodes = result.recoveryCodes;

                    // Login to get a pending2FA token
                    setup();
                    var loginEvent = post(
                        route  = '/api/v1/login',
                        params = {
                            email     : user.getEmail(),
                            password  : createUUID(),
                            rememberMe: false
                        }
                    );
                    var loginResponse = loginEvent.getResponse();
                    expect(loginResponse.getData()).toHaveKey('mfa_required');
                    pendingToken = loginResponse.getData().access_token;
                    setup();
                });

                afterEach(() => {
                    mockUser.delete(user);
                    totpSecret    = null;
                    recoveryCodes = null;
                    pendingToken  = null;
                });

                it('Returns 200 with a full access token when a valid TOTP code is submitted', () => {
                    var code  = getInstance('@totp').generateCode(secret = totpSecret);
                    var event = post(
                        route   = '/api/v1/verify2fa',
                        params  = {code: code},
                        headers = {'x-auth-token': pendingToken}
                    );
                    var response = event.getResponse();

                    expect(response.getStatusCode()).toBe(200);
                    expect(response.getData()).toHaveKey('access_token');
                    expect(response.getData().access_token).toBeString().notToBeEmpty();
                });

                it('Returns a full user token with correct permissions after verification', () => {
                    var code  = getInstance('@totp').generateCode(secret = totpSecret);
                    var event = post(
                        route   = '/api/v1/verify2fa',
                        params  = {code: code},
                        headers = {'x-auth-token': pendingToken}
                    );

                    var fullToken = event.getResponse().getData().access_token;
                    var payload   = getInstance('JwtService@cbsecurity').decode(fullToken);

                    expect(payload.scope).toBe('USER');
                });

                it('Returns 400 with an invalid TOTP code', () => {
                    var event = post(
                        route   = '/api/v1/verify2fa',
                        params  = {code: '000000'},
                        headers = {'x-auth-token': pendingToken}
                    );

                    expect(event.getResponse().getStatusCode()).toBe(400);
                    expect(event.getResponse().getError()).toBeTrue();
                });

                it('Returns 200 when a valid recovery code is submitted', () => {
                    var event = post(
                        route   = '/api/v1/verify2fa',
                        params  = {code: recoveryCodes[1]},
                        headers = {'x-auth-token': pendingToken}
                    );

                    expect(event.getResponse().getStatusCode()).toBe(200);
                    expect(event.getResponse().getData()).toHaveKey('access_token');
                });

                it('Cannot access User secured routes with a pending2FA token', () => {
                    var event = get(route = '/api/v1/me', headers = {'x-auth-token': pendingToken});

                    expect(event.getResponse().getStatusCode()).toBeIn([401, 403]);
                });

                it('Cannot access verify2fa with a full user token', () => {
                    var code      = getInstance('@totp').generateCode(secret = totpSecret);
                    var fullToken = post(
                        route   = '/api/v1/verify2fa',
                        params  = {code: code},
                        headers = {'x-auth-token': pendingToken}
                    ).getResponse().getData().access_token;

                    setup();

                    var event = post(
                        route   = '/api/v1/verify2fa',
                        params  = {code: getInstance('@totp').generateCode(secret = totpSecret)},
                        headers = {'x-auth-token': fullToken}
                    );

                    expect(event.getResponse().getStatusCode()).toBeIn([401, 403]);
                });

                it('Returns 401 when called without a token', () => {
                    var event = post(route = '/api/v1/verify2fa', params = {code: '123456'});

                    expect(event.getResponse().getStatusCode()).toBeIn([401, 403]);
                });
            });
        });
    }

}
