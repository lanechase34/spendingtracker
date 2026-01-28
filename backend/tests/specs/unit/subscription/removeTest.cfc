component extends="tests.resources.baseTest" {

    property name="uploadPath" inject="coldbox:setting:uploadPath";

    function beforeAll() {
        super.beforeAll();

        mockUser = getInstance('tests.resources.mockuser');

        /**
         * Setup user to be shared throughout the test suite
         */
        user = mockUser.make();
        jwt  = mockUser.login(user);
    }

    function afterAll() {
        super.afterAll();

        mockUser.logout(user, jwt);
        mockUser.delete(user);
    }

    function run() {
        describe('subscription.remove', () => {
            beforeEach(() => {
                setup();
            });

            it('Can DELETE a subscription', () => {
                /**
                 * Mock a subscription
                 */
                var id = subscriptionHelper.insert(
                    data = subscriptionHelper.mock(
                        date     = dateAdd('d', randRange(-31, -2), dateAdd('m', -1, now())),
                        interval = 'M',
                        userid   = user.getId()
                    ),
                    active = true
                );

                var before = subscriptionHelper.count(userid = user.getId());

                var event = delete(route = '/api/v1/subscriptions/#id#', headers = {'x-auth-token': jwt});

                // Verify JSON response
                var response = event.getResponse();
                expect(response.getStatusCode()).toBe(200);
                expect(response.getError()).toBeFalse();
                expect(response.getMessages()[1]).toBe('Successfully deleted subscription.');

                // Check the record was deleted
                expect(subscriptionHelper.count(userid = user.getId())).toBe(before - 1);
                expect(subscriptionHelper.load(id)).toBeEmpty();
            });

            it('Can DELETE a subscription that has charged expenses but won''t delete the expense records', () => {
                /**
                 * Mock subscription that will charge immediately
                 */
                var description = createUUID();
                var data        = subscriptionHelper.mock(
                    date        = dateAdd('d', randRange(-31, -2), dateAdd('m', -3, now())),
                    interval    = 'M',
                    userid      = user.getId(),
                    description = description
                );
                var before = subscriptionHelper.count(userid = user.getId());
                var event  = post(
                    route   = '/api/v1/subscriptions',
                    headers = {'x-auth-token': jwt},
                    params  = data
                );

                // Verify the subscription saved successfully
                expect(subscriptionHelper.count(userid = user.getId())).toBe(before + 1);
                subscriptionHelper.verifySubscription(data, true);

                // Verify the subscription charged immediately
                subscriptionHelper.verifyExpense(data, true);

                /**
                 * Delete the subscription
                 */
                var id    = subscriptionHelper.getFromDescription(description).id;
                var event = delete(route = '/api/v1/subscriptions/#id#', headers = {'x-auth-token': jwt});

                // Check the record was deleted
                expect(subscriptionHelper.count(userid = user.getId())).toBe(before);
                expect(subscriptionHelper.load(id)).toBeEmpty();

                // Verify the expense records were NOT deleted
                subscriptionHelper.verifyExpense(data, true);
            });

            describe('Receipt integration', () => {
                it('Can delete a subscription with a receipt, but the receipt won''t delete', () => {
                    /**
                     * Mock subscription with receipt
                     */
                    var receipt = createUUID();
                    fileCopy(source = '#uploadPath#/404.webp', destination = '#user.getDir()#/#receipt#.webp');
                    var id = subscriptionHelper.insert(
                        data = subscriptionHelper.mock(
                            date     = dateAdd('d', randRange(-31, -2), dateAdd('m', -1, now())),
                            interval = 'M',
                            userid   = user.getId(),
                            receipt  = receipt
                        ),
                        active = true
                    );

                    var before = subscriptionHelper.count(userid = user.getId());
                    var event  = delete(route = '/api/v1/subscriptions/#id#', headers = {'x-auth-token': jwt});

                    // Check the record was deleted
                    expect(subscriptionHelper.count(userid = user.getId())).toBe(before - 1);
                    expect(subscriptionHelper.load(id)).toBeEmpty();

                    // Verify receipt did not delete
                    expect(fileExists('#user.getDir()#/#receipt#.webp')).toBeTrue();
                });

                it('Can delete an expense charged by subscription, but this will not delete the subscription''s receipt', () => {
                    /**
                     * Mock subscription with receipt that will charge immediately
                     */
                    var description = createUUID();
                    var receipt     = createUUID();
                    fileCopy(source = '#uploadPath#/404.webp', destination = '#user.getDir()#/#receipt#.webp');
                    var id = subscriptionHelper.insert(
                        data = subscriptionHelper.mock(
                            date        = dateAdd('d', randRange(-31, -2), dateAdd('m', -3, now())),
                            interval    = 'M',
                            userid      = user.getId(),
                            receipt     = receipt,
                            description = description
                        ),
                        active = true
                    );

                    var subscription = subscriptionHelper.getFromDescription(description);

                    /**
                     * Trigger the 'charge' task for subscription
                     */
                    getInstance('services.subscription').charge(subscription.id);

                    var expenses = subscriptionHelper.getExpenses(subscription.id);
                    expect(expenses.len()).toBeGTE(1);

                    // Delete an expense
                    var event = delete(route = '/api/v1/expenses/#expenses[1].id#', headers = {'x-auth-token': jwt});

                    // Verify the receipt did NOT delete
                    expect(fileExists('#user.getDir()#/#receipt#.webp')).toBeTrue();
                });
            });
        });
    }

}
