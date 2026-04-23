component extends="coldbox.system.testing.BaseInterceptorTest" interceptor="interceptors.ratelimiter" {

    function beforeAll() {
        super.beforeAll();

        // Init inteceptor
        super.setup();

        // Mock interceptor dependencies
        mockSecurityService  = createEmptyMock(className = 'models.services.security');
        mockRateLimitService = createEmptyMock(className = 'models.services.ratelimit');
    }

    function afterAll() {
        super.afterAll();
    }

    function run() {
        describe('RateLimiter Interceptor', () => {
            beforeEach(() => {
                setup();

                // Reset mocks before each test
                mockSecurityService.$reset();
                mockSecurityService.$('getRequestIP', 'mockIP');

                mockRateLimitService.$reset();
                mockRateLimitService.$('hit', false);

                // Inject dependencies
                interceptor.$property(propertyName = 'securityService', mock = mockSecurityService);
                interceptor.$property(propertyName = 'rateLimitService', mock = mockRateLimitService);

                // Mock event and data objects
                mockRequestContext = createEmptyMock('coldbox.system.web.context.RequestContext');
                mockRequestContext.$('getCurrentEvent', 'mock.event');
                mockRequestContext.$('renderData');
                mockRequestContext.$('noExecution');

                mockData   = {};
                mockBuffer = '';
                rc         = {};
                prc        = {};
            });

            it('Can be created', () => {
                expect(interceptor).toBeComponent();
            });

            it('Should skip rate limiting when useRateLimiter is false', () => {
                interceptor.$property(propertyName = 'useRateLimiter', mock = false);
                expect(interceptor.$getProperty('useRateLimiter')).toBeFalse();

                interceptor.preProcess(
                    event  = mockRequestContext,
                    data   = mockData,
                    buffer = mockBuffer,
                    rc     = rc,
                    prc    = prc
                );

                // Expect to return early since we have the rateLimiter off
                expect(mockRequestContext.$never('getCurrentEvent')).toBeTrue();
            });

            it('Should skip rate limiting when current event has no rate limit configured', () => {
                interceptor.$property(propertyName = 'useRateLimiter', mock = true);
                interceptor.$property(propertyName = 'settings', mock = {});
                expect(interceptor.$getProperty('useRateLimiter')).toBeTrue();

                interceptor.preProcess(
                    event  = mockRequestContext,
                    data   = mockData,
                    buffer = mockBuffer,
                    rc     = rc,
                    prc    = prc
                );

                // Expect to return early since no rate limit in place for the mock event
                expect(mockSecurityService.$never('getRequestIP')).toBeTrue();
            });

            it('Should skip rate limiting when key cannot be built', () => {
                interceptor.$property(propertyName = 'useRateLimiter', mock = true);
                interceptor.$property(
                    propertyName = 'settings',
                    mock         = {'api.login': {key: 'ip', limit: 5, window: 60}}
                );
                mockRequestContext.$('getCurrentEvent', 'api.login');
                mockSecurityService.$('getRequestIP', '192.168.1.1');
                mockRateLimitService.$('buildKey', '');

                interceptor.preProcess(
                    event  = mockRequestContext,
                    data   = mockData,
                    buffer = mockBuffer,
                    rc     = rc,
                    prc    = prc
                );

                // Expect to return early since the key was an empty string
                expect(mockSecurityService.$once('getRequestIP')).toBeTrue();
                expect(mockRateLimitService.$once('buildKey')).toBeTrue();
                expect(mockRateLimitService.$never('hit')).toBeTrue();
            });

            it('Should allow request when rate limit is not exceeded', () => {
                interceptor.$property(propertyName = 'useRateLimiter', mock = true);
                interceptor.$property(
                    propertyName = 'settings',
                    mock         = {'api.login': {key: 'ip', limit: 5, window: 60}}
                );
                mockRequestContext.$('getCurrentEvent', 'api.login');
                mockSecurityService.$('getRequestIP', '192.168.1.1');
                mockRateLimitService.$('buildKey', '192.168.1.1');
                mockRateLimitService.$('hit', true);

                interceptor.preProcess(
                    event  = mockRequestContext,
                    data   = mockData,
                    buffer = mockBuffer,
                    rc     = rc,
                    prc    = prc
                );

                expect(mockSecurityService.$once('getRequestIP')).toBeTrue();
                expect(mockRateLimitService.$once('buildKey')).toBeTrue();
                expect(mockRateLimitService.$once('hit')).toBeTrue();

                // We did not stop the current execution
                expect(mockRequestContext.$never('renderData')).toBeTrue();
                expect(mockRequestContext.$never('noExecution')).toBeTrue();
            });

            it('Should block request and return 429 when rate limit is exceeded', () => {
                var mockResponse = createMock('coldbox.system.web.context.RequestContext');
                mockResponse.$('setErrorMessage', mockResponse);
                mockResponse.$('setStatusCode', mockResponse);
                mockResponse.$('getDataPacket', {error: true, messages: ['Too many attempts. Please try again later.']});

                mockRequestContext.$('getResponse', mockResponse);
                interceptor.$property(propertyName = 'useRateLimiter', mock = true);
                interceptor.$property(
                    propertyName = 'settings',
                    mock         = {'api.login': {key: 'ip', limit: 5, window: 60}}
                );
                mockRequestContext.$('getCurrentEvent', 'api.login');
                mockSecurityService.$('getRequestIP', '192.168.1.1');
                mockRateLimitService.$('buildKey', '192.168.1.1');
                mockRateLimitService.$('hit', false);

                interceptor.preProcess(
                    event  = mockRequestContext,
                    data   = mockData,
                    buffer = mockBuffer,
                    rc     = rc,
                    prc    = prc
                );

                // Response object was populated
                expect(mockResponse.$once('setErrorMessage')).toBeTrue();
                expect(mockResponse.$once('setStatusCode')).toBeTrue();

                var setStatusCodeCall = mockResponse.$callLog().setStatusCode[1];
                expect(setStatusCodeCall[1]).toBe(429);

                var setErrorMessageCall = mockResponse.$callLog().setErrorMessage[1];
                expect(setErrorMessageCall[1]).toBe('Too many attempts. Please try again later.');

                // renderData and noExecution still called
                expect(mockRequestContext.$once('renderData')).toBeTrue();
                expect(mockRequestContext.$once('noExecution')).toBeTrue();

                var renderDataCall = mockRequestContext.$callLog().renderData[1];
                expect(renderDataCall.statusCode).toBe(429);
                expect(renderDataCall.type).toBe('json');
            });

            it('Should use email from rc when building key with email mode', () => {
                rc.email = 'test@example.com';
                interceptor.$property(propertyName = 'useRateLimiter', mock = true);
                interceptor.$property(
                    propertyName = 'settings',
                    mock         = {'api.register': {key: 'email', limit: 3, window: 3600}}
                );
                mockRequestContext.$('getCurrentEvent', 'api.register');
                mockSecurityService.$('getRequestIP', '192.168.1.1');
                mockRateLimitService
                    .$('buildKey')
                    .$args(
                        mode  = 'email',
                        ip    = '192.168.1.1',
                        email = 'test@example.com'
                    )
                    .$results('test@example.com');
                mockRateLimitService.$('hit', true);

                interceptor.preProcess(
                    event  = mockRequestContext,
                    data   = mockData,
                    buffer = mockBuffer,
                    rc     = rc,
                    prc    = prc
                );

                expect(mockRateLimitService.$once('buildKey')).toBeTrue();

                // Build key was called with the rc.email
                var buildKeyCall = mockRateLimitService.$callLog().buildKey[1];
                expect(buildKeyCall.email).toBe('test@example.com');
            });

            it('Should handle case insensitive event names', () => {
                interceptor.$property(propertyName = 'useRateLimiter', mock = true);
                interceptor.$property(
                    propertyName = 'settings',
                    mock         = {'api.login': {key: 'ip', limit: 5, window: 60}}
                );
                mockRequestContext.$('getCurrentEvent', 'API.LOGIN'); // Uppercase
                mockSecurityService.$('getRequestIP', '192.168.1.1');
                mockRateLimitService.$('buildKey', '192.168.1.1');
                mockRateLimitService.$('hit', true);

                interceptor.preProcess(
                    event  = mockRequestContext,
                    data   = mockData,
                    buffer = mockBuffer,
                    rc     = rc,
                    prc    = prc
                );

                // Should find the lowercase setting
                expect(mockRateLimitService.$once('hit')).toBeTrue();
            });

            it('Should build correct cache key format', () => {
                interceptor.$property(propertyName = 'useRateLimiter', mock = true);
                interceptor.$property(
                    propertyName = 'settings',
                    mock         = {'api.login': {key: 'ip', limit: 5, window: 60}}
                );
                mockRequestContext.$('getCurrentEvent', 'api.login');
                mockSecurityService.$('getRequestIP', '192.168.1.1');
                mockRateLimitService.$('buildKey', '192.168.1.1');
                mockRateLimitService.$('hit', true);

                interceptor.preProcess(
                    event  = mockRequestContext,
                    data   = mockData,
                    buffer = mockBuffer,
                    rc     = rc,
                    prc    = prc
                );

                // Cache key in format of 'ratelimit:#currentEvent#:#key#'
                var hitCall = mockRateLimitService.$callLog().hit[1];
                expect(hitCall.key).toBe('ratelimit:api.login:192.168.1.1');
                expect(hitCall.limit).toBe(5);
                expect(hitCall.window).toBe(60);
            });

            it('Should use email from prc.authUser when rc.email is not present', () => {
                var mockAuthUser = createEmptyMock('models.objects.userobj');
                mockAuthUser.$('getEmail', 'authuser@example.com');
                prc.authUser = mockAuthUser;

                interceptor.$property(propertyName = 'useRateLimiter', mock = true);
                interceptor.$property(
                    propertyName = 'settings',
                    mock         = {'api.register': {key: 'email', limit: 3, window: 3600}}
                );
                mockRequestContext.$('getCurrentEvent', 'api.register');
                mockSecurityService.$('getRequestIP', '192.168.1.1');
                mockRateLimitService
                    .$('buildKey')
                    .$args(
                        mode  = 'email',
                        ip    = '192.168.1.1',
                        email = 'authuser@example.com'
                    )
                    .$results('authuser@example.com');
                mockRateLimitService.$('hit', true);

                interceptor.preProcess(
                    event  = mockRequestContext,
                    data   = mockData,
                    buffer = mockBuffer,
                    rc     = rc,
                    prc    = prc
                );

                var buildKeyCall = mockRateLimitService.$callLog().buildKey[1];
                expect(buildKeyCall.email).toBe('authuser@example.com');
            });

            it('Should fall back to IP when neither rc.email nor prc.authUser are present', () => {
                interceptor.$property(propertyName = 'useRateLimiter', mock = true);
                interceptor.$property(
                    propertyName = 'settings',
                    mock         = {'api.register': {key: 'email', limit: 3, window: 3600}}
                );
                mockRequestContext.$('getCurrentEvent', 'api.register');
                mockSecurityService.$('getRequestIP', '192.168.1.1');
                mockRateLimitService
                    .$('buildKey')
                    .$args(
                        mode  = 'email',
                        ip    = '192.168.1.1',
                        email = '192.168.1.1'
                    )
                    .$results('192.168.1.1');
                mockRateLimitService.$('hit', true);

                interceptor.preProcess(
                    event  = mockRequestContext,
                    data   = mockData,
                    buffer = mockBuffer,
                    rc     = rc,
                    prc    = prc
                );

                var buildKeyCall = mockRateLimitService.$callLog().buildKey[1];
                expect(buildKeyCall.email).toBe('192.168.1.1');
            });

            it('Should pass both ip and email when key mode is ip+email', () => {
                rc.email = 'test@example.com';
                interceptor.$property(propertyName = 'useRateLimiter', mock = true);
                interceptor.$property(
                    propertyName = 'settings',
                    mock         = {'auth.login': {key: 'ip+email', limit: 10, window: 5}}
                );
                mockRequestContext.$('getCurrentEvent', 'auth.login');
                mockSecurityService.$('getRequestIP', '192.168.1.1');
                mockRateLimitService
                    .$('buildKey')
                    .$args(
                        mode  = 'ip+email',
                        ip    = '192.168.1.1',
                        email = 'test@example.com'
                    )
                    .$results('192.168.1.1:test@example.com');
                mockRateLimitService.$('hit', true);

                interceptor.preProcess(
                    event  = mockRequestContext,
                    data   = mockData,
                    buffer = mockBuffer,
                    rc     = rc,
                    prc    = prc
                );

                var buildKeyCall = mockRateLimitService.$callLog().buildKey[1];
                expect(buildKeyCall.mode).toBe('ip+email');
                expect(buildKeyCall.ip).toBe('192.168.1.1');
                expect(buildKeyCall.email).toBe('test@example.com');
            });
        });
    }

}
