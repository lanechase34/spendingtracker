component extends="tests.resources.baseTest" {

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
        describe('subscription.toggle', () => {
            beforeEach(() => {
                setup();
            });

            it('Can toggle a subscription inactive', () => {
                var currSubscriptionId = subscriptionHelper.insert(
                    data = subscriptionHelper.mock(
                        date     = dateAdd('d', randRange(-31, -2), dateAdd('m', -1, now())),
                        interval = 'M',
                        userid   = user.getId()
                    ),
                    active = true
                );

                var event = patch(
                    route   = '/api/v1/subscriptions/#currSubscriptionId#',
                    headers = {'x-auth-token': jwt},
                    params  = {active: false}
                );

                // Verify JSON response
                var response = event.getResponse();
                expect(response.getStatusCode()).toBe(200);
                expect(response.getError()).toBeFalse();
                expect(response.getMessages()[1]).toBe('Successfully inactivated subscription.');

                // Verify it's now inactive
                var curr = subscriptionHelper.load(currSubscriptionId);
                expect(curr.active).toBeFalse();
            });

            it('Can toggle a subscription active', () => {
                var currSubscriptionId = subscriptionHelper.insert(
                    data = subscriptionHelper.mock(
                        date     = dateAdd('d', randRange(-31, -2), dateAdd('m', -1, now())),
                        interval = 'M',
                        userid   = user.getId()
                    ),
                    active = false
                );

                // Verify it starts inactive
                var curr = subscriptionHelper.load(currSubscriptionId);
                expect(curr.active).toBeFalse();

                var event = patch(
                    route   = '/api/v1/subscriptions/#currSubscriptionId#',
                    headers = {'x-auth-token': jwt},
                    params  = {active: true}
                );

                // Verify JSON response
                var response = event.getResponse();
                expect(response.getStatusCode()).toBe(200);
                expect(response.getError()).toBeFalse();
                expect(response.getMessages()[1]).toBe('Successfully activated subscription.');

                // Verify it's now active
                curr = subscriptionHelper.load(currSubscriptionId);
                expect(curr.active).toBeTrue();
            });
        });
    }

}
