component extends="tests.resources.baseTest" {

    function beforeAll() {
        super.beforeAll();

        mockUser = getInstance("tests.resources.mockuser");

        user = mockUser.make();
        jwt  = mockUser.login(user);

        expenseService = getInstance("services.expense");
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
        var path = "#tempDir#/#createUUID()#.csv";
        fileWrite(path, content);
        return path;
    }

    private string function makeRandDate() {
        var y = year(now());
        var m = max(1, min(12, month(now()) + randRange(-3, 3)));
        var d = min(28, max(1, day(now()) + randRange(-10, 10)));

        return dateFormat(createDate(y, m, d), "yyyy-mm-dd");
    }

    function run() {
        describe("POST /expenses/import", () => {
            beforeEach(() => {
                setup();
            });

            it("Returns 401 without authentication", () => {
                var event = post(route = "/api/v1/expenses/import", params = {});

                expect(event.getResponse().getStatusCode()).toBe(401);
            });

            it("Returns 400 when no file is uploaded", () => {
                var event = post(
                    route   = "/api/v1/expenses/import",
                    headers = {"x-auth-token": jwt},
                    params  = {}
                );

                var response = event.getResponse();
                expect(response.getStatusCode()).toBe(400);
                expect(response.getError()).toBeTrue();
                expect(response.getMessages()[1]).toBe("Error loading file. Please use the template provided");
            });

            describe("Never reads a server path sent as a plain value", () => {
                var validCsv = () => writeCsv("Date,Amount,Description" & chr(10) & "#makeRandDate()#,50.00,Groceries");

                it("Rejects an existing, valid csv path sent as a form field", () => {
                    var event = post(
                        route   = "/api/v1/expenses/import",
                        headers = {"x-auth-token": jwt},
                        params  = {expenseFile: validCsv()}
                    );

                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(400);
                    expect(response.getMessages()[1]).toBe("Error loading file. Please use the template provided");
                    expect(response.getHasData()).toBeFalse();
                });

                it("Gives the same response for a path that exists and one that does not", () => {
                    var existing = post(
                        route   = "/api/v1/expenses/import",
                        headers = {"x-auth-token": jwt},
                        params  = {expenseFile: validCsv()}
                    ).getResponse();

                    setup();

                    var missing = post(
                        route   = "/api/v1/expenses/import",
                        headers = {"x-auth-token": jwt},
                        params  = {expenseFile: "#tempDir#/nonexistent_#createUUID()#.csv"}
                    ).getResponse();

                    // No file existence oracle
                    expect(existing.getStatusCode()).toBe(missing.getStatusCode());
                    expect(existing.getMessages()).toBe(missing.getMessages());
                });
            });
        });

        describe("expenseService.importUpload", () => {
            it("Returns the load error when the form field is not a file upload", () => {
                var result = expenseService.importUpload(formField = "expenseFile_#createUUID()#");

                expect(result.valid).toBeFalse();
                expect(result.message).toBe("Error loading file. Please use the template provided");
                expect(result.data).toBeEmpty();
            });

            it("Limits imports to 5mb", () => {
                expect(expenseService.getMaxImportFileSize()).toBe(5 * 1024 * 1024);
            });
        });

        describe("expenseService.processExpenseData", () => {
            describe("File validation", () => {
                it("Returns the load error when the path is an empty string", () => {
                    var result = expenseService.processExpenseData("");

                    expect(result.valid).toBeFalse();
                    expect(result.message).toBe("Error loading file. Please use the template provided");
                });

                it("Returns the load error when the file does not exist", () => {
                    var result = expenseService.processExpenseData("#tempDir#/nonexistent_#createUUID()#.csv");

                    expect(result.valid).toBeFalse();
                    expect(result.message).toBe("Error loading file. Please use the template provided");
                });

                it("Rejects CSV headers that do not match the expected format", () => {
                    var result = expenseService.processExpenseData(
                        writeCsv(
                            "Date,Price,Notes" & chr(10) &
                            "#makeRandDate()#,50.00,Groceries"
                        )
                    );

                    expect(result.valid).toBeFalse();
                    expect(result.message).toBe("Please verify columns match exactly: Date, Amount, Description");
                });

                it("Rejects a CSV missing required columns", () => {
                    var result = expenseService.processExpenseData(
                        writeCsv(
                            "Date,Amount" & chr(10) &
                            "#makeRandDate()#,50.00"
                        )
                    );

                    expect(result.valid).toBeFalse();
                    expect(result.message).toBe("Please verify columns match exactly: Date, Amount, Description");
                });

                it("Rejects a CSV over the 200-row limit", () => {
                    var rows = ["Date,Amount,Description"];
                    for(var i = 1; i <= 201; i++) {
                        rows.append("#makeRandDate()#,10.00,Expense #i#");
                    }

                    var result = expenseService.processExpenseData(writeCsv(rows.toList(chr(10))));

                    expect(result.valid).toBeFalse();
                    expect(result.message).toBe("Error file contains too many rows. Please limit to a maximum of 200 rows");
                });
            });

            describe("Successful imports", () => {
                it("Returns every row and no errors for a fully valid CSV", () => {
                    var result = expenseService.processExpenseData(
                        writeCsv(
                            "Date,Amount,Description" & chr(10) &
                            "#makeRandDate()#,50.00,Groceries" & chr(10) &
                            "#makeRandDate()#,25.50,Coffee" & chr(10) &
                            "#makeRandDate()#,100.00,Utilities"
                        )
                    );

                    expect(result.valid).toBeTrue();
                    expect(result.data.len()).toBe(3);
                    expect(result.errors.len()).toBe(0);
                });

                it("Imported rows have the correct structure with parsed amount", () => {
                    var result = expenseService.processExpenseData(
                        writeCsv(
                            "Date,Amount,Description" & chr(10) &
                            "#makeRandDate()#,75.99,Restaurant"
                        )
                    );

                    var importedRow = result.data[1];
                    expect(importedRow).toHaveKey("date");
                    expect(importedRow).toHaveKey("amount");
                    expect(importedRow).toHaveKey("description");
                    expect(importedRow.amount).toBe(75.99);
                    expect(importedRow.description).toBe("Restaurant");
                });

                it("Accepts exactly 200 rows (the maximum limit)", () => {
                    var rows = ["Date,Amount,Description"];
                    for(var i = 1; i <= 200; i++) {
                        rows.append("#makeRandDate()#,10.00,Expense #i#");
                    }

                    var result = expenseService.processExpenseData(writeCsv(rows.toList(chr(10))));

                    expect(result.valid).toBeTrue();
                    expect(result.data.len()).toBe(200);
                    expect(result.errors.len()).toBe(0);
                });

                it("Does not save any expenses to the database - import is preview only", () => {
                    var beforeCount = expenseHelper.count(user.getId());

                    var result = expenseService.processExpenseData(
                        writeCsv(
                            "Date,Amount,Description" & chr(10) &
                            "#makeRandDate()#,50.00,Groceries" & chr(10) &
                            "#makeRandDate()#,25.00,Coffee"
                        )
                    );

                    expect(result.valid).toBeTrue();
                    expect(expenseHelper.count(user.getId())).toBe(beforeCount);
                });
            });

            describe("Row-level validation", () => {
                it("Separates valid and invalid rows, returning both", () => {
                    var result = expenseService.processExpenseData(
                        writeCsv(
                            "Date,Amount,Description" & chr(10) &
                            "#makeRandDate()#,50.00,Groceries" & chr(10) &
                            "notadate,notanumber,Coffee" & chr(10) &
                            "#makeRandDate()#,100.00,Utilities"
                        )
                    );

                    expect(result.valid).toBeTrue();
                    expect(result.data.len()).toBe(2);
                    expect(result.errors.len()).toBe(1);
                });

                it("Errored rows include the CSV row number (accounting for the header row)", () => {
                    // CSV layout: header=row1, valid=row2(index1), invalid=row3(index2), valid=row4(index3)
                    // error.row = index + 1 = 3
                    var result = expenseService.processExpenseData(
                        writeCsv(
                            "Date,Amount,Description" & chr(10) &
                            "#makeRandDate()#,50.00,Groceries" & chr(10) &
                            "notadate,notanumber,Coffee" & chr(10) &
                            "#makeRandDate()#,100.00,Utilities"
                        )
                    );

                    var erroredRow = result.errors[1];
                    expect(erroredRow).toHaveKey("row");
                    expect(erroredRow).toHaveKey("message");
                    expect(erroredRow.row).toBe(3);
                });

                it("Returns no imported rows when every row has invalid data", () => {
                    var result = expenseService.processExpenseData(
                        writeCsv(
                            "Date,Amount,Description" & chr(10) &
                            "notadate,notanumber,Expense 1" & chr(10) &
                            "notadate,notanumber,Expense 2" & chr(10) &
                            "notadate,notanumber,Expense 3"
                        )
                    );

                    expect(result.data.len()).toBe(0);
                    expect(result.errors.len()).toBe(3);
                });

                it("Rejects rows with an invalid date", () => {
                    var result = expenseService.processExpenseData(
                        writeCsv(
                            "Date,Amount,Description" & chr(10) &
                            "99/99/9999,50.00,Bad date row"
                        )
                    );

                    expect(result.data.len()).toBe(0);
                    expect(result.errors.len()).toBe(1);
                });

                it("Rejects rows with a non-numeric amount", () => {
                    var result = expenseService.processExpenseData(
                        writeCsv(
                            "Date,Amount,Description" & chr(10) &
                            "#makeRandDate()#,fifty,Bad amount row"
                        )
                    );

                    expect(result.data.len()).toBe(0);
                    expect(result.errors.len()).toBe(1);
                });
            });
        });
    }

}
