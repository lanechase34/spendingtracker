component extends="tests.resources.baseTest" {

    property name="uploadPath" inject="coldbox:setting:uploadPath";

    function beforeAll() {
        super.beforeAll();

        expenseService = getInstance('services.expense');
        mockUser       = getInstance('tests.resources.mockuser');

        user = mockUser.make();
        jwt  = mockUser.login(user);
    }

    function afterAll() {
        super.afterAll();

        mockUser.logout(user, jwt);
        mockUser.delete(user);
    }

    function run() {
        describe('expenseService.getReceipt', () => {
            beforeEach(() => {
                setup();
            });

            it('Returns the receipt file path for an expense with a valid receipt', () => {
                var receipt     = createUUID();
                var receiptPath = '#user.getDir()#/#receipt#.webp';
                fileWrite(receiptPath, 'dummy');

                var id = expenseHelper.mock(
                    userid      = user.getId(),
                    count       = 1,
                    date        = now(),
                    description = 'Expense with receipt',
                    categoryid  = 1,
                    receipt     = receipt
                ).ids[1];

                var result = expenseService.getReceipt(
                    id      = id,
                    userDir = user.getDir(),
                    userid  = user.getId()
                );

                expect(result).toBe(receiptPath);
                expect(fileExists(result)).toBeTrue();

                fileDelete(receiptPath);
            });

            it('Returns 404 image path when expense has no receipt', () => {
                var id = expenseHelper.mock(
                    userid      = user.getId(),
                    count       = 1,
                    date        = now(),
                    description = 'Expense without receipt',
                    categoryid  = 1
                ).ids[1];

                var result = expenseService.getReceipt(
                    id      = id,
                    userDir = user.getDir(),
                    userid  = user.getId()
                );

                expect(result).toInclude('404.webp');
            });

            it('Returns 404 image path when the expense belongs to another user', () => {
                var otherUser = mockUser.make();

                var id = expenseHelper.mock(
                    userid      = otherUser.getId(),
                    count       = 1,
                    date        = now(),
                    description = 'Other user expense',
                    categoryid  = 1
                ).ids[1];

                // Request using the primary user - the query finds no record, so we get 404
                var result = expenseService.getReceipt(
                    id      = id,
                    userDir = user.getDir(),
                    userid  = user.getId()
                );

                expect(result).toInclude('404.webp');

                mockUser.delete(otherUser);
            });

            it('Returns 404 image path for a non-existent expense id', () => {
                var result = expenseService.getReceipt(
                    id      = 999999999,
                    userDir = user.getDir(),
                    userid  = user.getId()
                );

                expect(result).toInclude('404.webp');
            });

            it('Returns 404 image path when the receipt UUID is in the DB but the file is missing from disk', () => {
                // Insert a receipt UUID into the record but intentionally skip creating the file
                var receipt = createUUID();

                var id = expenseHelper.mock(
                    userid      = user.getId(),
                    count       = 1,
                    date        = now(),
                    description = 'Expense with orphaned receipt reference',
                    categoryid  = 1,
                    receipt     = receipt
                ).ids[1];

                var result = expenseService.getReceipt(
                    id      = id,
                    userDir = user.getDir(),
                    userid  = user.getId()
                );

                expect(result).toInclude('404.webp');
                expect(fileExists('#user.getDir()#/#receipt#.webp')).toBeFalse();
            });

            it('Returns empty string when return404 is false and expense has no receipt', () => {
                var id = expenseHelper.mock(
                    userid      = user.getId(),
                    count       = 1,
                    date        = now(),
                    description = 'Expense for return404=false test',
                    categoryid  = 1
                ).ids[1];

                var result = expenseService.getReceipt(
                    id        = id,
                    userDir   = user.getDir(),
                    userid    = user.getId(),
                    return404 = false
                );

                expect(result).toBe('');
            });

            it('Returns empty string when return404 is false and expense belongs to another user', () => {
                var otherUser = mockUser.make();

                var id = expenseHelper.mock(
                    userid      = otherUser.getId(),
                    count       = 1,
                    date        = now(),
                    description = 'Other user expense return404=false',
                    categoryid  = 1
                ).ids[1];

                var result = expenseService.getReceipt(
                    id        = id,
                    userDir   = user.getDir(),
                    userid    = user.getId(),
                    return404 = false
                );

                expect(result).toBe('');

                mockUser.delete(otherUser);
            });
        });
    }

}
