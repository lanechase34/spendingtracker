component extends="coldbox.system.testing.BaseInterceptorTest" interceptor="interceptors.exception" {

    function beforeAll() {
        super.beforeAll();

        // Init interceptor
        super.setup();
    }

    function afterAll() {
        super.afterAll();
    }

    /**
     * Run an interception point on the interceptor with the shared mocks
     */
    private function announce(required string point) {
        invoke(
            interceptor,
            point,
            {
                event        : mockRequestContext,
                data         : interceptData,
                buffer       : '',
                rc           : rc,
                prc          : prc,
                interceptData: interceptData
            }
        );
    }

    function run() {
        describe('Exception Interceptor', () => {
            beforeEach(() => {
                setup();

                // Async futures are captured and run inline so the logged data can be checked
                futures   = [];
                mockAsync = createStub();
                mockAsync.$(
                    method   = 'newFuture',
                    callback = function() {
                        futures.append(arguments[1]);
                    }
                );

                mockBugService   = createStub().$('log');
                mockEmailService = createStub().$('sendBug');

                interceptor.$property(propertyName = 'async', mock = mockAsync);
                interceptor.$property(propertyName = 'bugService', mock = mockBugService);
                interceptor.$property(propertyName = 'emailService', mock = mockEmailService);
                interceptor.$('getSetting', 'test');

                mockRequestContext = createEmptyMock('coldbox.system.web.context.RequestContext');
                mockRequestContext.$('getCurrentEvent', 'expense.view');
                mockRequestContext.$('getFullPath', '/api/v1/expenses');
                mockRequestContext.$('getHTTPMethod', 'GET');
                mockRequestContext.$('renderData', mockRequestContext);

                interceptData = {exception: {type: 'Database', message: 'Boom'}};
                rc            = {};
                prc           = {
                    userid      : 7,
                    requestAudit: {
                        ip        : '192.168.1.1',
                        urlpath   : '/api/v1/expenses',
                        method    : 'GET',
                        agent     : 'Mozilla',
                        detail    : '',
                        statuscode: -1,
                        userid    : -1
                    }
                };
            });

            it('Can be created', () => {
                expect(interceptor).toBeComponent();
            });

            describe('onException', () => {
                it('Should log and email the bug', () => {
                    announce('onException');
                    futures.each((task) => task());

                    expect(mockBugService.$once('log')).toBeTrue();
                    var logCall = mockBugService.$callLog().log[1];
                    expect(logCall.ip).toBe('192.168.1.1');
                    expect(logCall.userid).toBe(7);
                    expect(logCall.detail).toBe('onException');
                    expect(logCall.stack.exception.message).toBe('Boom');

                    expect(mockEmailService.$once('sendBug')).toBeTrue();
                    expect(mockEmailService.$callLog().sendBug[1].bugInfo.detail).toBe('onException');
                });

                it('Should leave prc.requestAudit untouched', () => {
                    announce('onException');
                    futures.each((task) => task());

                    expect(prc.requestAudit).notToHaveKey('stack');
                    expect(prc.requestAudit.detail).toBe('');
                    expect(prc.requestAudit.userid).toBe(-1);
                });

                it('Should log a copy that later prc changes do not affect', () => {
                    announce('onException');

                    // requestAudit.postProcess runs before the async log
                    prc.requestAudit.ip = 'changed';
                    futures.each((task) => task());

                    expect(mockBugService.$callLog().log[1].ip).toBe('192.168.1.1');
                });

                it('Should fall back to the request when requestAudit is missing', () => {
                    prc = {};

                    announce('onException');
                    futures.each((task) => task());

                    var logCall = mockBugService.$callLog().log[1];
                    expect(logCall.ip).toBe('-1');
                    expect(logCall.urlpath).toBe('/api/v1/expenses');
                    expect(logCall.method).toBe('GET');
                    expect(logCall.agent).toBe('');
                    expect(logCall.userid).toBe(-1);
                    expect(prc).notToHaveKey('requestAudit');
                });

                it('Should skip excluded events', () => {
                    mockRequestContext.$('getCurrentEvent', 'Auth.Logout');

                    announce('onException');

                    expect(futures).toBeEmpty();
                });

                it('Should skip excluded exception types', () => {
                    interceptData.exception.type = 'TokenMismatchException';

                    announce('onException');

                    expect(futures).toBeEmpty();
                });

                it('Should not render a dump outside development', () => {
                    announce('onException');

                    expect(mockRequestContext.$never('renderData')).toBeTrue();
                });
            });

            describe('onValidationException', () => {
                it('Should log the bug without emailing', () => {
                    announce('onValidationException');
                    futures.each((task) => task());

                    expect(mockBugService.$once('log')).toBeTrue();
                    expect(mockBugService.$callLog().log[1].detail).toBe('onValidationException');
                    expect(mockEmailService.$never('sendBug')).toBeTrue();
                });

                it('Should leave prc.requestAudit untouched', () => {
                    announce('onValidationException');
                    futures.each((task) => task());

                    expect(prc.requestAudit).notToHaveKey('stack');
                    expect(prc.requestAudit.detail).toBe('');
                });

                it('Should not error when requestAudit is missing', () => {
                    prc = {};

                    announce('onValidationException');
                    futures.each((task) => task());

                    expect(mockBugService.$once('log')).toBeTrue();
                    expect(mockBugService.$callLog().log[1].urlpath).toBe('/api/v1/expenses');
                });
            });
        });
    }

}
