component extends="coldbox.system.testing.BaseInterceptorTest" interceptor="interceptors.apiResponse" {

    function beforeAll() {
        super.beforeAll();

        // Init inteceptor
        super.setup();

        // Mock inteceptor dependencies
        mockSecurityService = createEmptyMock(className = 'models.services.security');

        // Mock getInstance for apiResponseObj
        mockApiResponse = createEmptyMock(className = 'models.objects.apiresponseobj');
    }

    function afterAll() {
        super.afterAll();
    }

    function run() {
        describe('APIResponse Interceptor', () => {
            beforeEach(() => {
                setup();

                // Reset mocks before each test
                mockSecurityService.$reset();
                mockApiResponse.$reset();

                // Inject dependencies
                interceptor.$property(propertyName = 'securityService', mock = mockSecurityService);
                interceptor
                    .$('getInstance')
                    .$args('objects.apiresponseobj')
                    .$results(mockApiResponse);

                // Mock event and data objects
                mockRequestContext = createEmptyMock('coldbox.system.web.context.RequestContext');

                mockData   = {};
                mockBuffer = '';
                rc         = {};
                prc        = {};

                // Clear cookie scope values modified
                cookie.delete('x-auth-token');
                cookie.delete('x-refresh-token');

                // Clear request scope values modified
                request.delete('userid');
            });

            describe('preProcess()', () => {
                it('Should copy x-auth-token from cookie to rc when cookie exists and has length', () => {
                    cookie['x-auth-token'] = '  test-auth-token-12345  ';

                    interceptor.preProcess(
                        event  = mockRequestContext,
                        data   = mockData,
                        buffer = mockBuffer,
                        rc     = rc,
                        prc    = prc
                    );

                    expect(rc).toHaveKey('x-auth-token');
                    expect(rc['x-auth-token']).toBe('test-auth-token-12345');
                });

                it('Should trim whitespace from x-auth-token', () => {
                    cookie['x-auth-token'] = '   token-with-spaces   ';

                    interceptor.preProcess(
                        event  = mockRequestContext,
                        data   = mockData,
                        buffer = mockBuffer,
                        rc     = rc,
                        prc    = prc
                    );

                    expect(rc['x-auth-token']).toBe('token-with-spaces');
                    expect(rc['x-auth-token']).notToBe('   token-with-spaces   ');
                });

                it('Should not add x-auth-token to rc when cookie does not exist', () => {
                    interceptor.preProcess(
                        event  = mockRequestContext,
                        data   = mockData,
                        buffer = mockBuffer,
                        rc     = rc,
                        prc    = prc
                    );

                    expect(rc).notToHaveKey('x-auth-token');
                });

                it('Should not add x-auth-token to rc when cookie is empty string', () => {
                    cookie['x-auth-token'] = '';

                    interceptor.preProcess(
                        event  = mockRequestContext,
                        data   = mockData,
                        buffer = mockBuffer,
                        rc     = rc,
                        prc    = prc
                    );

                    expect(rc).notToHaveKey('x-auth-token');
                });

                it('Should not add x-auth-token to rc when cookie is only whitespace', () => {
                    cookie['x-auth-token'] = '   ';

                    interceptor.preProcess(
                        event  = mockRequestContext,
                        data   = mockData,
                        buffer = mockBuffer,
                        rc     = rc,
                        prc    = prc
                    );

                    expect(rc).notToHaveKey('x-auth-token');
                });

                it('Should copy x-refresh-token from cookie to rcwhen cookie exists and has length', () => {
                    cookie['x-refresh-token'] = '  test-refresh-token-67890  ';

                    interceptor.preProcess(
                        event  = mockRequestContext,
                        data   = mockData,
                        buffer = mockBuffer,
                        rc     = rc,
                        prc    = prc
                    );

                    expect(rc).toHaveKey('x-refresh-token');
                    expect(rc['x-refresh-token']).toBe('test-refresh-token-67890');
                });

                it('Should trim whitespace from x-refresh-token', () => {
                    cookie['x-refresh-token'] = '   refresh-token-with-spaces   ';

                    interceptor.preProcess(
                        event  = mockRequestContext,
                        data   = mockData,
                        buffer = mockBuffer,
                        rc     = rc,
                        prc    = prc
                    );

                    expect(rc['x-refresh-token']).toBe('refresh-token-with-spaces');
                    expect(rc['x-refresh-token']).notToBe('   refresh-token-with-spaces   ');
                });

                it('Should not add x-refresh-token to rc when cookie is empty string', () => {
                    cookie['x-refresh-token'] = '';

                    interceptor.preProcess(
                        event  = mockRequestContext,
                        data   = mockData,
                        buffer = mockBuffer,
                        rc     = rc,
                        prc    = prc
                    );

                    expect(rc).notToHaveKey('x-refresh-token');
                });

                it('Should not add x-refresh-token to rc when x-refresh-token cookie does not exist', () => {
                    cookie['x-auth-token'] = 'test-auth-token';

                    interceptor.preProcess(
                        event  = mockRequestContext,
                        data   = mockData,
                        buffer = mockBuffer,
                        rc     = rc,
                        prc    = prc
                    );

                    expect(rc).notToHaveKey('x-refresh-token');
                });

                it('Should set prc.response to apiResponseObj instance', () => {
                    interceptor.preProcess(
                        event  = mockRequestContext,
                        data   = mockData,
                        buffer = mockBuffer,
                        rc     = rc,
                        prc    = prc
                    );

                    expect(prc).toHaveKey('response');
                    expect(prc.response).toBe(mockApiResponse);
                    expect(interceptor.$once('getInstance')).toBeTrue();
                });

                it('Should set prc.response even when no cookies are present', () => {
                    interceptor.preProcess(
                        event  = mockRequestContext,
                        data   = mockData,
                        buffer = mockBuffer,
                        rc     = rc,
                        prc    = prc
                    );

                    expect(prc).toHaveKey('response');
                    expect(prc.response).toBe(mockApiResponse);
                });

                it('Should handle both tokens being present and valid', () => {
                    cookie['x-auth-token']    = 'valid-auth-token';
                    cookie['x-refresh-token'] = 'valid-refresh-token';

                    interceptor.preProcess(
                        event  = mockRequestContext,
                        data   = mockData,
                        buffer = mockBuffer,
                        rc     = rc,
                        prc    = prc
                    );

                    expect(rc).toHaveKey('x-auth-token');
                    expect(rc).toHaveKey('x-refresh-token');
                    expect(rc['x-auth-token']).toBe('valid-auth-token');
                    expect(rc['x-refresh-token']).toBe('valid-refresh-token');
                    expect(prc.response).toBe(mockApiResponse);
                });
            });

            describe('onIdentifier()', () => {
                it('Should set request.userid to authUser ID when authUser exists', () => {
                    // Mock user
                    var mockAuthUser = createStub();
                    mockAuthUser.$('getId', 12345);
                    prc.authUser = mockAuthUser;

                    interceptor.onIdentifier(
                        event  = mockRequestContext,
                        data   = mockData,
                        buffer = mockBuffer,
                        rc     = rc,
                        prc    = prc
                    );

                    // request.userid -> authUser.getId()
                    expect(request).toHaveKey('userid');
                    expect(request.userid).toBe(12345);
                });

                it('Should set request.userid to UUID when authUser does not exist', () => {
                    interceptor.onIdentifier(
                        event  = mockRequestContext,
                        data   = mockData,
                        buffer = mockBuffer,
                        rc     = rc,
                        prc    = prc
                    );

                    // No valid authuser -> random identifier assigned
                    expect(request).toHaveKey('userid');
                    expect(isValid('uuid', request.userid)).toBeTrue();
                });

                it('Should set request.userid to UUID when authUser is null', () => {
                    prc.authUser = javacast('null', '');

                    interceptor.onIdentifier(
                        event  = mockRequestContext,
                        data   = mockData,
                        buffer = mockBuffer,
                        rc     = rc,
                        prc    = prc
                    );

                    expect(request).toHaveKey('userid');
                    expect(isValid('uuid', request.userid)).toBeTrue();
                });

                it('Should create different UUIDs for different requests without authUser', () => {
                    interceptor.onIdentifier(
                        event  = mockRequestContext,
                        data   = mockData,
                        buffer = mockBuffer,
                        rc     = rc,
                        prc    = prc
                    );
                    var firstUUID = request.userid;

                    // Reset request
                    prc = {};

                    interceptor.onIdentifier(
                        event  = mockRequestContext,
                        data   = mockData,
                        buffer = mockBuffer,
                        rc     = rc,
                        prc    = prc
                    );
                    var secondUUID = request.userid;

                    expect(firstUUID).notToBe(secondUUID);
                    expect(isValid('uuid', firstUUID)).toBeTrue();
                    expect(isValid('uuid', secondUUID)).toBeTrue();
                });
            });

            describe('preEvent()', () => {
                it('Should set prc.userid to authUser ID and prc.userDir to authUser dir when authUser exists', () => {
                    // Mock user
                    var mockAuthUser = createStub();
                    mockAuthUser.$('getId', 99);
                    mockAuthUser.$('getDir', '/users/99');
                    prc.authUser = mockAuthUser;

                    interceptor.preEvent(
                        event  = mockRequestContext,
                        data   = mockData,
                        buffer = mockBuffer,
                        rc     = rc,
                        prc    = prc
                    );

                    // These auth user values populate the prc scope
                    expect(prc.userid).toBe(99);
                    expect(prc.userDir).toBe('/users/99');
                });

                it('Should set prc.userid to -1 when authUser does not exist', () => {
                    interceptor.preEvent(
                        event  = mockRequestContext,
                        data   = mockData,
                        buffer = mockBuffer,
                        rc     = rc,
                        prc    = prc
                    );

                    expect(prc.userid).toBe(-1);
                });

                it('Should set prc.userDir to empty string when authUser does not exist', () => {
                    interceptor.preEvent(
                        event  = mockRequestContext,
                        data   = mockData,
                        buffer = mockBuffer,
                        rc     = rc,
                        prc    = prc
                    );

                    expect(prc.userDir).toBe('');
                });

                it('Should set prc.userid to -1 when authUser is null', () => {
                    prc.authUser = javacast('null', '');

                    interceptor.preEvent(
                        event  = mockRequestContext,
                        data   = mockData,
                        buffer = mockBuffer,
                        rc     = rc,
                        prc    = prc
                    );

                    expect(prc.userid).toBe(-1);
                    expect(prc.userDir).toBe('');
                });
            });

            describe('postProcess()', () => {
                beforeEach(() => {
                    mockSecurityService.$('setRefreshTokenCookie');
                });

                it('Should set refresh token cookie when all conditions are met', () => {
                    prc.newTokens = {access_token: 'new-access-token-xyz', refresh_token: 'new-refresh-token-abc'};
                    rc.event      = 'cbsecurity:Jwt.refreshToken';

                    interceptor.postProcess(event = mockRequestContext, rc = rc, prc = prc);

                    expect(mockSecurityService.$once('setRefreshTokenCookie')).toBeTrue();
                    var call = mockSecurityService.$callLog().setRefreshTokenCookie[1];
                    expect(call.token).toBe('new-refresh-token-abc');
                });

                it('Should not set refresh token cookie when newTokens does not exist', () => {
                    rc.event = 'cbsecurity:Jwt.refreshToken';

                    interceptor.postProcess(event = mockRequestContext, rc = rc, prc = prc);

                    expect(mockSecurityService.$never('setRefreshTokenCookie')).toBeTrue();
                });

                it('Should not set refresh token cookie when event is not refresh token endpoint', () => {
                    prc.newTokens = {access_token: 'new-access-token', refresh_token: 'new-refresh-token'};
                    rc.event      = 'api.login';

                    interceptor.postProcess(event = mockRequestContext, rc = rc, prc = prc);

                    expect(mockSecurityService.$never('setRefreshTokenCookie')).toBeTrue();
                });

                it('Should not set refresh token cookie when access_token is missing', () => {
                    prc.newTokens = {refresh_token: 'new-refresh-token'};
                    rc.event      = 'cbsecurity:Jwt.refreshToken';

                    interceptor.postProcess(event = mockRequestContext, rc = rc, prc = prc);

                    expect(mockSecurityService.$never('setRefreshTokenCookie')).toBeTrue();
                });

                it('Should not set refresh token cookie when refresh_token is missing', () => {
                    prc.newTokens = {access_token: 'new-access-token'};
                    rc.event      = 'cbsecurity:Jwt.refreshToken';

                    interceptor.postProcess(event = mockRequestContext, rc = rc, prc = prc);

                    expect(mockSecurityService.$never('setRefreshTokenCookie')).toBeTrue();
                });

                it('Should not set refresh token cookie when newTokens is empty struct', () => {
                    prc.newTokens = {};
                    rc.event      = 'cbsecurity:Jwt.refreshToken';

                    interceptor.postProcess(event = mockRequestContext, rc = rc, prc = prc);

                    expect(mockSecurityService.$never('setRefreshTokenCookie')).toBeTrue();
                });

                it('Should not set refresh token cookie when rc.event is missing', () => {
                    prc.newTokens = {access_token: 'new-access-token', refresh_token: 'new-refresh-token'};

                    interceptor.postProcess(event = mockRequestContext, rc = rc, prc = prc);

                    expect(mockSecurityService.$never('setRefreshTokenCookie')).toBeTrue();
                });

                it('Should handle case-insensitive event name matching', () => {
                    prc.newTokens = {access_token: 'new-access-token', refresh_token: 'new-refresh-token'};
                    rc.event      = 'CBSECURITY:JWT.REFRESHTOKEN'; // Different case

                    interceptor.postProcess(event = mockRequestContext, rc = rc, prc = prc);
                    expect(mockSecurityService.$once('setRefreshTokenCookie')).toBeTrue();
                });
            });

            describe('cbSecurity_onJWTStorageRejection()', () => {
                beforeEach(() => {
                    mockSecurityService.$('deleteTokenCookies');
                });

                it('Should delete token cookies when payload indicates refresh token rejection', () => {
                    mockData.payload = {cbsecurity_refresh: true};

                    interceptor.cbSecurity_onJWTStorageRejection(
                        event  = mockRequestContext,
                        data   = mockData,
                        buffer = mockBuffer,
                        rc     = rc,
                        prc    = prc
                    );

                    expect(mockSecurityService.$once('deleteTokenCookies')).toBeTrue();
                });

                it('Should not delete token cookies when cbsecurity_refresh is false', () => {
                    mockData.payload = {cbsecurity_refresh: false};

                    interceptor.cbSecurity_onJWTStorageRejection(
                        event  = mockRequestContext,
                        data   = mockData,
                        buffer = mockBuffer,
                        rc     = rc,
                        prc    = prc
                    );

                    expect(mockSecurityService.$never('deleteTokenCookies')).toBeTrue();
                });

                it('Should not delete token cookies when payload does not exist', () => {
                    interceptor.cbSecurity_onJWTStorageRejection(
                        event  = mockRequestContext,
                        data   = mockData,
                        buffer = mockBuffer,
                        rc     = rc,
                        prc    = prc
                    );

                    expect(mockSecurityService.$never('deleteTokenCookies')).toBeTrue();
                });

                it('Should not delete token cookies when cbsecurity_refresh key does not exist', () => {
                    mockData.payload = {other_key: true};

                    interceptor.cbSecurity_onJWTStorageRejection(
                        event  = mockRequestContext,
                        data   = mockData,
                        buffer = mockBuffer,
                        rc     = rc,
                        prc    = prc
                    );

                    expect(mockSecurityService.$never('deleteTokenCookies')).toBeTrue();
                });

                it('Should not delete token cookies when data is empty struct', () => {
                    mockData = {};

                    interceptor.cbSecurity_onJWTStorageRejection(
                        event  = mockRequestContext,
                        data   = mockData,
                        buffer = mockBuffer,
                        rc     = rc,
                        prc    = prc
                    );

                    expect(mockSecurityService.$never('deleteTokenCookies')).toBeTrue();
                });

                it('Should not delete token cookies when payload is null', () => {
                    mockData.payload = javacast('null', '');

                    interceptor.cbSecurity_onJWTStorageRejection(
                        event  = mockRequestContext,
                        data   = mockData,
                        buffer = mockBuffer,
                        rc     = rc,
                        prc    = prc
                    );

                    expect(mockSecurityService.$never('deleteTokenCookies')).toBeTrue();
                });
            });

            describe('cbSecurity_onJWTExpiration()', () => {
                beforeEach(() => {
                    mockSecurityService.$('deleteTokenCookies');
                });

                it('Should delete token cookies when payload indicates refresh token expiration', () => {
                    mockData.payload = {cbsecurity_refresh: true};

                    interceptor.cbSecurity_onJWTExpiration(
                        event  = mockRequestContext,
                        data   = mockData,
                        buffer = mockBuffer,
                        rc     = rc,
                        prc    = prc
                    );

                    expect(mockSecurityService.$once('deleteTokenCookies')).toBeTrue();
                });

                it('Should not delete token cookies when cbsecurity_refresh is false', () => {
                    mockData.payload = {cbsecurity_refresh: false};

                    interceptor.cbSecurity_onJWTExpiration(
                        event  = mockRequestContext,
                        data   = mockData,
                        buffer = mockBuffer,
                        rc     = rc,
                        prc    = prc
                    );

                    expect(mockSecurityService.$never('deleteTokenCookies')).toBeTrue();
                });

                it('Should not delete token cookies when payload does not exist', () => {
                    interceptor.cbSecurity_onJWTExpiration(
                        event  = mockRequestContext,
                        data   = mockData,
                        buffer = mockBuffer,
                        rc     = rc,
                        prc    = prc
                    );

                    expect(mockSecurityService.$never('deleteTokenCookies')).toBeTrue();
                });

                it('Should not delete token cookies when cbsecurity_refresh key does not exist', () => {
                    mockData.payload = {other_key: true};

                    interceptor.cbSecurity_onJWTExpiration(
                        event  = mockRequestContext,
                        data   = mockData,
                        buffer = mockBuffer,
                        rc     = rc,
                        prc    = prc
                    );

                    expect(mockSecurityService.$never('deleteTokenCookies')).toBeTrue();
                });

                it('Should not delete token cookies when data is empty struct', () => {
                    mockData = {};

                    interceptor.cbSecurity_onJWTExpiration(
                        event  = mockRequestContext,
                        data   = mockData,
                        buffer = mockBuffer,
                        rc     = rc,
                        prc    = prc
                    );

                    expect(mockSecurityService.$never('deleteTokenCookies')).toBeTrue();
                });

                it('Should not delete token cookies when payload is null', () => {
                    mockData.payload = javacast('null', '');

                    interceptor.cbSecurity_onJWTExpiration(
                        event  = mockRequestContext,
                        data   = mockData,
                        buffer = mockBuffer,
                        rc     = rc,
                        prc    = prc
                    );

                    expect(mockSecurityService.$never('deleteTokenCookies')).toBeTrue();
                });
            });

            describe('Integration Tests', () => {
                it('Should handle complete request lifecycle with authenticated user', () => {
                    // Mock cookies and user
                    cookie['x-auth-token']    = 'valid-auth-token';
                    cookie['x-refresh-token'] = 'valid-refresh-token';

                    var mockAuthUser = createStub();
                    mockAuthUser.$('getId', 555);
                    mockAuthUser.$('getDir', '/users/555');

                    // Interceptor lifecycle

                    // preProcess
                    interceptor.preProcess(
                        event  = mockRequestContext,
                        data   = mockData,
                        buffer = mockBuffer,
                        rc     = rc,
                        prc    = prc
                    );

                    // onIdentifier
                    prc.authUser = mockAuthUser;
                    interceptor.onIdentifier(
                        event  = mockRequestContext,
                        data   = mockData,
                        buffer = mockBuffer,
                        rc     = rc,
                        prc    = prc
                    );

                    // preEvent
                    interceptor.preEvent(
                        event  = mockRequestContext,
                        data   = mockData,
                        buffer = mockBuffer,
                        rc     = rc,
                        prc    = prc
                    );

                    expect(rc['x-auth-token']).toBe('valid-auth-token');
                    expect(rc['x-refresh-token']).toBe('valid-refresh-token');
                    expect(prc.response).toBe(mockApiResponse);
                    expect(request.userid).toBe(555);
                    expect(prc.userid).toBe(555);
                    expect(prc.userDir).toBe('/users/555');
                });

                it('Should handle complete request lifecycle with unauthenticated user', () => {
                    // Interceptor lifecycle

                    // preProcess
                    interceptor.preProcess(
                        event  = mockRequestContext,
                        data   = mockData,
                        buffer = mockBuffer,
                        rc     = rc,
                        prc    = prc
                    );

                    // onIdentifier
                    interceptor.onIdentifier(
                        event  = mockRequestContext,
                        data   = mockData,
                        buffer = mockBuffer,
                        rc     = rc,
                        prc    = prc
                    );

                    // preEvent
                    interceptor.preEvent(
                        event  = mockRequestContext,
                        data   = mockData,
                        buffer = mockBuffer,
                        rc     = rc,
                        prc    = prc
                    );

                    expect(rc).notToHaveKey('x-auth-token');
                    expect(rc).notToHaveKey('x-refresh-token');
                    expect(prc.response).toBe(mockApiResponse);
                    expect(isValid('uuid', request.userid)).toBeTrue();
                    expect(prc.userid).toBe(-1);
                    expect(prc.userDir).toBe('');
                });
            });
        });
    }

}
