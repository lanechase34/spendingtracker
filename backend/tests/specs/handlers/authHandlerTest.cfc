component extends="coldbox.system.testing.BaseTestCase" {

    function beforeAll() {
        super.beforeAll();

        // Mock dependencies
        mockCSRFService     = createEmptyMock('cbsecurity.modules.cbcsrf.models.cbcsrf');
        mockJwtService      = createEmptyMock('cbsecurity.models.jwt.JwtService');
        mockSecurityService = createEmptyMock('models.services.security');
        mockUserService     = createEmptyMock('models.services.user');

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

                // Inject mocked dependencies
                handler.$property(propertyName = 'csrfService', mock = mockCSRFService);
                handler.$property(propertyName = 'jwtService', mock = mockJwtService);
                handler.$property(propertyName = 'securityService', mock = mockSecurityService);
                handler.$property(propertyName = 'userService', mock = mockUserService);
                handler.$property(propertyName = 'verificationCooldown', mock = 5);

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

                it('Should only allow GET for resendVerificationCode', () => {
                    expect(handler.allowedMethods.resendVerificationCode).toBe('GET');
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

                    expect(prc.valid).toBeTrue();
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

                    expect(prc.valid).toBeTrue();
                    expect(mockJwtService.$once('attempt')).toBeTrue();
                    expect(mockSecurityService.$once('SetRefreshTokenCookie')).toBeTrue();

                    var setRefreshCall = mockSecurityService.$callLog().setRefreshTokenCookie[1];
                    expect(setRefreshCall.token).toBe('test-refresh-token');
                });

                it('Should handle VerificationException and return 403', () => {
                    var event     = getRequestContext();
                    var mockUser  = createEmptyMock(className = 'models.objects.userobj');
                    var mockToken = {access_token: 'pending-access-token'};

                    var rc  = {email: 'unverified@example.com', password: 'password123'};
                    var prc = {};

                    mockJwtService.$('attempt').$throws(type = 'VerificationException', message = 'Email not verified');
                    mockUserService.$('retrieveUserByUsername', mockUser);
                    mockJwtService.$('fromUser', mockToken);

                    var mockResponse = createStub();
                    mockResponse.$('SetData', mockResponse);
                    mockResponse.$('AddMessage', mockResponse);
                    mockResponse.$('SetStatusCode', mockResponse);

                    prepareMock(event).$('getResponse', mockResponse);

                    handler.login(event, rc, prc);

                    expect(mockUserService.$once('retrieveUserByUsername')).toBeTrue();
                    expect(mockJwtService.$once('fromUser')).toBeTrue();
                    expect(mockResponse.$once('SetStatusCode')).toBeTrue();
                    expect(mockResponse.$once('AddMessage')).toBeTrue();

                    var statusCodeCall = mockResponse.$callLog().setStatusCode[1];
                    expect(statusCodeCall[1]).toBe(403);
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

                    expect(prc.valid).toBeFalse();
                    expect(mockSecurityService.$once('deleteTokenCookies')).toBeTrue();
                    expect(mockResponse.$once('SetStatusCode')).toBeTrue();

                    var statusCodeCall = mockResponse.$callLog().setStatusCode[1];
                    expect(statusCodeCall[1]).toBe(401);
                });

                it('Should delete cookies and return 401 when prc.valid is false', () => {
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
                    mockJwtService.$('refreshToken');
                    mockSecurityService.$('deleteTokenCookies');

                    var mockResponse = createStub();
                    mockResponse.$('addMessage', mockResponse);

                    prepareMock(event).$('getResponse', mockResponse);

                    handler.logout(event, rc, prc);

                    expect(mockJwtService.$once('logout')).toBeTrue();
                    expect(mockJwtService.$once('refreshToken')).toBeTrue();
                    expect(mockSecurityService.$once('deleteTokenCookies')).toBeTrue();

                    var messageCall = mockResponse.$callLog().addMessage[1];
                    expect(messageCall[1]).toBe('Successfully logged out');
                });

                it('Should handle errors gracefully during logout', () => {
                    var event = getRequestContext();
                    var rc    = {};
                    var prc   = {};

                    mockJwtService.$('logout').$throws(type = 'LogoutError');
                    mockJwtService.$('refreshToken').$throws(type = 'RefreshError');
                    mockSecurityService.$('deleteTokenCookies').$throws(type = 'DeleteError');

                    var mockResponse = createStub();
                    mockResponse.$('addMessage', mockResponse);

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
                    mockJwtService.$('refreshToken');
                    mockSecurityService.$('deleteTokenCookies');

                    var mockResponse = createStub();
                    mockResponse.$('addMessage', mockResponse);

                    prepareMock(event).$('getResponse', mockResponse);

                    handler.logout(event, rc, prc);

                    expect(mockJwtService.$times(1, 'logout')).toBeTrue();
                    expect(mockJwtService.$times(1, 'refreshToken')).toBeTrue();
                    expect(mockSecurityService.$times(1, 'deleteTokenCookies')).toBeTrue();
                });
            });

            describe('register()', () => {
                it('Should successfully register a new user', () => {
                    var event     = getRequestContext();
                    var mockUser  = createEmptyMock(className = 'models.objects.userobj');
                    var mockToken = {access_token: 'new-user-token'};

                    var rc = {
                        email          : 'newuser@example.com',
                        password       : 'newpassword',
                        salary         : 75000,
                        monthlyTakeHome: 5000
                    };
                    var prc = {};

                    mockUserService.$('register');
                    mockUserService.$('retrieveUserByUsername', mockUser);
                    mockJwtService.$('fromUser', mockToken);

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

                it('Should return access token after registration', () => {
                    var event     = getRequestContext();
                    var mockUser  = createEmptyMock(className = 'models.objects.userobj');
                    var mockToken = {access_token: 'registration-token'};

                    var rc = {
                        email          : 'test@test.com',
                        password       : 'pass',
                        salary         : 50000,
                        monthlyTakeHome: 4000
                    };
                    var prc = {};

                    mockUserService.$('register');
                    mockUserService.$('retrieveUserByUsername', mockUser);
                    mockJwtService.$('fromUser', mockToken);

                    var mockResponse = createStub();
                    mockResponse.$('SetData', mockResponse);
                    mockResponse.$('addMessage', mockResponse);
                    mockResponse.$('SetStatusCode', mockResponse);

                    prepareMock(event).$('getResponse', mockResponse);

                    handler.register(event, rc, prc);

                    var dataCall = mockResponse.$callLog().setData[1];
                    expect(dataCall[1].access_token).toBe('registration-token');

                    var statusCall = mockResponse.$callLog().setStatusCode[1];
                    expect(statusCall[1]).toBe(200);
                });

                it('Should retrieve user after registration', () => {
                    var event     = getRequestContext();
                    var mockUser  = createEmptyMock(className = 'models.objects.userobj');
                    var mockToken = {access_token: 'token'};

                    var rc = {
                        email          : 'retrieve@test.com',
                        password       : 'pass',
                        salary         : 60000,
                        monthlyTakeHome: 4500
                    };
                    var prc = {};

                    mockUserService.$('register');
                    mockUserService.$('retrieveUserByUsername', mockUser);
                    mockJwtService.$('fromUser', mockToken);

                    var mockResponse = createStub();
                    mockResponse.$('SetData', mockResponse);
                    mockResponse.$('addMessage', mockResponse);
                    mockResponse.$('SetStatusCode', mockResponse);

                    prepareMock(event).$('getResponse', mockResponse);

                    handler.register(event, rc, prc);

                    expect(mockUserService.$once('retrieveUserByUsername')).toBeTrue();

                    var retrieveCall = mockUserService.$callLog().retrieveUserByUsername[1];
                    expect(retrieveCall[1]).toBe('retrieve@test.com');
                });

                it('Should include verification message in response', () => {
                    var event     = getRequestContext();
                    var mockUser  = createEmptyMock(className = 'models.objects.userobj');
                    var mockToken = {access_token: 'token'};

                    var rc = {
                        email          : 'user@test.com',
                        password       : 'password',
                        salary         : 70000,
                        monthlyTakeHome: 5500
                    };
                    var prc = {};

                    mockUserService.$('register');
                    mockUserService.$('retrieveUserByUsername', mockUser);
                    mockJwtService.$('fromUser', mockToken);

                    var mockResponse = createStub();
                    mockResponse.$('SetData', mockResponse);
                    mockResponse.$('addMessage', mockResponse);
                    mockResponse.$('SetStatusCode', mockResponse);

                    prepareMock(event).$('getResponse', mockResponse);

                    handler.register(event, rc, prc);

                    var messageCall = mockResponse.$callLog().addMessage[1];
                    expect(messageCall[1]).toInclude('verification code');
                });
            });

            describe('verify()', () => {
                it('Should successfully verify a user with valid code', () => {
                    var event     = getRequestContext();
                    var mockUser  = createEmptyMock(className = 'models.objects.userobj');
                    var mockToken = {access_token: 'verified-token', refresh_token: 'verified-refresh'};

                    var rc  = {verificationCode: '123456'};
                    var prc = {userid: 42};

                    mockUserService.$('findByVerificationCode', true);
                    mockUserService.$('markVerified');
                    mockUserService.$('retrieveUserById', mockUser);
                    mockJwtService.$('fromUser', mockToken);
                    mockSecurityService.$('SetRefreshTokenCookie');

                    var mockResponse = createStub();
                    mockResponse.$('SetData', mockResponse);
                    mockResponse.$('SetStatusCode', mockResponse);
                    mockResponse.$('addMessage', mockResponse);

                    prepareMock(event).$('getResponse', mockResponse);

                    handler.verify(event, rc, prc);

                    expect(mockUserService.$once('findByVerificationCode')).toBeTrue();
                    expect(mockUserService.$once('markVerified')).toBeTrue();
                    expect(mockSecurityService.$once('SetRefreshTokenCookie')).toBeTrue();

                    var statusCall = mockResponse.$callLog().setStatusCode[1];
                    expect(statusCall[1]).toBe(200);
                });

                it('Should handle UserNotFound exception', () => {
                    var event = getRequestContext();

                    var rc  = {verificationCode: 'invalid'};
                    var prc = {userid: 99};

                    mockUserService
                        .$('findByVerificationCode')
                        .$throws(type = 'UserNotFound', message = 'User not found');

                    var mockResponse = createStub();
                    mockResponse.$('SetStatusCode', mockResponse);
                    mockResponse.$('SetErrorMessage', mockResponse);

                    prepareMock(event).$('getResponse', mockResponse);

                    handler.verify(event, rc, prc);

                    var statusCall = mockResponse.$callLog().setStatusCode[1];
                    expect(statusCall[1]).toBe(400);

                    var errorCall = mockResponse.$callLog().setErrorMessage[1];
                    expect(errorCall[1]).toInclude('Invalid or expired');
                });

                it('Should handle UserAlreadyVerified exception', () => {
                    var event = getRequestContext();

                    var rc  = {verificationCode: '123456'};
                    var prc = {userid: 50};

                    mockUserService
                        .$('findByVerificationCode')
                        .$throws(type = 'UserAlreadyVerified', message = 'Already verified');

                    var mockResponse = createStub();
                    mockResponse.$('SetStatusCode', mockResponse);
                    mockResponse.$('SetErrorMessage', mockResponse);

                    prepareMock(event).$('getResponse', mockResponse);

                    handler.verify(event, rc, prc);

                    var statusCall = mockResponse.$callLog().setStatusCode[1];
                    expect(statusCall[1]).toBe(400);

                    var errorCall = mockResponse.$callLog().setErrorMessage[1];
                    expect(errorCall[1]).toInclude('already verified');
                });

                it('Should pass correct userid to findByVerificationCode', () => {
                    var event     = getRequestContext();
                    var mockUser  = createEmptyMock(className = 'models.objects.userobj');
                    var mockToken = {access_token: 'token', refresh_token: 'refresh'};

                    var rc  = {verificationCode: 'ABC123'};
                    var prc = {userid: 777};

                    mockUserService.$('findByVerificationCode', true);
                    mockUserService.$('markVerified');
                    mockUserService.$('retrieveUserById', mockUser);
                    mockJwtService.$('fromUser', mockToken);
                    mockSecurityService.$('SetRefreshTokenCookie');

                    var mockResponse = createStub();
                    mockResponse.$('SetData', mockResponse);
                    mockResponse.$('SetStatusCode', mockResponse);
                    mockResponse.$('addMessage', mockResponse);

                    prepareMock(event).$('getResponse', mockResponse);

                    handler.verify(event, rc, prc);

                    var findCall = mockUserService.$callLog().findByVerificationCode[1];
                    expect(findCall.userid).toBe(777);
                    expect(findCall.code).toBe('ABC123');
                });

                it('Should mark user as verified after code validation', () => {
                    var event     = getRequestContext();
                    var mockUser  = createEmptyMock(className = 'models.objects.userobj');
                    var mockToken = {access_token: 'token', refresh_token: 'refresh'};

                    var rc  = {verificationCode: '654321'};
                    var prc = {userid: 100};

                    mockUserService.$('findByVerificationCode', true);
                    mockUserService.$('markVerified');
                    mockUserService.$('retrieveUserById', mockUser);
                    mockUserService.$('updateLastLogin');
                    mockJwtService.$('fromUser', mockToken);
                    mockSecurityService.$('SetRefreshTokenCookie');

                    var mockResponse = createStub();
                    mockResponse.$('SetData', mockResponse);
                    mockResponse.$('SetStatusCode', mockResponse);
                    mockResponse.$('addMessage', mockResponse);

                    prepareMock(event).$('getResponse', mockResponse);

                    handler.verify(event, rc, prc);

                    var markCall = mockUserService.$callLog().markVerified[1];
                    expect(markCall.userid).toBe(100);
                });

                it('Should return new tokens after verification', () => {
                    var event     = getRequestContext();
                    var mockUser  = createEmptyMock(className = 'models.objects.userobj');
                    var mockToken = {access_token: 'new-verified-access', refresh_token: 'new-verified-refresh'};

                    var rc  = {verificationCode: '999999'};
                    var prc = {userid: 200};

                    mockUserService.$('findByVerificationCode', true);
                    mockUserService.$('markVerified');
                    mockUserService.$('retrieveUserById', mockUser);
                    mockJwtService.$('fromUser', mockToken);
                    mockSecurityService.$('SetRefreshTokenCookie');

                    var mockResponse = createStub();
                    mockResponse.$('SetData', mockResponse);
                    mockResponse.$('SetStatusCode', mockResponse);
                    mockResponse.$('addMessage', mockResponse);

                    prepareMock(event).$('getResponse', mockResponse);

                    handler.verify(event, rc, prc);

                    var dataCall = mockResponse.$callLog().setData[1];
                    expect(dataCall[1].access_token).toBe('new-verified-access');

                    var cookieCall = mockSecurityService.$callLog().setRefreshTokenCookie[1];
                    expect(cookieCall.token).toBe('new-verified-refresh');
                });
            });

            describe('resendVerificationCode()', () => {
                it('Should successfully resend verification code when cooldown has passed', () => {
                    var event        = getRequestContext();
                    var mockAuthUser = createStub();

                    // Set verification sent date to 10 minutes ago (cooldown is 5 minutes)
                    mockAuthUser.$('getVerificationSentDate', dateAdd('n', -10, now()));

                    var rc  = {};
                    var prc = {userid: 123, authUser: mockAuthUser};

                    mockUserService.$('SendVerificationCode');

                    var mockResponse = createStub();
                    mockResponse.$('addMessage', mockResponse);
                    mockResponse.$('SetStatusCode', mockResponse);

                    prepareMock(event).$('getResponse', mockResponse);

                    handler.resendVerificationCode(event, rc, prc);

                    expect(mockUserService.$once('SendVerificationCode')).toBeTrue();

                    var statusCall = mockResponse.$callLog().setStatusCode[1];
                    expect(statusCall[1]).toBe(200);

                    var messageCall = mockResponse.$callLog().addMessage[1];
                    expect(messageCall[1]).toInclude('resent');
                });

                it('Should return 429 when cooldown has not passed', () => {
                    var event        = getRequestContext();
                    var mockAuthUser = createStub();

                    // Set verification sent date to 2 minutes ago (cooldown is 5 minutes)
                    mockAuthUser.$('getVerificationSentDate', dateAdd('n', -2, now()));

                    var rc  = {};
                    var prc = {userid: 456, authUser: mockAuthUser};

                    var mockResponse = createStub();
                    mockResponse.$('SetErrorMessage', mockResponse);
                    mockResponse.$('SetStatusCode', mockResponse);

                    prepareMock(event).$('getResponse', mockResponse);

                    handler.resendVerificationCode(event, rc, prc);

                    expect(mockUserService.$never('SendVerificationCode')).toBeTrue();

                    var statusCall = mockResponse.$callLog().setStatusCode[1];
                    expect(statusCall[1]).toBe(429);

                    var errorCall = mockResponse.$callLog().setErrorMessage[1];
                    expect(errorCall[1]).toInclude('wait');
                });

                it('Should send code when verification date is null', () => {
                    var event        = getRequestContext();
                    var mockAuthUser = createStub();

                    mockAuthUser.$('getVerificationSentDate').$results(javacast('null', ''));

                    var rc  = {};
                    var prc = {userid: 789, authUser: mockAuthUser};

                    mockUserService.$('SendVerificationCode');

                    var mockResponse = createStub();
                    mockResponse.$('addMessage', mockResponse);
                    mockResponse.$('SetStatusCode', mockResponse);

                    prepareMock(event).$('getResponse', mockResponse);

                    handler.resendVerificationCode(event, rc, prc);

                    expect(mockUserService.$once('SendVerificationCode')).toBeTrue();
                });

                it('Should respect verificationCooldown setting', () => {
                    handler.$property(propertyName = 'verificationCooldown', mock = 10); // 10 minutes

                    var event        = getRequestContext();
                    var mockAuthUser = createStub();

                    // Set to 8 minutes ago - should be blocked with 10 min cooldown
                    mockAuthUser.$('getVerificationSentDate', dateAdd('n', -8, now()));

                    var rc  = {};
                    var prc = {userid: 999, authUser: mockAuthUser};

                    var mockResponse = createStub();
                    mockResponse.$('SetErrorMessage', mockResponse);
                    mockResponse.$('SetStatusCode', mockResponse);

                    prepareMock(event).$('getResponse', mockResponse);

                    handler.resendVerificationCode(event, rc, prc);

                    var statusCall = mockResponse.$callLog().setStatusCode[1];
                    expect(statusCall[1]).toBe(429);

                    // Reset
                    handler.$property(propertyName = 'verificationCooldown', mock = 5);
                });

                it('Should pass correct userid to sendVerificationCode', () => {
                    var event        = getRequestContext();
                    var mockAuthUser = createStub();

                    mockAuthUser.$('getVerificationSentDate', dateAdd('n', -20, now()));

                    var rc  = {};
                    var prc = {userid: 555, authUser: mockAuthUser};

                    mockUserService.$('SendVerificationCode');

                    var mockResponse = createStub();
                    mockResponse.$('addMessage', mockResponse);
                    mockResponse.$('setStatusCode', mockResponse);

                    prepareMock(event).$('getResponse', mockResponse);

                    handler.resendVerificationCode(event, rc, prc);

                    var sendCall = mockUserService.$callLog().sendVerificationCode[1];
                    expect(sendCall.userid).toBe(555);
                });

                it('Should handle exactly at cooldown boundary and block it still', () => {
                    var event        = getRequestContext();
                    var mockAuthUser = createStub();

                    // Exactly 5 minutes ago (exactly at cooldown)
                    mockAuthUser.$('getVerificationSentDate', dateAdd('n', -5, now()));

                    var rc  = {};
                    var prc = {userid: 111, authUser: mockAuthUser};

                    mockUserService.$('SendVerificationCode');

                    var mockResponse = createStub();
                    mockResponse.$('addMessage', mockResponse);
                    mockResponse.$('setErrorMessage', mockResponse);
                    mockResponse.$('setStatusCode', mockResponse);

                    prepareMock(event).$('getResponse', mockResponse);

                    handler.resendVerificationCode(event, rc, prc);
                    // - Should still be blocked
                    var statusCall = mockResponse.$callLog().setStatusCode[1];
                    expect(statusCall[1]).toBe(429);
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
