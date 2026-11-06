component extends="coldbox.system.testing.BaseTestCase" {

    function beforeAll() {
        super.beforeAll();

        // Mock dependencies
        mockCSRFService     = createEmptyMock('cbsecurity.modules.cbcsrf.models.cbcsrf');
        mockJwtService      = createEmptyMock('cbsecurity.models.jwt.JwtService');
        mockSecurityService = createEmptyMock('models.services.security');
        mockUserService     = createEmptyMock('models.services.user');
        mockTotpService     = createEmptyMock('models.services.totp');

        // Get the handler
        handler = createMock('handlers.auth');
    }

    function afterAll() {
        super.afterAll();
    }

    function run() {
        describe('Auth Handler', () => {
            beforeEach(() => {
                setup();

                // Reset mocks before each test
                mockCSRFService.$reset();
                mockJwtService.$reset();
                mockSecurityService.$reset();
                mockUserService.$reset();
                mockTotpService.$reset();

                // Inject mocked dependencies
                handler.$property(propertyName = 'csrfService', mock = mockCSRFService);
                handler.$property(propertyName = 'jwtService', mock = mockJwtService);
                handler.$property(propertyName = 'securityService', mock = mockSecurityService);
                handler.$property(propertyName = 'totpService', mock = mockTotpService);
                handler.$property(propertyName = 'userService', mock = mockUserService);

                // Prepare request context
                prepareMock(getRequestContext());
            });

            describe('AllowedMethods', () => {
                it('Should only allow POST for login', () => {
                    expect(handler.allowedMethods.login).toBe('POST');
                });

                it('Should only allow POST for logout', () => {
                    expect(handler.allowedMethods.logout).toBe('POST');
                });

                it('Should only allow POST for register', () => {
                    expect(handler.allowedMethods.register).toBe('POST');
                });

                it('Should only allow POST for verify', () => {
                    expect(handler.allowedMethods.verify).toBe('POST');
                });

                it('Should only allow POST for resendVerificationCode', () => {
                    expect(handler.allowedMethods.resendVerificationCode).toBe('POST');
                });

                it('Should only allow POST for verify2fa', () => {
                    expect(handler.allowedMethods.verify2fa).toBe('POST');
                });

                it('Should only allow GET for generateCSRF', () => {
                    expect(handler.allowedMethods.generateCSRF).toBe('GET');
                });
            });

            describe('login()', () => {
                it('Should successfully login with valid credentials', () => {
                    var event     = getRequestContext();
                    var mockToken = {access_token: 'test-access-token', refresh_token: 'test-refresh-token'};

                    var mockSettings = {jwt: {expiration: 60}};

                    prepareMock(event)
                        .$('getValue')
                        .$args('email')
                        .$results('test@example.com');

                    prepareMock(event)
                        .$('getValue')
                        .$args('password')
                        .$results('password123');

                    var mockUser = createEmptyMock(className = 'models.objects.userobj');
                    mockUser.$('getId', -1);
                    mockUserService.$('retrieveUserByUsername', mockUser);
                    mockUser.$('getTotp_Enabled', false);

                    mockJwtService.$('attempt', mockToken);
                    mockJwtService.$('getSettings', mockSettings);
                    mockSecurityService.$('SetRefreshTokenCookie');

                    var rc = {
                        email     : 'test@example.com',
                        password  : 'password123',
                        rememberMe: false
                    };
                    var prc = {};

                    var result = handler.login(event, rc, prc);

                    expect(mockJwtService.$once('attempt')).toBeTrue();
                    expect(mockSecurityService.$once('SetRefreshTokenCookie')).toBeFalse(); // rememberMe -> false
                });

                it('Should successfully login with valid credentials and set refresh token with rememberMe true', () => {
                    var event     = getRequestContext();
                    var mockToken = {access_token: 'test-access-token', refresh_token: 'test-refresh-token'};

                    var mockSettings = {jwt: {expiration: 60}};

                    prepareMock(event)
                        .$('getValue')
                        .$args('email')
                        .$results('test@example.com');

                    prepareMock(event)
                        .$('getValue')
                        .$args('password')
                        .$results('password123');

                    var mockUser = createEmptyMock(className = 'models.objects.userobj');
                    mockUser.$('getId', -1);
                    mockUser.$('getTotp_Enabled', false);
                    mockUserService.$('retrieveUserByUsername', mockUser);

                    mockJwtService.$('attempt', mockToken);
                    mockJwtService.$('getSettings', mockSettings);
                    mockSecurityService.$('SetRefreshTokenCookie');

                    var rc = {
                        email     : 'test@example.com',
                        password  : 'password123',
                        rememberMe: true
                    }; // rememberMe -> true
                    var prc = {};

                    var result = handler.login(event, rc, prc);

                    expect(mockJwtService.$once('attempt')).toBeTrue();
                    expect(mockSecurityService.$once('SetRefreshTokenCookie')).toBeTrue();

                    var setRefreshCall = mockSecurityService.$callLog().setRefreshTokenCookie[1];
                    expect(setRefreshCall.token).toBe('test-refresh-token');
                });

                it('Should handle VerificationException and return 403 without issuing a token', () => {
                    var event = getRequestContext();

                    var rc  = {email: 'unverified@example.com', password: 'password123'};
                    var prc = {};

                    mockJwtService.$('attempt').$throws(type = 'VerificationException', message = 'Email not verified');
                    mockUserService.$('retrieveUserByUsername');
                    mockJwtService.$('fromUser');
                    mockSecurityService.$('deleteTokenCookies');

                    var mockResponse = createStub();
                    mockResponse.$('SetData', mockResponse);
                    mockResponse.$('AddMessage', mockResponse);
                    mockResponse.$('SetStatusCode', mockResponse);

                    prepareMock(event).$('getResponse', mockResponse);

                    handler.login(event, rc, prc);

                    // No pending/unverified token is ever issued
                    expect(mockJwtService.$never('fromUser')).toBeTrue();
                    expect(mockUserService.$never('retrieveUserByUsername')).toBeTrue();
                    expect(mockResponse.$never('SetData')).toBeTrue();

                    expect(mockResponse.$once('SetStatusCode')).toBeTrue();
                    expect(mockResponse.$once('AddMessage')).toBeTrue();

                    var statusCodeCall = mockResponse.$callLog().setStatusCode[1];
                    expect(statusCodeCall[1]).toBe(403);

                    var messageCall = mockResponse.$callLog().addMessage[1];
                    expect(messageCall[1]).toInclude('verify your email');
                });

                it('Should handle invalid credentials and return 401', () => {
                    var event = getRequestContext();

                    var rc  = {email: 'wrong@example.com', password: 'wrongpassword'};
                    var prc = {};

                    mockJwtService
                        .$('attempt')
                        .$throws(type = 'InvalidCredentials', message = 'Invalid username or password');
                    mockSecurityService.$('deleteTokenCookies');

                    var mockResponse = createStub();
                    mockResponse.$('SetErrorMessage', mockResponse);
                    mockResponse.$('SetStatusCode', mockResponse);

                    prepareMock(event).$('getResponse', mockResponse);

                    handler.login(event, rc, prc);

                    expect(mockSecurityService.$once('deleteTokenCookies')).toBeTrue();
                    expect(mockResponse.$once('SetStatusCode')).toBeTrue();

                    var statusCodeCall = mockResponse.$callLog().setStatusCode[1];
                    expect(statusCodeCall[1]).toBe(401);
                });

                it('Should delete cookies and return 401 on invalid login', () => {
                    var event = getRequestContext();

                    var rc  = {email: 'test@example.com', password: 'password'};
                    var prc = {};

                    mockJwtService.$('attempt').$throws(type = 'SomeException');
                    mockSecurityService.$('deleteTokenCookies');

                    var mockResponse = createStub();
                    mockResponse.$('SetErrorMessage', mockResponse);
                    mockResponse.$('SetStatusCode', mockResponse);

                    prepareMock(event).$('getResponse', mockResponse);

                    handler.login(event, rc, prc);

                    expect(mockSecurityService.$once('deleteTokenCookies')).toBeTrue();
                    var errorCall = mockResponse.$callLog().setErrorMessage[1];
                    expect(errorCall[1]).toBe('Invalid Login.');
                });

                it('Should return access token and success message on valid login', () => {
                    var event        = getRequestContext();
                    var mockToken    = {access_token: 'valid-token', refresh_token: 'valid-refresh'};
                    var mockSettings = {jwt: {expiration: 60}};

                    var rc = {
                        email     : 'valid@example.com',
                        password  : 'validpass',
                        rememberMe: false
                    };
                    var prc = {};

                    var mockUser = createEmptyMock(className = 'models.objects.userobj');
                    mockUser.$('getId', -1);
                    mockUser.$('getTotp_Enabled', false);
                    mockUserService.$('retrieveUserByUsername', mockUser);

                    mockJwtService.$('attempt', mockToken);
                    mockJwtService.$('getSettings', mockSettings);
                    mockSecurityService.$('SetRefreshTokenCookie');

                    var mockResponse = createStub();
                    mockResponse.$('SetData', mockResponse);
                    mockResponse.$('addMessage', mockResponse);
                    mockResponse.$('SetStatusCode', mockResponse);

                    prepareMock(event).$('getResponse', mockResponse);

                    handler.login(event, rc, prc);

                    var dataCall = mockResponse.$callLog().setData[1];
                    expect(dataCall[1].access_token).toBe('valid-token');

                    var statusCall = mockResponse.$callLog().setStatusCode[1];
                    expect(statusCall[1]).toBe(200);
                });
            });

            describe('logout()', () => {
                it('Should successfully logout and invalidate tokens', () => {
                    var event = getRequestContext();
                    var rc    = {};
                    var prc   = {};

                    mockJwtService.$('logout');
                    mockSecurityService.$('deleteTokenCookies');

                    var mockResponse = createStub();
                    mockResponse.$('addMessage', mockResponse);
                    mockResponse.$('SetStatusCode', mockResponse);

                    prepareMock(event).$('getResponse', mockResponse);

                    handler.logout(event, rc, prc);

                    expect(mockJwtService.$once('logout')).toBeTrue();
                    expect(mockSecurityService.$once('deleteTokenCookies')).toBeTrue();

                    var messageCall = mockResponse.$callLog().addMessage[1];
                    expect(messageCall[1]).toBe('Successfully logged out');
                });

                it('Should revoke the refresh token from the cookie', () => {
                    var event = getRequestContext();
                    var rc    = {'x-refresh-token': 'cookie-refresh-token'};
                    var prc   = {};

                    mockJwtService.$('logout');
                    mockJwtService.$('invalidate', true);
                    mockSecurityService.$('deleteTokenCookies');

                    var mockResponse = createStub();
                    mockResponse.$('addMessage', mockResponse);
                    mockResponse.$('SetStatusCode', mockResponse);

                    prepareMock(event).$('getResponse', mockResponse);

                    handler.logout(event, rc, prc);

                    expect(mockJwtService.$once('invalidate')).toBeTrue();
                    expect(mockJwtService.$callLog().invalidate[1][1]).toBe('cookie-refresh-token');
                    expect(mockSecurityService.$once('deleteTokenCookies')).toBeTrue();
                });

                it('Should not try to revoke a refresh token when there is no cookie', () => {
                    var event = getRequestContext();
                    var rc    = {};
                    var prc   = {};

                    mockJwtService.$('logout');
                    mockJwtService.$('invalidate', true);
                    mockSecurityService.$('deleteTokenCookies');

                    var mockResponse = createStub();
                    mockResponse.$('addMessage', mockResponse);
                    mockResponse.$('SetStatusCode', mockResponse);

                    prepareMock(event).$('getResponse', mockResponse);

                    handler.logout(event, rc, prc);

                    expect(mockJwtService.$never('invalidate')).toBeTrue();
                });

                it('Should still delete the cookie when revoking the refresh token fails', () => {
                    var event = getRequestContext();
                    var rc    = {'x-refresh-token': 'cookie-refresh-token'};
                    var prc   = {};

                    mockJwtService.$('logout');
                    mockJwtService.$(
                        method         = 'invalidate',
                        throwException = true,
                        throwType      = 'InvalidateError'
                    );
                    mockSecurityService.$('deleteTokenCookies');

                    var mockResponse = createStub();
                    mockResponse.$('addMessage', mockResponse);
                    mockResponse.$('SetStatusCode', mockResponse);

                    prepareMock(event).$('getResponse', mockResponse);

                    expect(() => {
                        handler.logout(event, rc, prc);
                    }).notToThrow();
                    expect(mockSecurityService.$once('deleteTokenCookies')).toBeTrue();
                });

                it('Should handle errors gracefully during logout', () => {
                    var event = getRequestContext();
                    var rc    = {};
                    var prc   = {};

                    mockJwtService.$('logout').$throws(type = 'LogoutError');
                    mockSecurityService.$(
                        method         = 'deleteTokenCookies',
                        throwException = true,
                        throwType      = 'DeleteError'
                    );

                    var mockResponse = createStub();
                    mockResponse.$('addMessage', mockResponse);
                    mockResponse.$('SetStatusCode', mockResponse);

                    prepareMock(event).$('getResponse', mockResponse);

                    expect(() => {
                        handler.logout(event, rc, prc);
                    }).notToThrow();

                    // Still returns success message even if operations fail
                    var messageCall = mockResponse.$callLog().addMessage[1];
                    expect(messageCall[1]).toBe('Successfully logged out');
                });

                it('Should call all three cleanup methods', () => {
                    var event = getRequestContext();
                    var rc    = {};
                    var prc   = {};

                    mockJwtService.$('logout');
                    mockSecurityService.$('deleteTokenCookies');

                    var mockResponse = createStub();
                    mockResponse.$('addMessage', mockResponse);
                    mockResponse.$('SetStatusCode', mockResponse);

                    prepareMock(event).$('getResponse', mockResponse);

                    handler.logout(event, rc, prc);

                    expect(mockJwtService.$times(1, 'logout')).toBeTrue();
                    expect(mockSecurityService.$times(1, 'deleteTokenCookies')).toBeTrue();
                });
            });

            describe('verify2fa()', () => {
                it('Should issue a full token and update lastlogin after a valid code', () => {
                    var event        = getRequestContext();
                    var mockUser     = createEmptyMock(className = 'models.objects.userobj');
                    var mockToken    = {access_token: 'full-access-token', refresh_token: 'full-refresh-token'};
                    var mockSettings = {jwt: {expiration: 60}};

                    var rc  = {code: '123456'};
                    var prc = {
                        userid     : 42,
                        authUser   : createStub(),
                        jwt_payload: {rememberMe: false}
                    };

                    mockTotpService.$('verifyTOTP');
                    mockUserService.$('retrieveUserById', mockUser);
                    mockUserService.$('updateLastLogin');
                    mockJwtService.$('fromUser', mockToken);
                    mockJwtService.$('getSettings', mockSettings);
                    mockSecurityService.$('setRefreshTokenCookie');

                    var mockResponse = createStub();
                    mockResponse.$('SetData', mockResponse);
                    mockResponse.$('addMessage', mockResponse);
                    mockResponse.$('SetStatusCode', mockResponse);

                    prepareMock(event).$('getResponse', mockResponse);

                    handler.verify2fa(event, rc, prc);

                    expect(mockTotpService.$once('verifyTOTP')).toBeTrue();

                    // Login only completes here for 2FA users, so lastlogin is updated here
                    expect(mockUserService.$once('updateLastLogin')).toBeTrue();
                    expect(mockUserService.$callLog().updateLastLogin[1].userid).toBe(42);

                    // rememberMe false -> no refresh cookie
                    expect(mockSecurityService.$never('setRefreshTokenCookie')).toBeTrue();

                    var dataCall = mockResponse.$callLog().setData[1];
                    expect(dataCall[1].access_token).toBe('full-access-token');

                    var statusCall = mockResponse.$callLog().setStatusCode[1];
                    expect(statusCall[1]).toBe(200);
                });

                it('Should set the refresh token cookie when rememberMe was set at login', () => {
                    var event        = getRequestContext();
                    var mockUser     = createEmptyMock(className = 'models.objects.userobj');
                    var mockToken    = {access_token: 'full-access-token', refresh_token: 'full-refresh-token'};
                    var mockSettings = {jwt: {expiration: 60}};

                    var rc  = {code: '123456'};
                    var prc = {
                        userid     : 43,
                        authUser   : createStub(),
                        jwt_payload: {rememberMe: true}
                    };

                    mockTotpService.$('verifyTOTP');
                    mockUserService.$('retrieveUserById', mockUser);
                    mockUserService.$('updateLastLogin');
                    mockJwtService.$('fromUser', mockToken);
                    mockJwtService.$('getSettings', mockSettings);
                    mockSecurityService.$('setRefreshTokenCookie');

                    var mockResponse = createStub();
                    mockResponse.$('SetData', mockResponse);
                    mockResponse.$('addMessage', mockResponse);
                    mockResponse.$('SetStatusCode', mockResponse);

                    prepareMock(event).$('getResponse', mockResponse);

                    handler.verify2fa(event, rc, prc);

                    expect(mockSecurityService.$once('setRefreshTokenCookie')).toBeTrue();
                    expect(mockSecurityService.$callLog().setRefreshTokenCookie[1].token).toBe('full-refresh-token');
                });

                it('Should return 400 and not update lastlogin with an invalid code', () => {
                    var event = getRequestContext();

                    var rc  = {code: '000000'};
                    var prc = {
                        userid     : 44,
                        authUser   : createStub(),
                        jwt_payload: {rememberMe: false}
                    };

                    // verifyTOTP returns void, so $throws() (a callback) never fires - use throwException instead
                    mockTotpService.$(
                        method         = 'verifyTOTP',
                        throwException = true,
                        throwType      = 'TOTP.InvalidCode',
                        throwMessage   = 'Invalid code'
                    );
                    mockUserService.$('retrieveUserById');
                    mockUserService.$('updateLastLogin');
                    mockJwtService.$('fromUser');

                    var mockResponse = createStub();
                    mockResponse.$('SetErrorMessage', mockResponse);
                    mockResponse.$('SetStatusCode', mockResponse);

                    prepareMock(event).$('getResponse', mockResponse);

                    handler.verify2fa(event, rc, prc);

                    expect(mockUserService.$never('updateLastLogin')).toBeTrue();
                    expect(mockJwtService.$never('fromUser')).toBeTrue();

                    var statusCall = mockResponse.$callLog().setStatusCode[1];
                    expect(statusCall[1]).toBe(400);
                });
            });

            describe('register()', () => {
                it('Should pass the registration fields to the user service', () => {
                    var event = getRequestContext();

                    var rc = {
                        email          : 'newuser@example.com',
                        password       : 'newpassword',
                        salary         : 75000,
                        monthlyTakeHome: 5000
                    };
                    var prc = {};

                    mockUserService.$('register');

                    var mockResponse = createStub();
                    mockResponse.$('SetData', mockResponse);
                    mockResponse.$('addMessage', mockResponse);
                    mockResponse.$('SetStatusCode', mockResponse);

                    prepareMock(event).$('getResponse', mockResponse);

                    handler.register(event, rc, prc);

                    expect(mockUserService.$once('register')).toBeTrue();

                    var registerCall = mockUserService.$callLog().register[1];
                    expect(registerCall.email).toBe('newuser@example.com');
                    expect(registerCall.password).toBe('newpassword');
                    expect(registerCall.salary).toBe(75000);
                    expect(registerCall.monthlyTakeHome).toBe(5000);
                });

                it('Should return 200 with the verification message and no access token', () => {
                    var event = getRequestContext();

                    var rc = {
                        email          : 'test@test.com',
                        password       : 'password1234',
                        salary         : 50000,
                        monthlyTakeHome: 4000
                    };
                    var prc = {};

                    mockUserService.$('register');
                    mockUserService.$('retrieveUserByUsername');
                    mockJwtService.$('fromUser');

                    var mockResponse = createStub();
                    mockResponse.$('SetData', mockResponse);
                    mockResponse.$('addMessage', mockResponse);
                    mockResponse.$('SetStatusCode', mockResponse);

                    prepareMock(event).$('getResponse', mockResponse);

                    handler.register(event, rc, prc);

                    // Registration never issues a token or looks up the account
                    expect(mockJwtService.$never('fromUser')).toBeTrue();
                    expect(mockUserService.$never('retrieveUserByUsername')).toBeTrue();
                    expect(mockResponse.$never('SetData')).toBeTrue();

                    var statusCall = mockResponse.$callLog().setStatusCode[1];
                    expect(statusCall[1]).toBe(200);

                    var messageCall = mockResponse.$callLog().addMessage[1];
                    expect(messageCall[1]).toBe('Check your email for a verification code.');
                });
            });

            describe('verify()', () => {
                it('Should verify with email, password and code and return a new token', () => {
                    var event     = getRequestContext();
                    var mockUser  = createEmptyMock(className = 'models.objects.userobj');
                    var mockToken = {access_token: 'verified-access', refresh_token: 'verified-refresh'};

                    var rc = {
                        email           : 'verify@example.com',
                        password        : 'password1234',
                        verificationCode: 'ABCD2345'
                    };
                    var prc = {};

                    mockUserService.$('verifyEmail', 42);
                    mockUserService.$('retrieveUserById', mockUser);
                    mockJwtService.$('fromUser', mockToken);
                    mockSecurityService.$('setRefreshTokenCookie');

                    var mockResponse = createStub();
                    mockResponse.$('SetData', mockResponse);
                    mockResponse.$('SetStatusCode', mockResponse);
                    mockResponse.$('addMessage', mockResponse);

                    prepareMock(event).$('getResponse', mockResponse);

                    handler.verify(event, rc, prc);

                    expect(mockUserService.$once('verifyEmail')).toBeTrue();
                    var verifyCall = mockUserService.$callLog().verifyEmail[1];
                    expect(verifyCall.email).toBe('verify@example.com');
                    expect(verifyCall.password).toBe('password1234');
                    expect(verifyCall.code).toBe('ABCD2345');

                    // Token is built for the id returned by the service, not from prc
                    var retrieveCall = mockUserService.$callLog().retrieveUserById[1];
                    expect(retrieveCall.id).toBe(42);
                    expect(retrieveCall.checkPending).toBeFalse();

                    var dataCall = mockResponse.$callLog().setData[1];
                    expect(dataCall[1].access_token).toBe('verified-access');

                    expect(mockSecurityService.$once('setRefreshTokenCookie')).toBeTrue();
                    var cookieCall = mockSecurityService.$callLog().setRefreshTokenCookie[1];
                    expect(cookieCall.token).toBe('verified-refresh');

                    var statusCall = mockResponse.$callLog().setStatusCode[1];
                    expect(statusCall[1]).toBe(200);
                });

                it('Should return 400 on InvalidVerification without issuing a token', () => {
                    var event = getRequestContext();

                    var rc = {
                        email           : 'verify@example.com',
                        password        : 'password1234',
                        verificationCode: 'WRONGCDE'
                    };
                    var prc = {};

                    mockUserService
                        .$('verifyEmail')
                        .$throws(type = 'InvalidVerification', message = 'Invalid or expired verification code');
                    mockJwtService.$('fromUser');
                    mockSecurityService.$('setRefreshTokenCookie');

                    var mockResponse = createStub();
                    mockResponse.$('SetStatusCode', mockResponse);
                    mockResponse.$('SetErrorMessage', mockResponse);

                    prepareMock(event).$('getResponse', mockResponse);

                    handler.verify(event, rc, prc);

                    expect(mockJwtService.$never('fromUser')).toBeTrue();
                    expect(mockSecurityService.$never('setRefreshTokenCookie')).toBeTrue();

                    var statusCall = mockResponse.$callLog().setStatusCode[1];
                    expect(statusCall[1]).toBe(400);

                    var errorCall = mockResponse.$callLog().setErrorMessage[1];
                    expect(errorCall[1]).toBe('Invalid or expired verification code.');
                });

                it('Should return 400 on UserAlreadyVerified without issuing a token', () => {
                    var event = getRequestContext();

                    var rc = {
                        email           : 'verified@example.com',
                        password        : 'password1234',
                        verificationCode: 'ABCD2345'
                    };
                    var prc = {};

                    mockUserService.$('verifyEmail').$throws(type = 'UserAlreadyVerified', message = 'Already verified');
                    mockJwtService.$('fromUser');

                    var mockResponse = createStub();
                    mockResponse.$('SetStatusCode', mockResponse);
                    mockResponse.$('SetErrorMessage', mockResponse);

                    prepareMock(event).$('getResponse', mockResponse);

                    handler.verify(event, rc, prc);

                    expect(mockJwtService.$never('fromUser')).toBeTrue();

                    var statusCall = mockResponse.$callLog().setStatusCode[1];
                    expect(statusCall[1]).toBe(400);

                    var errorCall = mockResponse.$callLog().setErrorMessage[1];
                    expect(errorCall[1]).toBe('Account already verified. Please log in.');
                });
            });

            describe('resendVerificationCode()', () => {
                it('Should pass email and password to the user service', () => {
                    var event = getRequestContext();

                    var rc  = {email: 'resend@example.com', password: 'password1234'};
                    var prc = {};

                    mockUserService.$('resendVerificationCode', 'sent');

                    var mockResponse = createStub();
                    mockResponse.$('addMessage', mockResponse);
                    mockResponse.$('SetStatusCode', mockResponse);

                    prepareMock(event).$('getResponse', mockResponse);

                    handler.resendVerificationCode(event, rc, prc);

                    expect(mockUserService.$once('resendVerificationCode')).toBeTrue();
                    var resendCall = mockUserService.$callLog().resendVerificationCode[1];
                    expect(resendCall.email).toBe('resend@example.com');
                    expect(resendCall.password).toBe('password1234');
                });

                it('Should return 200 with the generic message when a code was sent', () => {
                    var event = getRequestContext();

                    var rc  = {email: 'resend@example.com', password: 'password1234'};
                    var prc = {};

                    mockUserService.$('resendVerificationCode', 'sent');

                    var mockResponse = createStub();
                    mockResponse.$('addMessage', mockResponse);
                    mockResponse.$('SetStatusCode', mockResponse);

                    prepareMock(event).$('getResponse', mockResponse);

                    handler.resendVerificationCode(event, rc, prc);

                    var statusCall = mockResponse.$callLog().setStatusCode[1];
                    expect(statusCall[1]).toBe(200);

                    var messageCall = mockResponse.$callLog().addMessage[1];
                    expect(messageCall[1]).toBe('If your account needs verifying, a new code has been sent.');
                });

                it('Should return the same 200 response when the request was ignored', () => {
                    var event = getRequestContext();

                    var rc  = {email: 'unknown@example.com', password: 'password1234'};
                    var prc = {};

                    mockUserService.$('resendVerificationCode', 'ignored');

                    var mockResponse = createStub();
                    mockResponse.$('addMessage', mockResponse);
                    mockResponse.$('SetStatusCode', mockResponse);

                    prepareMock(event).$('getResponse', mockResponse);

                    handler.resendVerificationCode(event, rc, prc);

                    var statusCall = mockResponse.$callLog().setStatusCode[1];
                    expect(statusCall[1]).toBe(200);

                    var messageCall = mockResponse.$callLog().addMessage[1];
                    expect(messageCall[1]).toBe('If your account needs verifying, a new code has been sent.');
                });

                it('Should return 429 only when the service reports a cooldown', () => {
                    var event = getRequestContext();

                    var rc  = {email: 'resend@example.com', password: 'password1234'};
                    var prc = {};

                    mockUserService.$('resendVerificationCode', 'cooldown');

                    var mockResponse = createStub();
                    mockResponse.$('addMessage', mockResponse);
                    mockResponse.$('SetErrorMessage', mockResponse);
                    mockResponse.$('SetStatusCode', mockResponse);

                    prepareMock(event).$('getResponse', mockResponse);

                    handler.resendVerificationCode(event, rc, prc);

                    expect(mockResponse.$never('addMessage')).toBeTrue();

                    var statusCall = mockResponse.$callLog().setStatusCode[1];
                    expect(statusCall[1]).toBe(429);

                    var errorCall = mockResponse.$callLog().setErrorMessage[1];
                    expect(errorCall[1]).toInclude('wait');
                });
            });

            describe('generateCSRF()', () => {
                it('Should generate and return CSRF token', () => {
                    var event        = getRequestContext();
                    var mockSettings = {rotationTimeout: 30};

                    var rc  = {};
                    var prc = {};

                    mockCSRFService.$('generate', 'csrf-token-12345');
                    mockCSRFService.$('getSettings', mockSettings);

                    var mockResponse = createStub();
                    mockResponse.$('SetData', mockResponse);
                    mockResponse.$('addMessage', mockResponse);
                    mockResponse.$('SetStatusCode', mockResponse);

                    prepareMock(event).$('getResponse', mockResponse);

                    handler.generateCSRF(event, rc, prc);

                    expect(mockCSRFService.$once('generate')).toBeTrue();
                    expect(prc.csrfToken).toBe('csrf-token-12345');
                });

                it('Should return CSRF token in response data', () => {
                    var event        = getRequestContext();
                    var mockSettings = {rotationTimeout: 30};

                    var rc  = {};
                    var prc = {};

                    mockCSRFService.$('generate', 'test-csrf-token');
                    mockCSRFService.$('getSettings', mockSettings);

                    var mockResponse = createStub();
                    mockResponse.$('SetData', mockResponse);
                    mockResponse.$('addMessage', mockResponse);
                    mockResponse.$('SetStatusCode', mockResponse);

                    prepareMock(event).$('getResponse', mockResponse);

                    handler.generateCSRF(event, rc, prc);

                    var dataCall = mockResponse.$callLog().setData[1];
                    expect(dataCall[1].csrf_token).toBe('test-csrf-token');
                });

                it('Should return 200 status code', () => {
                    var event        = getRequestContext();
                    var mockSettings = {rotationTimeout: 30};

                    var rc  = {};
                    var prc = {};

                    mockCSRFService.$('generate', 'token');
                    mockCSRFService.$('getSettings', mockSettings);

                    var mockResponse = createStub();
                    mockResponse.$('SetData', mockResponse);
                    mockResponse.$('addMessage', mockResponse);
                    mockResponse.$('SetStatusCode', mockResponse);

                    prepareMock(event).$('getResponse', mockResponse);

                    handler.generateCSRF(event, rc, prc);

                    var statusCall = mockResponse.$callLog().setStatusCode[1];
                    expect(statusCall[1]).toBe(200);
                });

                it('Should include expiration message with timeout from settings', () => {
                    var event        = getRequestContext();
                    var mockSettings = {rotationTimeout: 45};

                    var rc  = {};
                    var prc = {};

                    mockCSRFService.$('generate', 'token');
                    mockCSRFService.$('getSettings', mockSettings);

                    var mockResponse = createStub();
                    mockResponse.$('SetData', mockResponse);
                    mockResponse.$('addMessage', mockResponse);
                    mockResponse.$('SetStatusCode', mockResponse);

                    prepareMock(event).$('getResponse', mockResponse);

                    handler.generateCSRF(event, rc, prc);

                    var messageCall = mockResponse.$callLog().addMessage[1];
                    expect(messageCall[1]).toInclude('45 minutes');
                });

                it('Should store token in prc scope', () => {
                    var event        = getRequestContext();
                    var mockSettings = {rotationTimeout: 30};

                    var rc  = {};
                    var prc = {};

                    mockCSRFService.$('generate', 'Stored-token');
                    mockCSRFService.$('getSettings', mockSettings);

                    var mockResponse = createStub();
                    mockResponse.$('SetData', mockResponse);
                    mockResponse.$('addMessage', mockResponse);
                    mockResponse.$('SetStatusCode', mockResponse);

                    prepareMock(event).$('getResponse', mockResponse);

                    handler.generateCSRF(event, rc, prc);

                    expect(prc).toHaveKey('csrfToken');
                    expect(prc.csrfToken).toBe('Stored-token');
                });
            });
        });
    }

}
