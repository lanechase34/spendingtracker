component extends="tests.resources.baseTest" {

    function beforeAll() {
        super.beforeAll();

        categoryService = getInstance('services.category');
        mockUser        = getInstance('tests.resources.mockuser');

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
        describe('POST /expenses', () => {
            beforeEach(() => {
                setup();

                /**
                 * Count the total records for the user before each test
                 */
                expenseCount = expenseHelper.count(user.getId());
            });

            it('Can POST expense to expense.save', () => {
                var event = post(
                    route   = '/api/v1/expenses',
                    headers = {'x-auth-token': jwt},
                    params  = {
                        date       : now(),
                        amount     : randRange(1, 100),
                        description: 'Posting to /expenses #createUUID()#',
                        categoryid : 1,
                        receipt    : ''
                    }
                );

                // Verify JSON response
                var response = event.getResponse();
                expect(response.getStatusCode()).toBe(200);
                expect(response.getError()).toBeFalse();
                expect(response.getMessages()[1]).toBe('Successfully saved expense.');

                // Verify expense saved
                expect(expenseHelper.count(user.getId())).toBe(expenseCount + 1);
            });

            describe('Category integration', () => {
                it('Save expense with a new category', () => {
                    var newCategory = left(createUUID(), 30);
                    var beforeCheck = categoryService.getFromName(newCategory);
                    expect(beforeCheck).toBeStruct();
                    expect(beforeCheck).toBeEmpty();

                    // Post expense with the new category
                    var event = post(
                        route   = '/api/v1/expenses',
                        headers = {'x-auth-token': jwt},
                        params  = {
                            date       : now(),
                            amount     : randRange(1, 100),
                            description: 'Posting new category to /expenses #createUUID()#',
                            category   : newCategory,
                            receipt    : ''
                        }
                    );

                    // Verify JSON response
                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(200);
                    expect(response.getError()).toBeFalse();
                    expect(response.getMessages()[1]).toBe('Successfully saved expense.');

                    // Verify expense saved
                    expect(expenseHelper.count(user.getId())).toBe(expenseCount + 1);

                    // Verify new category made
                    var afterCheck = categoryService.getFromName(newCategory);
                    expect(afterCheck).toBeStruct();
                    expect(afterCheck).toHaveKey('id');
                    expect(afterCheck.id).toBeGT(1);
                });

                it('Prevents saving expense with an invalid new category (too long)', () => {
                    var newCategory = left(createUUID(), 31);
                    var beforeCheck = categoryService.getFromName(newCategory);
                    expect(beforeCheck).toBeStruct();
                    expect(beforeCheck).toBeEmpty();

                    var event = post(
                        route   = '/api/v1/expenses',
                        headers = {'x-auth-token': jwt},
                        params  = {
                            date       : now(),
                            amount     : randRange(1, 100),
                            description: 'Posting invalid category to expense.save #createUUID()#',
                            category   : newCategory,
                            receipt    : ''
                        }
                    );

                    // Verify JSON response
                    var response = event.getResponse();
                    expect(response.getFormat()).toBe('json');
                    expect(response.getStatusCode()).toBe(400); // bad request
                    expect(response.getError()).toBeTrue();
                    expect(response.getMessages()[1]).toBe('Invalid Parameters. The ''category'' value is not in the required size range (3..30)');

                    // Verify no expense nor category was made
                    expect(expenseHelper.count(user.getId())).toBe(expenseCount);
                    var afterCheck = categoryService.getFromName(newCategory);
                    expect(afterCheck).toBeStruct();
                    expect(afterCheck).toBeEmpty();
                });

                it('Prevents saving expense with a category that is already made', () => {
                    var event = post(
                        route   = '/api/v1/expenses',
                        headers = {'x-auth-token': jwt},
                        params  = {
                            date       : now(),
                            amount     : randRange(1, 100),
                            description: 'Posting invalid category to expense.save #createUUID()#',
                            category   : 'Grocery',
                            receipt    : ''
                        }
                    );

                    // Verify JSON response
                    var response = event.getResponse();
                    expect(response.getFormat()).toBe('json');
                    expect(response.getStatusCode()).toBe(400); // bad request
                    expect(response.getError()).toBeTrue();
                    expect(response.getMessages()[1]).toInclude('Invalid Parameters. Category name already exists.');

                    // Verify no expense made
                    expect(expenseHelper.count(user.getId())).toBe(expenseCount);
                });
            });

            describe('Category ownership (categoryid)', () => {
                it('Allows saving expense using own custom category', () => {
                    var ownCategoryId = categoryService.save(
                        name   = 'Own Category #left(createUUID(), 10)#',
                        userid = user.getId()
                    );

                    var event = post(
                        route   = '/api/v1/expenses',
                        headers = {'x-auth-token': jwt},
                        params  = {
                            date       : now(),
                            amount     : randRange(1, 100),
                            description: 'Expense with own category #createUUID()#',
                            categoryid : ownCategoryId,
                            receipt    : ''
                        }
                    );

                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(200);
                    expect(response.getError()).toBeFalse();
                    expect(response.getMessages()[1]).toBe('Successfully saved expense.');
                    expect(expenseHelper.count(user.getId())).toBe(expenseCount + 1);
                });

                it('Allows saving expense using a system category (userid IS NULL)', () => {
                    var event = post(
                        route   = '/api/v1/expenses',
                        headers = {'x-auth-token': jwt},
                        params  = {
                            date       : now(),
                            amount     : randRange(1, 100),
                            description: 'Expense with system category #createUUID()#',
                            categoryid : 1,
                            receipt    : ''
                        }
                    );

                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(200);
                    expect(response.getError()).toBeFalse();
                    expect(expenseHelper.count(user.getId())).toBe(expenseCount + 1);
                });

                it('Prevents saving expense using another user''s private category', () => {
                    // Create private category
                    var otherUser       = mockUser.make();
                    var otherCategoryId = categoryService.save(
                        name   = 'Private #left(createUUID(), 10)#',
                        userid = otherUser.getId()
                    );

                    // Attempt to use that category as a different user
                    var event = post(
                        route   = '/api/v1/expenses',
                        headers = {'x-auth-token': jwt},
                        params  = {
                            date       : now(),
                            amount     : randRange(1, 100),
                            description: 'Expense with stolen categoryid #createUUID()#',
                            categoryid : otherCategoryId,
                            receipt    : ''
                        }
                    );

                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(400);
                    expect(response.getError()).toBeTrue();
                    expect(response.getMessages()[1]).toBe('Invalid Parameters. Categoryid not valid.');
                    expect(expenseHelper.count(user.getId())).toBe(expenseCount);
                });
            });
        });
    }

}
