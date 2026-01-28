component extends="tests.resources.baseTest" {

    function beforeAll() {
        super.beforeAll();

        subscriptionService = getInstance('services.subscription');
    }

    function afterAll() {
        super.afterAll();
    }

    function run() {
        describe('subscription.charge', () => {
            beforeEach(() => {
                setup();
            });

            it('Charge a MONTHLY subscription that is due', () => {
                // Directly insert data bypassing method then call charge
            });

            it('Charge a YEARLY subscription that is due', () => {
            });

            it('Charge combination of MONTHLY and YEARLY subscriptions that are due', () => {
            });

            it('Will skip charge of subscriptions that are inactive even if they are due', () => {
            });
        });
    }

}
