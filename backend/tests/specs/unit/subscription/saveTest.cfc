component extends="tests.resources.baseTest" {

    function beforeAll() {
        super.beforeAll();

        mockUser = getInstance('tests.resources.mockuser');

        /**
         * Setup user to be shared throughout the test suite
         */
        user = mockUser.make();
        jwt  = mockUser.login(user);

        /**
         * Test various dates
         */
        loopCount = 100;
    }

    function afterAll() {
        super.afterAll();

        mockUser.logout(user, jwt);
        mockUser.delete(user);
    }

    function run() {
        describe('subscription.save', () => {
            beforeEach(() => {
                setup();
            });

            it('Can POST a FUTURE monthly subscription', () => {
                var before = subscriptionHelper.count(userid = user.getId());
                var data   = subscriptionHelper.mock(
                    date     = dateAdd('d', 1, now()),
                    interval = 'M',
                    userid   = user.getId()
                );

                var event = post(
                    route   = '/api/v1/subscriptions',
                    headers = {'x-auth-token': jwt},
                    params  = data
                );

                // Verify JSON response
                var response = event.getResponse();
                expect(response.getStatusCode()).toBe(200);
                expect(response.getError()).toBeFalse();
                expect(response.getMessages()[1]).toBe('Successfully saved subscription.');

                // Verify the subscription saved successfully
                expect(subscriptionHelper.count(userid = user.getId())).toBe(before + 1);
                subscriptionHelper.verifySubscription(data, true);

                // Verify this did not automatically charge as it's not due
                subscriptionHelper.verifyExpense(data, false);
            });

            it('Can POST a FUTURE yearly subscription', () => {
                var before = subscriptionHelper.count(userid = user.getId());
                var data   = subscriptionHelper.mock(
                    date     = dateAdd('d', 1, now()),
                    interval = 'Y',
                    userid   = user.getId()
                );

                var event = post(
                    route   = '/api/v1/subscriptions',
                    headers = {'x-auth-token': jwt},
                    params  = data
                );

                // Verify JSON response
                var response = event.getResponse();
                expect(response.getStatusCode()).toBe(200);
                expect(response.getError()).toBeFalse();
                expect(response.getMessages()[1]).toBe('Successfully saved subscription.');

                // Verify the subscription saved successfully
                expect(subscriptionHelper.count(userid = user.getId())).toBe(before + 1);
                subscriptionHelper.verifySubscription(data, true);

                // Verify this did not automatically charge as it's not due
                subscriptionHelper.verifyExpense(data, false);
            });

            it('Block invalid subscription interval', () => {
                var before = subscriptionHelper.count(userid = user.getId());
                var data   = subscriptionHelper.mock(
                    date     = now(),
                    interval = 'C',
                    userid   = user.getId()
                );

                var event = post(
                    route   = '/api/v1/subscriptions',
                    headers = {'x-auth-token': jwt},
                    params  = data
                );

                // Verify JSON response
                var response = event.getResponse();
                expect(response.getStatusCode()).toBe(400); // bad request
                expect(response.getError()).toBeTrue();
                expect(response.getMessages()[1]).toBe('Invalid Parameters. Value must be Y (Year) or M (Month).');

                // Verify the subscription did not save
                expect(before).toBe(subscriptionHelper.count(userid = user.getId()));
                subscriptionHelper.verifySubscription(data, false);
            });

            it('Overdue MONTHLY subscription charges immediately', () => {
                for(var i = 1; i <= loopCount; i++) {
                    var dayRand   = randRange(-31, -2);
                    var monthRand = randRange(-2, -12);
                    var date      = dateAdd('d', dayRand, dateAdd('m', monthRand, now()));

                    // Edge cases
                    // Last day of 31 day month
                    if(i == loopCount) {
                        date = createDate(year(now()) - 1, 3, 31);
                    }
                    // Feb 28th
                    else if(i == loopCount - 1) {
                        date = createDate(year(now()) - 1, 2, 28);
                    }
                    // Last day of year
                    else if(i == loopCount - 2) {
                        date = createDate(year(now()) - 1, 12, 31);
                    }

                    var before = subscriptionHelper.count(userid = user.getId());
                    var data   = subscriptionHelper.mock(
                        date     = date,
                        interval = 'M',
                        userid   = user.getId()
                    );

                    /**
                     * We are expecting this to CHARGE an expense immediately
                     */
                    var event = post(
                        route   = '/api/v1/subscriptions',
                        headers = {'x-auth-token': jwt},
                        params  = data
                    );

                    // Verify JSON response
                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(200);
                    expect(response.getError()).toBeFalse();
                    expect(response.getMessages()[1]).toBe('Successfully saved subscription.');

                    // Verify the subscription saved successfully
                    expect(subscriptionHelper.count(userid = user.getId())).toBe(before + 1);
                    subscriptionHelper.verifySubscription(data, true);

                    // Verify the subscription charged immediately
                    subscriptionHelper.verifyExpense(data, true);
                }
            });

            it('Overdue YEARLY subscription charges immediately', () => {
                for(var i = 1; i <= loopCount; i++) {
                    var dayRand   = randRange(-31, -2);
                    var monthRand = randRange(-2, -12);
                    var date      = dateAdd('d', dayRand, dateAdd('m', monthRand, now()));

                    // Edge cases
                    // Last day of 31 day month
                    if(i == loopCount) {
                        date = createDate(year(now()) - 1, 3, 31);
                    }
                    // Feb 28th
                    else if(i == loopCount - 1) {
                        date = createDate(year(now()) - 1, 2, 28);
                    }
                    // Last day of year
                    else if(i == loopCount - 2) {
                        date = createDate(year(now()) - 1, 12, 31);
                    }

                    var before = subscriptionHelper.count(userid = user.getId());
                    var data   = subscriptionHelper.mock(
                        date     = date,
                        interval = 'Y',
                        userid   = user.getId()
                    );

                    /**
                     * We are expecting this to CHARGE an expense immediately
                     */
                    var event = post(
                        route   = '/api/v1/subscriptions',
                        headers = {'x-auth-token': jwt},
                        params  = data
                    );

                    // Verify JSON response
                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(200);
                    expect(response.getError()).toBeFalse();
                    expect(response.getMessages()[1]).toBe('Successfully saved subscription.');

                    // Verify the subscription saved successfully
                    expect(subscriptionHelper.count(userid = user.getId())).toBe(before + 1);
                    subscriptionHelper.verifySubscription(data, true);

                    // Verify the subscription charged immediately
                    subscriptionHelper.verifyExpense(data, true);
                }
            });
        });
    }

}
