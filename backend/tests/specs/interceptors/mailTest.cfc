component extends="coldbox.system.testing.BaseInterceptorTest" interceptor="interceptors.mail" {

    function beforeAll() {
        super.beforeAll();
    }

    function afterAll() {
        super.afterAll();
    }

    function run() {
        describe('interceptors.mail', () => {
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

                mockBugService = createStub().$('log');

                interceptor.$property(propertyName = 'async', mock = mockAsync);
                interceptor.$property(propertyName = 'bugService', mock = mockBugService);

                prc = {};
            });

            it('Should configure correctly', () => {
                interceptor.configure();
                expect(interceptor).toBeComponent();
            });

            describe('postMailSend', () => {
                it('Should log a bug when the mail failed to send', () => {
                    var result = {error: true, messages: ['SMTP down']};

                    interceptor.postMailSend(
                        event  = getMockRequestContext(),
                        data   = {result: result},
                        buffer = '',
                        rc     = {},
                        prc    = prc
                    );

                    // Mutating the result afterwards doesn't change what's logged
                    result.messages = [];
                    futures.each((task) => task());

                    expect(mockBugService.$once('log')).toBeTrue();
                    var logCall = mockBugService.$callLog().log[1];
                    expect(logCall.detail).toBe('Failed to send email');
                    expect(logCall.urlpath).toBe('cbMailQueue');
                    expect(logCall.stack.messages).toBe(['SMTP down']);

                    // Nothing is left on prc
                    expect(prc).toBeEmpty();
                });

                it('Should not log when the mail sent', () => {
                    interceptor.postMailSend(
                        event  = getMockRequestContext(),
                        data   = {result: {error: false}},
                        buffer = '',
                        rc     = {},
                        prc    = prc
                    );

                    expect(futures).toBeEmpty();
                    expect(mockBugService.$never('log')).toBeTrue();
                });
            });
        });
    }

}
