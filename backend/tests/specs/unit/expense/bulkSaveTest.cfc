component extends="tests.resources.baseTest" {

    function beforeAll() {
        super.beforeAll();

        categoryService = getInstance('services.category');
        q               = getInstance('provider:QueryBuilder@qb');
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

    /**
     * Count how many categories with the given name exist for the user
     */
    private numeric function countCategoriesForUser(required string name, required numeric userid) {
        return q
            .from('category')
            .where('name', '=', name)
            .where('userid', '=', userid)
            .count();
    }

    function run() {
        describe('POST /expenses/bulk', () => {
            beforeEach(() => {
                setup();
                expenseCount = expenseHelper.count(user.getId());
            });

            it('Returns 401 without authentication', () => {
                var event = post(route = '/api/v1/expenses/bulk', params = {expenses: serializeJSON([])});

                expect(event.getResponse().getStatusCode()).toBe(401);
            });

            describe('Input validation', () => {
                it('Returns 400 when the expenses param is missing entirely', () => {
                    var event = post(
                        route   = '/api/v1/expenses/bulk',
                        headers = {'x-auth-token': jwt},
                        params  = {}
                    );

                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(400);
                    expect(response.getError()).toBeTrue();
                    expect(response.getMessages()[1]).toBe('Invalid Parameters.');
                });

                it('Returns 400 when the expenses param is not valid JSON', () => {
                    var event = post(
                        route   = '/api/v1/expenses/bulk',
                        headers = {'x-auth-token': jwt},
                        params  = {expenses: 'not-valid-json'}
                    );

                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(400);
                    expect(response.getError()).toBeTrue();
                    expect(response.getMessages()[1]).toBe('Invalid Parameters.');
                });
            });

            describe('Saving expenses with existing categories', () => {
                it('Saves a single expense using an existing categoryid', () => {
                    var event = post(
                        route   = '/api/v1/expenses/bulk',
                        headers = {'x-auth-token': jwt},
                        params  = {
                            expenses: serializeJSON([
                                {
                                    id         : createUUID(),
                                    date       : createDate(year(now()), month(now()), day(now())),
                                    amount     : 50.00,
                                    description: 'Single expense',
                                    categoryid : 1
                                }
                            ])
                        }
                    );

                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(200);
                    expect(response.getError()).toBeFalse();
                    expect(response.getMessages()[1]).toBe('Successfully saved expenses');
                    expect(expenseHelper.count(user.getId())).toBe(expenseCount + 1);
                });

                it('Saves multiple expenses using existing categoryids', () => {
                    var event = post(
                        route   = '/api/v1/expenses/bulk',
                        headers = {'x-auth-token': jwt},
                        params  = {
                            expenses: serializeJSON([
                                {
                                    id         : createUUID(),
                                    date       : createDate(year(now()), month(now()), day(now())),
                                    amount     : 10.00,
                                    description: 'Expense 1',
                                    categoryid : 1
                                },
                                {
                                    id         : createUUID(),
                                    date       : createDate(year(now()), month(now()), day(now()) + 1),
                                    amount     : 20.00,
                                    description: 'Expense 2',
                                    categoryid : 2
                                },
                                {
                                    id         : createUUID(),
                                    date       : createDate(year(now()), month(now()), day(now()) + 2),
                                    amount     : 30.00,
                                    description: 'Expense 3',
                                    categoryid : 3
                                }
                            ])
                        }
                    );

                    expect(event.getResponse().getStatusCode()).toBe(200);
                    expect(expenseHelper.count(user.getId())).toBe(expenseCount + 3);
                });

                it('Returns 200 with an empty errors struct when all expenses save successfully', () => {
                    var event = post(
                        route   = '/api/v1/expenses/bulk',
                        headers = {'x-auth-token': jwt},
                        params  = {
                            expenses: serializeJSON([
                                {
                                    id         : createUUID(),
                                    date       : createDate(year(now()), month(now()), day(now())),
                                    amount     : 10.00,
                                    description: 'Expense 1',
                                    categoryid : 1
                                },
                                {
                                    id         : createUUID(),
                                    date       : createDate(year(now()), month(now()), day(now()) + 1),
                                    amount     : 20.00,
                                    description: 'Expense 2',
                                    categoryid : 4
                                }
                            ])
                        }
                    );

                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(200);
                    expect(response.getData()).toBeStruct();
                    expect(response.getData()).toBeEmpty();
                });
            });

            describe('Saving expenses with new categories', () => {
                it('Creates a new category and saves the expense when only a category name is provided', () => {
                    var newCategory = 'Bulkcat#randRange(100000, 999999)#';

                    var event = post(
                        route   = '/api/v1/expenses/bulk',
                        headers = {'x-auth-token': jwt},
                        params  = {
                            expenses: serializeJSON([
                                {
                                    id         : createUUID(),
                                    date       : createDate(year(now()), month(now()), day(now())),
                                    amount     : 35.00,
                                    description: 'New category expense',
                                    category   : newCategory
                                }
                            ])
                        }
                    );

                    expect(event.getResponse().getStatusCode()).toBe(200);
                    expect(expenseHelper.count(user.getId())).toBe(expenseCount + 1);

                    var created = categoryService.getFromName(ucFirst(lCase(newCategory)));
                    expect(created).toHaveKey('id');
                });

                it('Handles a mix of existing categoryid and new category name in the same batch', () => {
                    var newCategory = 'Mixedcat#randRange(100000, 999999)#';

                    var event = post(
                        route   = '/api/v1/expenses/bulk',
                        headers = {'x-auth-token': jwt},
                        params  = {
                            expenses: serializeJSON([
                                {
                                    id         : createUUID(),
                                    date       : createDate(year(now()), month(now()), day(now())),
                                    amount     : 10.00,
                                    description: 'Existing category',
                                    categoryid : 1
                                },
                                {
                                    id         : createUUID(),
                                    date       : createDate(year(now()), month(now()), day(now())),
                                    amount     : 20.00,
                                    description: 'New category',
                                    category   : newCategory
                                },
                                {
                                    id         : createUUID(),
                                    date       : createDate(year(now()), month(now()), day(now())),
                                    amount     : 30.00,
                                    description: 'Same new category',
                                    category   : newCategory
                                }
                            ])
                        }
                    );

                    expect(event.getResponse().getStatusCode()).toBe(200);
                    expect(expenseHelper.count(user.getId())).toBe(expenseCount + 3);

                    // r2 and r3 share the same new category - only one should have been created
                    expect(countCategoriesForUser(ucFirst(lCase(newCategory)), user.getId())).toBe(1);
                });
            });

            describe('Concurrent category creation lock', () => {
                it('Creates exactly one category when multiple parallel expenses share the same new category name', () => {
                    var sharedCategory = 'Locktest#randRange(100000, 999999)#';
                    var expenses       = [];

                    for(var i = 1; i <= 5; i++) {
                        expenses.append({
                            id         : '#i#_#createUUID()#',
                            date       : createDate(year(now()), month(now()), day(now())),
                            amount     : 10.00,
                            description: 'Lock test expense #i#',
                            category   : sharedCategory
                        });
                    }

                    var event = post(
                        route   = '/api/v1/expenses/bulk',
                        headers = {'x-auth-token': jwt},
                        params  = {expenses: serializeJSON(expenses)}
                    );

                    expect(event.getResponse().getStatusCode()).toBe(200);
                    expect(expenseHelper.count(user.getId())).toBe(expenseCount + 5);

                    // The lock must ensure only one category is created despite parallel thread execution
                    expect(countCategoriesForUser(ucFirst(lCase(sharedCategory)), user.getId())).toBe(1);
                });

                it('Normalizes category name casing and deduplicates across different casings of the same name', () => {
                    var baseName = 'Casetest#randRange(100000, 999999)#';

                    var event = post(
                        route   = '/api/v1/expenses/bulk',
                        headers = {'x-auth-token': jwt},
                        params  = {
                            expenses: serializeJSON([
                                {
                                    id         : createUUID(),
                                    date       : createDate(year(now()), month(now()), day(now())),
                                    amount     : 10.00,
                                    description: 'Uppercase',
                                    category   : uCase(baseName)
                                },
                                {
                                    id         : createUUID(),
                                    date       : createDate(year(now()), month(now()), day(now())),
                                    amount     : 10.00,
                                    description: 'Lowercase',
                                    category   : lCase(baseName)
                                },
                                {
                                    id         : createUUID(),
                                    date       : createDate(year(now()), month(now()), day(now())),
                                    amount     : 10.00,
                                    description: 'Mixed case',
                                    category   : baseName
                                }
                            ])
                        }
                    );

                    expect(event.getResponse().getStatusCode()).toBe(200);
                    expect(expenseHelper.count(user.getId())).toBe(expenseCount + 3);

                    // All three casing variants normalize to ucFirst(lCase(...)) and only one category created
                    expect(countCategoriesForUser(ucFirst(lCase(baseName)), user.getId())).toBe(1);
                });
            });

            describe('Receipt validation', () => {
                it('Returns 400 and records a per-expense error when a receipt upload is invalid', () => {
                    // Sending receipt_<id> in params signals a receipt was submitted for that expense.
                    // imageService.validateUpload will fail (no real file upload in test) and return '',
                    // which adds that expense to the errors map and skips saving it.
                    var event = post(
                        route   = '/api/v1/expenses/bulk',
                        headers = {'x-auth-token': jwt},
                        params  = {
                            expenses: serializeJSON([
                                {
                                    id         : 'valid',
                                    date       : createDate(year(now()), month(now()), day(now())),
                                    amount     : 10.00,
                                    description: 'No receipt',
                                    categoryid : 1
                                },
                                {
                                    id         : 'invalid',
                                    date       : createDate(year(now()), month(now()), day(now())),
                                    amount     : 20.00,
                                    description: 'Bad receipt',
                                    categoryid : 1
                                }
                            ]),
                            receipt_invalid: ''
                        }
                    );

                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(400);
                    expect(response.getError()).toBeTrue();

                    var errors = response.getData();
                    expect(errors).toHaveKey('expense_invalid');
                    expect(errors['expense_invalid']).toBe('Invalid receipt upload.');

                    // The valid expense was still saved
                    expect(expenseHelper.count(user.getId())).toBe(expenseCount + 1);
                });

                it('Returns 400 with all expenses in the errors map when every receipt is invalid', () => {
                    var event = post(
                        route   = '/api/v1/expenses/bulk',
                        headers = {'x-auth-token': jwt},
                        params  = {
                            expenses: serializeJSON([
                                {
                                    id         : 'invalid_1',
                                    date       : createDate(year(now()), month(now()), day(now())),
                                    amount     : 10.00,
                                    description: 'Expense 1',
                                    categoryid : 1
                                },
                                {
                                    id         : 'invalid_2',
                                    date       : createDate(year(now()), month(now()), day(now())),
                                    amount     : 20.00,
                                    description: 'Expense 2',
                                    categoryid : 1
                                }
                            ]),
                            receipt_invalid_1: '',
                            receipt_invalid_2: ''
                        }
                    );

                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(400);

                    var errors = response.getData();
                    expect(errors).toHaveKey('expense_invalid_1');
                    expect(errors).toHaveKey('expense_invalid_2');
                    expect(expenseHelper.count(user.getId())).toBe(expenseCount);
                });
            });
        });
    }

}
