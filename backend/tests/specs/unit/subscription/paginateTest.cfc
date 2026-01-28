component extends="tests.resources.baseTest" {

    function beforeAll() {
        super.beforeAll();

        categoryService     = getInstance('services.category');
        expenseService      = getInstance('services.expense');
        subscriptionService = getInstance('services.subscription');
        mockUser            = getInstance('tests.resources.mockuser');

        // Set up user to be shared throughout the test suite
        userid = mockUser.make();
    }

    function afterAll() {
        super.afterAll();
        mockUser.delete(userid);
    }

    function run() {
        describe('subscription.paginate', () => {
            beforeEach(() => {
                setup();
                request.userid = userid;
            });

            it('Can return a paginated page with the correct counts', () => {
            });

            it('Can filter results by date', () => {
            });

            it('Can filter results by search term', () => {
            });

            it('Can filter results by category', () => {
            });

            it('Can filter results by interval (Y/M)', () => {
            });
        });
    }

}
