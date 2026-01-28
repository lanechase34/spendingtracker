component extends="tests.resources.baseTest" {

    property name="uploadPath" inject="coldbox:setting:uploadPath";

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
        describe('expense.remove', () => {
            beforeEach(() => {
                setup();
            });

            it('Can DELETE an expense', () => {
                var id = expenseHelper.mock(
                    userid      = user.getId(),
                    count       = 1,
                    date        = now(),
                    description = 'Will delete',
                    categoryid  = 1
                ).ids[1];

                var beforeCount = expenseHelper.count(user.getId());
                expect(beforeCount).toBe(1);

                var event = delete(route = '/api/v1/expenses/#id#', headers = {'x-auth-token': jwt});

                // Verify JSON response
                var response = event.getResponse();
                expect(response.getStatusCode()).toBe(200);
                expect(response.getError()).toBeFalse();
                expect(response.getMessages()[1]).toBe('Successfully deleted expense.');

                // Verify deleted
                expect(expenseHelper.count(user.getId())).toBe(beforeCount - 1);
            });

            describe('Category integration', () => {
                it('Can DELETE an expense with a custom category, and custom category stays', () => {
                    // Create new category
                    var newCategory = left(createUUID(), 30);
                    var categoryid  = categoryService.save(name = newCategory, userid = user.getId());
                    expect(categoryid).toBeNumeric();
                    expect(categoryid).toBeGTE(1);

                    var id = expenseHelper.mock(
                        userid      = user.getId(),
                        count       = 1,
                        date        = now(),
                        description = 'Will delete w/ custom category',
                        categoryid  = categoryid
                    ).ids[1];

                    var beforeCount = expenseHelper.count(user.getId());
                    expect(beforeCount).toBe(1);

                    var event = delete(route = '/api/v1/expenses/#id#', headers = {'x-auth-token': jwt});

                    // Verify JSON response
                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(200);
                    expect(response.getError()).toBeFalse();
                    expect(response.getMessages()[1]).toBe('Successfully deleted expense.');

                    // Verify deleted
                    expect(expenseHelper.count(user.getId())).toBe(beforeCount - 1);

                    // Verify category still exists
                    var category = categoryService.getFromName(newCategory);
                    expect(category).toBeStruct();
                    expect(category).toHaveKey('id');
                    expect(category.id).toBeGTE(1);
                });
            });

            describe('Receipt integration', () => {
                it('Can delete an expense with a receipt, and the receipt deletes', () => {
                    /**
                     * Mock an expense with a receipt
                     */
                    var receipt = createUUID();
                    fileCopy(source = '#uploadPath#/404.webp', destination = '#user.getDir()#/#receipt#.webp');

                    var id = expenseHelper.mock(
                        userid      = user.getId(),
                        count       = 1,
                        date        = now(),
                        description = 'Expense w/ receipt',
                        categoryid  = 1,
                        receipt     = receipt
                    ).ids[1];

                    var beforeCount = expenseHelper.count(user.getId());
                    expect(beforeCount).toBe(1);

                    var event = delete(route = '/api/v1/expenses/#id#', headers = {'x-auth-token': jwt});

                    // Verify JSON response
                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(200);
                    expect(response.getError()).toBeFalse();
                    expect(response.getMessages()[1]).toBe('Successfully deleted expense.');

                    // Verify deleted
                    expect(expenseHelper.count(user.getId())).toBe(beforeCount - 1);

                    // Verify receipt deleted
                    expect(fileExists('#user.getDir()#/#receipt#.webp')).toBeFalse();
                });
            });
        });
    }

}
