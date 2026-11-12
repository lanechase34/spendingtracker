component extends="tests.resources.baseTest" {

    property name="uploadPath" inject="coldbox:setting:uploadPath";

    function beforeAll() {
        super.beforeAll();

        mockUser = getInstance("tests.resources.mockuser");

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
        describe("subscription.remove", () => {
            beforeEach(() => {
                setup();
            });

            it("Can DELETE a subscription", () => {
                /**
                 * Mock a subscription
                 */
                var id = subscriptionHelper.insert(
                    data = subscriptionHelper.mock(
                        date     = dateAdd("d", randRange(-31, -2), dateAdd("m", -1, now())),
                        interval = "M",
                        userid   = user.getId()
                    ),
                    active = true
                );

                var before = subscriptionHelper.count(userid = user.getId());

                var event = delete(route = "/api/v1/subscriptions/#id#", headers = {"x-auth-token": jwt});

                // Verify JSON response
                var response = event.getResponse();
                expect(response.getStatusCode()).toBe(200);
                expect(response.getError()).toBeFalse();
                expect(response.getMessages()[1]).toBe("Successfully deleted subscription.");

                // Check the record was deleted
                expect(subscriptionHelper.count(userid = user.getId())).toBe(before - 1);
                expect(subscriptionHelper.load(id)).toBeEmpty();
            });

            it("Can DELETE a subscription that has charged expenses but won't delete the expense records", () => {
                /**
                 * Mock subscription that will charge immediately
                 */
                var description = createUUID();
                var data        = subscriptionHelper.mock(
                    date        = dateAdd("d", randRange(-31, -2), dateAdd("m", -3, now())),
                    interval    = "M",
                    userid      = user.getId(),
                    description = description
                );
                var before = subscriptionHelper.count(userid = user.getId());
                var event  = post(
                    route   = "/api/v1/subscriptions",
                    headers = {"x-auth-token": jwt},
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
                var event = delete(route = "/api/v1/subscriptions/#id#", headers = {"x-auth-token": jwt});

                // Check the record was deleted
                expect(subscriptionHelper.count(userid = user.getId())).toBe(before);
                expect(subscriptionHelper.load(id)).toBeEmpty();

                // Verify the expense records were NOT deleted
                subscriptionHelper.verifyExpense(data, true);
            });

            describe("Receipt integration", () => {
                it("Deletes the receipt with the subscription when no expense uses it", () => {
                    /**
                     * Mock subscription with receipt
                     */
                    var receipt = createUUID();
                    var path    = fetchAndWriteImg("https://picsum.photos/seed/test/200/200", "jpeg");
                    fileCopy(source = path, destination = "#user.getDir()#/#receipt#.webp");
                    var id = subscriptionHelper.insert(
                        data = subscriptionHelper.mock(
                            date     = dateAdd("d", randRange(-31, -2), dateAdd("m", -1, now())),
                            interval = "M",
                            userid   = user.getId(),
                            receipt  = receipt
                        ),
                        active = true
                    );

                    var before = subscriptionHelper.count(userid = user.getId());
                    var event  = delete(route = "/api/v1/subscriptions/#id#", headers = {"x-auth-token": jwt});

                    // Check the record was deleted
                    expect(subscriptionHelper.count(userid = user.getId())).toBe(before - 1);
                    expect(subscriptionHelper.load(id)).toBeEmpty();

                    // Nothing charged by it uses the receipt - it shouldn't be left orphaned on disk
                    expect(subscriptionHelper.getExpenses(id).len()).toBe(0);
                    expect(fileExists("#user.getDir()#/#receipt#.webp")).toBeFalse();
                });

                it("Keeps a deleted subscription's receipt until the last expense it charged is deleted", () => {
                    var description = createUUID();
                    var receipt     = createUUID();
                    var path        = fetchAndWriteImg("https://picsum.photos/seed/test/200/200", "jpeg");
                    fileCopy(source = path, destination = "#user.getDir()#/#receipt#.webp");
                    var id = subscriptionHelper.insert(
                        data = subscriptionHelper.mock(
                            date        = dateAdd("d", randRange(-31, -2), dateAdd("m", -3, now())),
                            interval    = "M",
                            userid      = user.getId(),
                            receipt     = receipt,
                            description = description
                        ),
                        active = true
                    );

                    // Each charge() run charges one interval - it's ~3 months overdue, so run it a few times for several expenses
                    for(var run = 1; run <= 3; run++) {
                        getInstance("services.subscription").charge(id);
                    }

                    var expenses = subscriptionHelper.getExpenses(id);
                    expect(expenses.len()).toBeGTE(2);

                    // Delete the subscription - its expenses still use the receipt
                    delete(route = "/api/v1/subscriptions/#id#", headers = {"x-auth-token": jwt});
                    expect(subscriptionHelper.load(id)).toBeEmpty();
                    expect(fileExists("#user.getDir()#/#receipt#.webp")).toBeTrue();

                    // Every expense but the last keeps the file
                    for(var i = 1; i < expenses.len(); i++) {
                        setup();
                        delete(route = "/api/v1/expenses/#expenses[i].id#", headers = {"x-auth-token": jwt});
                        expect(fileExists("#user.getDir()#/#receipt#.webp")).toBeTrue("Deleted after expense #i# of #expenses.len()#");
                    }

                    // The last one deletes it
                    setup();
                    delete(route = "/api/v1/expenses/#expenses[expenses.len()].id#", headers = {"x-auth-token": jwt});
                    expect(fileExists("#user.getDir()#/#receipt#.webp")).toBeFalse();
                });

                it("Can delete an expense charged by subscription, but this will not delete the subscription's receipt", () => {
                    /**
                     * Mock subscription with receipt that will charge immediately
                     */
                    var description = createUUID();
                    var receipt     = createUUID();
                    var path        = fetchAndWriteImg("https://picsum.photos/seed/test/200/200", "jpeg");
                    fileCopy(source = path, destination = "#user.getDir()#/#receipt#.webp");
                    var id = subscriptionHelper.insert(
                        data = subscriptionHelper.mock(
                            date        = dateAdd("d", randRange(-31, -2), dateAdd("m", -3, now())),
                            interval    = "M",
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
                    getInstance("services.subscription").charge(subscription.id);

                    var expenses = subscriptionHelper.getExpenses(subscription.id);
                    expect(expenses.len()).toBeGTE(1);

                    // Delete an expense
                    var event = delete(route = "/api/v1/expenses/#expenses[1].id#", headers = {"x-auth-token": jwt});

                    // Verify the receipt did NOT delete
                    expect(fileExists("#user.getDir()#/#receipt#.webp")).toBeTrue();
                });
            });
        });
    }

}
