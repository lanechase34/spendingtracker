component extends="coldbox.system.testing.BaseInterceptorTest" interceptor="interceptors.guestOnly" {

    function beforeAll() {
        super.beforeAll();

        // Init inteceptor
        super.setup();
    }

    function afterAll() {
        super.afterAll();
    }

    function run() {
        describe('GuestOnly Interceptor Unit Tests', () => {
            beforeEach(() => {
                setup();

                // Mock the injected properties
                mockJwtService = createEmptyMock('cbsecurity.models.jwt.JWTService');
                interceptor.$property(propertyName = 'jwtService', mock = mockJwtService);
                interceptor.$property(propertyName = 'settings', mock = ['auth.login', 'auth.register']);

                mockRequestContext = createEmptyMock('coldbox.system.web.context.RequestContext');
                mockRequestContext.$('getCurrentEvent', 'auth.login');
                mockRequestContext.$('noExecution');
                mockRequestContext.$('renderData');

                mockResponse = createMock('coldbox.system.web.context.RequestContext');
                mockResponse.$('setErrorMessage', mockResponse);
                mockResponse.$('setStatusCode', mockResponse);
                mockRequestContext.$('getResponse', mockResponse);

                mockData   = {};
                mockBuffer = '';
                rc         = {};
                prc        = {};

                mockJwtService.$reset();
            });

            it('Can be created', () => {
                expect(interceptor).toBeComponent();
            });

            it('Allows unauthenticated requests through on guest-only routes', () => {
                // No valid JWT - authenticate throws
                mockJwtService.$('authenticate').$throws(type = 'InvalidCredentials');

                interceptor.preProcess(
                    event  = mockRequestContext,
                    data   = mockData,
                    buffer = mockBuffer,
                    rc     = rc,
                    prc    = prc
                );

                expect(mockRequestContext.$never('noExecution')).toBeTrue();
                expect(mockRequestContext.$never('renderData')).toBeTrue();
            });

            it('Blocks authenticated users from accessing guest-only routes', () => {
                var mockUser = createEmptyMock('models.objects.userobj');
                mockUser.$('isLoaded', true);
                mockJwtService.$('authenticate', mockUser);

                interceptor.preProcess(
                    event  = mockRequestContext,
                    data   = mockData,
                    buffer = mockBuffer,
                    rc     = rc,
                    prc    = prc
                );

                expect(mockRequestContext.$once('noExecution')).toBeTrue();
                expect(mockRequestContext.$once('renderData')).toBeTrue();

                var renderDataCall = mockRequestContext.$callLog().renderData[1];
                expect(renderDataCall.statusCode).toBe(400);
                expect(renderDataCall.type).toBe('json');
                expect(renderDataCall.data.error).toBeTrue();
                expect(renderDataCall.data.messages[1]).toBe('You are already authenticated.');
            });

            it('Blocks authenticated users from accessing auth.register', () => {
                mockRequestContext.$('getCurrentEvent', 'auth.register');

                var mockUser = createEmptyMock('models.objects.userobj');
                mockUser.$('isLoaded', true);
                mockJwtService.$('authenticate', mockUser);

                interceptor.preProcess(
                    event  = mockRequestContext,
                    data   = mockData,
                    buffer = mockBuffer,
                    rc     = rc,
                    prc    = prc
                );

                expect(mockRequestContext.$once('noExecution')).toBeTrue();
                expect(mockRequestContext.$once('renderData')).toBeTrue();
            });

            it('Allows requests through on non guest-only routes', () => {
                mockRequestContext.$('getCurrentEvent', 'user.getProfile');

                var mockUser = createEmptyMock('models.objects.userobj');
                mockUser.$('isLoaded', true);
                mockJwtService.$('authenticate', mockUser);

                interceptor.preProcess(
                    event  = mockRequestContext,
                    data   = mockData,
                    buffer = mockBuffer,
                    rc     = rc,
                    prc    = prc
                );

                // authenticate should never even be called since the event is not guest-only
                expect(mockJwtService.$never('authenticate')).toBeTrue();
                expect(mockRequestContext.$never('noExecution')).toBeTrue();
                expect(mockRequestContext.$never('renderData')).toBeTrue();
            });

            it('Allows through when authenticate returns an unloaded user', () => {
                var mockUser = createEmptyMock('models.objects.userobj');
                mockUser.$('isLoaded', false);
                mockJwtService.$('authenticate', mockUser);

                interceptor.preProcess(
                    event  = mockRequestContext,
                    data   = mockData,
                    buffer = mockBuffer,
                    rc     = rc,
                    prc    = prc
                );

                expect(mockRequestContext.$never('noExecution')).toBeTrue();
                expect(mockRequestContext.$never('renderData')).toBeTrue();
            });

            it('Allows through when authenticate returns null', () => {
                mockJwtService.$('authenticate', javacast('null', ''));

                interceptor.preProcess(
                    event  = mockRequestContext,
                    data   = mockData,
                    buffer = mockBuffer,
                    rc     = rc,
                    prc    = prc
                );

                expect(mockRequestContext.$never('noExecution')).toBeTrue();
                expect(mockRequestContext.$never('renderData')).toBeTrue();
            });

            it('Is case insensitive on event names', () => {
                mockRequestContext.$('getCurrentEvent', 'AUTH.LOGIN');

                var mockUser = createEmptyMock('models.objects.userobj');
                mockUser.$('isLoaded', true);
                mockJwtService.$('authenticate', mockUser);

                interceptor.preProcess(
                    event  = mockRequestContext,
                    data   = mockData,
                    buffer = mockBuffer,
                    rc     = rc,
                    prc    = prc
                );

                expect(mockRequestContext.$once('noExecution')).toBeTrue();
            });
        });
    }

}
