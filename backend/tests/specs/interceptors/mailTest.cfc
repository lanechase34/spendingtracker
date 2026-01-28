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
            });

            it('Should configure correctly', () => {
                interceptor.configure();
                expect(interceptor).toBeComponent();
            });
        });
    }

}
