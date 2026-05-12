component extends="tests.resources.baseTest" {

    function beforeAll() {
        super.beforeAll();

        mockUser = getInstance('tests.resources.mockuser');

        user = mockUser.make();
        jwt  = mockUser.login(user);
    }

    function afterAll() {
        super.afterAll();

        mockUser.logout(user, jwt);
        mockUser.delete(user);
    }

    /**
     * Write CSV content to a temp file and return its absolute path
     */
    private string function writeCsv(required string content) {
        var path = '#tempDir#/#createUUID()#.csv';
        fileWrite(path, content);
        return path;
    }

    private string function makeRandDate() {
        var y = year(now());
        var m = max(1, min(12, month(now()) + randRange(-3, 3)));
        var d = max(28, min(1, day(now()) + randRange(-10, 10)));

        return dateFormat(createDate(y, m, d), 'yyyy-mm-dd');
    }

    function run() {
        describe('POST /expenses/import', () => {
            beforeEach(() => {
                setup();
            });

            it('Returns 401 without authentication', () => {
                var event = post(
                    route  = '/api/v1/expenses/import',
                    params = {expenseFile: writeCsv('Date,Amount,Description')}
                );

                expect(event.getResponse().getStatusCode()).toBe(401);
            });

            describe('File validation', () => {
                it('Returns 400 when no file param is provided', () => {
                    var event = post(
                        route   = '/api/v1/expenses/import',
                        headers = {'x-auth-token': jwt},
                        params  = {}
                    );

                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(400);
                    expect(response.getError()).toBeTrue();
                    expect(response.getMessages()[1]).toBe('Error loading file. Please use the template provided');
                });

                it('Returns 400 when file path is an empty string', () => {
                    var event = post(
                        route   = '/api/v1/expenses/import',
                        headers = {'x-auth-token': jwt},
                        params  = {expenseFile: ''}
                    );

                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(400);
                    expect(response.getError()).toBeTrue();
                    expect(response.getMessages()[1]).toBe('Error loading file. Please use the template provided');
                });

                it('Returns 400 when file path does not exist on disk', () => {
                    var event = post(
                        route   = '/api/v1/expenses/import',
                        headers = {'x-auth-token': jwt},
                        params  = {expenseFile: '#tempDir#/nonexistent_#createUUID()#.csv'}
                    );

                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(400);
                    expect(response.getError()).toBeTrue();
                    expect(response.getMessages()[1]).toBe('Error loading file. Please use the template provided');
                });

                it('Returns 400 when CSV headers do not match the expected format', () => {
                    var event = post(
                        route   = '/api/v1/expenses/import',
                        headers = {'x-auth-token': jwt},
                        params  = {
                            expenseFile: writeCsv(
                                'Date,Price,Notes' & chr(10) &
                                '#makeRandDate()#,50.00,Groceries'
                            )
                        }
                    );

                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(400);
                    expect(response.getError()).toBeTrue();
                    expect(response.getMessages()[1]).toBe('Please verify columns match exactly: Date, Amount, Description');
                });

                it('Returns 400 when CSV is missing required columns', () => {
                    var event = post(
                        route   = '/api/v1/expenses/import',
                        headers = {'x-auth-token': jwt},
                        params  = {
                            expenseFile: writeCsv(
                                'Date,Amount' & chr(10) &
                                '#makeRandDate()#,50.00'
                            )
                        }
                    );

                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(400);
                    expect(response.getError()).toBeTrue();
                    expect(response.getMessages()[1]).toBe('Please verify columns match exactly: Date, Amount, Description');
                });

                it('Returns 400 when CSV exceeds the 100-row limit', () => {
                    var rows = ['Date,Amount,Description'];
                    for(var i = 1; i <= 101; i++) {
                        rows.append('#makeRandDate()#,10.00,Expense #i#');
                    }

                    var event = post(
                        route   = '/api/v1/expenses/import',
                        headers = {'x-auth-token': jwt},
                        params  = {expenseFile: writeCsv(rows.toList(chr(10)))}
                    );

                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(400);
                    expect(response.getError()).toBeTrue();
                    expect(response.getMessages()[1]).toBe('Error file contains too many rows. Please limit to a maximum of 100 rows');
                });
            });

            describe('Successful imports', () => {
                it('Returns 200 with imported rows and an empty errors array for a fully valid CSV', () => {
                    var event = post(
                        route   = '/api/v1/expenses/import',
                        headers = {'x-auth-token': jwt},
                        params  = {
                            expenseFile: writeCsv(
                                'Date,Amount,Description' & chr(10) &
                                '#makeRandDate()#,50.00,Groceries' & chr(10) &
                                '#makeRandDate()#,25.50,Coffee' & chr(10) &
                                '#makeRandDate()#,100.00,Utilities'
                            )
                        }
                    );

                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(200);
                    expect(response.getError()).toBeFalse();

                    var data = response.getData();
                    expect(data).toHaveKey('imported');
                    expect(data).toHaveKey('errored');
                    expect(data.imported.len()).toBe(3);
                    expect(data.errored.len()).toBe(0);
                });

                it('Imported rows have the correct structure with parsed amount', () => {
                    var event = post(
                        route   = '/api/v1/expenses/import',
                        headers = {'x-auth-token': jwt},
                        params  = {
                            expenseFile: writeCsv(
                                'Date,Amount,Description' & chr(10) &
                                '#makeRandDate()#,75.99,Restaurant'
                            )
                        }
                    );

                    var importedRow = event.getResponse().getData().imported[1];
                    expect(importedRow).toHaveKey('date');
                    expect(importedRow).toHaveKey('amount');
                    expect(importedRow).toHaveKey('description');
                    expect(importedRow.amount).toBe(75.99);
                    expect(importedRow.description).toBe('Restaurant');
                });

                it('Accepts exactly 100 rows (the maximum limit)', () => {
                    var rows = ['Date,Amount,Description'];
                    for(var i = 1; i <= 100; i++) {
                        rows.append('#makeRandDate()#,10.00,Expense #i#');
                    }

                    var event = post(
                        route   = '/api/v1/expenses/import',
                        headers = {'x-auth-token': jwt},
                        params  = {expenseFile: writeCsv(rows.toList(chr(10)))}
                    );

                    var data = event.getResponse().getData();
                    expect(event.getResponse().getStatusCode()).toBe(200);
                    expect(data.imported.len()).toBe(100);
                    expect(data.errored.len()).toBe(0);
                });

                it('Does not save any expenses to the database - import is preview only', () => {
                    var beforeCount = expenseHelper.count(user.getId());

                    var event = post(
                        route   = '/api/v1/expenses/import',
                        headers = {'x-auth-token': jwt},
                        params  = {
                            expenseFile: writeCsv(
                                'Date,Amount,Description' & chr(10) &
                                '#makeRandDate()#,50.00,Groceries' & chr(10) &
                                '#makeRandDate()#,25.00,Coffee'
                            )
                        }
                    );

                    expect(event.getResponse().getStatusCode()).toBe(200);
                    expect(expenseHelper.count(user.getId())).toBe(beforeCount);
                });
            });

            describe('Row-level validation', () => {
                it('Separates valid and invalid rows, returning both in the response', () => {
                    var event = post(
                        route   = '/api/v1/expenses/import',
                        headers = {'x-auth-token': jwt},
                        params  = {
                            expenseFile: writeCsv(
                                'Date,Amount,Description' & chr(10) &
                                '#makeRandDate()#,50.00,Groceries' & chr(10) &
                                'notadate,notanumber,Coffee' & chr(10) &
                                '#makeRandDate()#,100.00,Utilities'
                            )
                        }
                    );

                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(200);
                    expect(response.getError()).toBeFalse();

                    var data = response.getData();
                    expect(data.imported.len()).toBe(2);
                    expect(data.errored.len()).toBe(1);
                });

                it('Errored rows include the CSV row number (accounting for the header row)', () => {
                    // CSV layout: header=row1, valid=row2(index1), invalid=row3(index2), valid=row4(index3)
                    // error.row = index + 1 = 3
                    var event = post(
                        route   = '/api/v1/expenses/import',
                        headers = {'x-auth-token': jwt},
                        params  = {
                            expenseFile: writeCsv(
                                'Date,Amount,Description' & chr(10) &
                                '#makeRandDate()#,50.00,Groceries' & chr(10) &
                                'notadate,notanumber,Coffee' & chr(10) &
                                '#makeRandDate()#,100.00,Utilities'
                            )
                        }
                    );

                    var erroredRow = event.getResponse().getData().errored[1];
                    expect(erroredRow).toHaveKey('row');
                    expect(erroredRow).toHaveKey('message');
                    expect(erroredRow.row).toBe(3);
                });

                it('Returns an empty imported array when every row has invalid data', () => {
                    var event = post(
                        route   = '/api/v1/expenses/import',
                        headers = {'x-auth-token': jwt},
                        params  = {
                            expenseFile: writeCsv(
                                'Date,Amount,Description' & chr(10) &
                                'notadate,notanumber,Expense 1' & chr(10) &
                                'notadate,notanumber,Expense 2' & chr(10) &
                                'notadate,notanumber,Expense 3'
                            )
                        }
                    );

                    var data = event.getResponse().getData();
                    expect(data.imported.len()).toBe(0);
                    expect(data.errored.len()).toBe(3);
                });

                it('Rejects rows with an invalid date', () => {
                    var event = post(
                        route   = '/api/v1/expenses/import',
                        headers = {'x-auth-token': jwt},
                        params  = {
                            expenseFile: writeCsv(
                                'Date,Amount,Description' & chr(10) &
                                '99/99/9999,50.00,Bad date row'
                            )
                        }
                    );

                    var data = event.getResponse().getData();
                    expect(data.imported.len()).toBe(0);
                    expect(data.errored.len()).toBe(1);
                });

                it('Rejects rows with a non-numeric amount', () => {
                    var event = post(
                        route   = '/api/v1/expenses/import',
                        headers = {'x-auth-token': jwt},
                        params  = {
                            expenseFile: writeCsv(
                                'Date,Amount,Description' & chr(10) &
                                '#makeRandDate()#,fifty,Bad amount row'
                            )
                        }
                    );

                    var data = event.getResponse().getData();
                    expect(data.imported.len()).toBe(0);
                    expect(data.errored.len()).toBe(1);
                });
            });
        });
    }

}
