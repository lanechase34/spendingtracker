component extends="tests.resources.baseTest" {

    function beforeAll() {
        super.beforeAll();

        expenseHelper   = getInstance('tests.resources.expenseHelper');
        expenseService  = getInstance('services.expense');
        securityService = getInstance('services.security');
        mockUser        = getInstance('tests.resources.mockuser');
    }

    function afterAll() {
        super.afterAll();
    }

    function run() {
        describe('Expense Decimal Precision Integration Tests', () => {
            beforeEach(() => {
                setup();
                user = mockUser.make();
                jwt  = mockUser.login(user);
            });

            afterEach(() => {
                mockUser.logout(user, jwt);
                mockUser.delete(user);
            });

            describe('Verify encryption/decryption is working - fields in db are stored as varchar (encrypted integer cents)', () => {
                it('Verifies encryption service converts dollars to cents and stores as integer', () => {
                    // Test various floating-point precision scenarios
                    // Input: dollars with floating point noise
                    // Expected: exact cents as integer, exact dollars when converted back
                    var testCases = [
                        {
                            inputDollars   : 14.020000002,
                            expectedCents  : 1402,
                            expectedDollars: 14.02
                        },
                        {
                            inputDollars   : 14.019999999,
                            expectedCents  : 1402,
                            expectedDollars: 14.02
                        },
                        {
                            inputDollars   : 99.994999999,
                            expectedCents  : 9999,
                            expectedDollars: 99.99
                        },
                        {
                            inputDollars   : 99.995000001,
                            expectedCents  : 10000,
                            expectedDollars: 100.00
                        },
                        {
                            inputDollars   : 0.009999999,
                            expectedCents  : 1,
                            expectedDollars: 0.01
                        },
                        {
                            inputDollars   : 0.004999999,
                            expectedCents  : 0,
                            expectedDollars: 0.00
                        },
                        {
                            inputDollars   : 12345.674999,
                            expectedCents  : 1234567,
                            expectedDollars: 12345.67
                        },
                        {
                            inputDollars   : 12345.675001,
                            expectedCents  : 1234568,
                            expectedDollars: 12345.68
                        },
                        {
                            inputDollars   : 1.115,
                            expectedCents  : 112,
                            expectedDollars: 1.12
                        },
                        {
                            inputDollars   : 1.125,
                            expectedCents  : 113,
                            expectedDollars: 1.13
                        },
                        {
                            inputDollars   : 999999.99,
                            expectedCents  : 99999999,
                            expectedDollars: 999999.99
                        },
                        {
                            inputDollars   : 0.01,
                            expectedCents  : 1,
                            expectedDollars: 0.01
                        },
                        {
                            inputDollars   : 0.001,
                            expectedCents  : 0,
                            expectedDollars: 0.00
                        }
                    ];

                    testCases.each((testCase) => {
                        // Encrypt the dollar value (converts to cents internally)
                        var encrypted = securityService.encryptValue(testCase.inputDollars);

                        // Decrypt it back (returns integer cents)
                        var decryptedCents = securityService.decryptValue(encrypted, 'numeric');

                        // Verify the encrypted/decrypted value is the expected integer cents
                        expect(decryptedCents).toBe(
                            testCase.expectedCents,
                            'Input $#testCase.inputDollars# should encrypt/decrypt to #testCase.expectedCents# cents, but got #decryptedCents# cents'
                        );

                        // Convert cents back to dollars
                        var decryptedDollars = securityService.intToFloat(decryptedCents);

                        // Verify the dollar conversion matches expected
                        expect(decryptedDollars).toBe(
                            testCase.expectedDollars,
                            'Cents #decryptedCents# should convert to $#testCase.expectedDollars#, but got $#decryptedDollars#'
                        );

                        // Verify the full round-trip: dollars → cents → dollars
                        expect(decryptedDollars).toBe(
                            round(testCase.inputDollars, 2),
                            'Full round-trip failed: $#testCase.inputDollars# → #decryptedCents# cents → $#decryptedDollars#'
                        );
                    });
                });

                it('Verifies encryption roundtrip maintains cent precision for large batch', () => {
                    var numTests   = 100;
                    var allMatched = true;
                    var failures   = [];

                    for(var i = 1; i <= numTests; i++) {
                        // Generate a random value with floating-point imprecision
                        var baseAmount = randRange(1, 10000);
                        var cents      = randRange(0, 99);
                        var noise      = (randRange(0, 999) / 1000000); // Add floating-point noise
                        var dirtyValue = baseAmount + (cents / 100) + noise;

                        // What we expect after rounding to cents
                        var expectedCents   = round(dirtyValue * 100, 0);
                        var expectedDollars = round(dirtyValue, 2);

                        // Encrypt and decrypt
                        var encrypted        = securityService.encryptValue(dirtyValue);
                        var decryptedCents   = securityService.decryptValue(encrypted, 'numeric');
                        var decryptedDollars = securityService.intToFloat(decryptedCents);

                        // Verify cents match
                        if(decryptedCents != expectedCents) {
                            allMatched = false;
                            failures.append({
                                input          : dirtyValue,
                                expectedCents  : expectedCents,
                                actualCents    : decryptedCents,
                                expectedDollars: expectedDollars,
                                actualDollars  : decryptedDollars
                            });
                        }

                        // Verify dollars match after conversion
                        if(decryptedDollars != expectedDollars) {
                            allMatched = false;
                            if(!failures.find((f) => f.input == dirtyValue)) {
                                failures.append({
                                    input          : dirtyValue,
                                    expectedCents  : expectedCents,
                                    actualCents    : decryptedCents,
                                    expectedDollars: expectedDollars,
                                    actualDollars  : decryptedDollars
                                });
                            }
                        }
                    }

                    expect(allMatched).toBeTrue(
                        'All #numTests# encryption roundtrips should maintain cent precision. Failures: #serializeJSON(failures)#'
                    );
                });

                it('Verifies that summing cents has perfect precision (no rounding needed)', () => {
                    var numExpenses      = 100;
                    var expectedSumCents = 0;
                    var amounts          = [];

                    // Generate random amounts with floating-point imprecision
                    for(var i = 1; i <= numExpenses; i++) {
                        var dirtyAmount = 12345.67 + (randRange(1, 99) / 100) + (randRange(0, 999) / 1000000);

                        // What the encryption service will actually store (in cents)
                        var encrypted   = securityService.encryptValue(dirtyAmount);
                        var storedCents = securityService.decryptValue(encrypted, 'numeric');

                        amounts.append(storedCents);
                        expectedSumCents += storedCents; // Integer addition - perfect precision!
                    }

                    // Sum all the cent values - pure integer arithmetic, no rounding needed
                    var actualSumCents = 0;
                    amounts.each((cents) => {
                        actualSumCents += cents;
                    });

                    // These should match EXACTLY - no rounding, no tolerance needed
                    expect(actualSumCents).toBe(
                        expectedSumCents,
                        'Sum of cents should match exactly with no rounding. Expected: #expectedSumCents#, Got: #actualSumCents#'
                    );

                    // Convert to dollars for verification
                    var expectedSumDollars = securityService.intToFloat(expectedSumCents);
                    var actualSumDollars   = securityService.intToFloat(actualSumCents);

                    expect(actualSumDollars).toBe(
                        expectedSumDollars,
                        'Sum in dollars should match. Expected: $#numberFormat(expectedSumDollars, '999,999.99')#, Got: $#numberFormat(actualSumDollars, '999,999.99')#'
                    );
                });

                it('Verifies no precision loss when summing many large amounts', () => {
                    var numExpenses = 1000;
                    var totalCents  = 0;
                    var amounts     = [];

                    // Create 1000 random expenses
                    for(var i = 1; i <= numExpenses; i++) {
                        var dollars = randRange(1, 10000) + (randRange(0, 99) / 100);

                        var encrypted = securityService.encryptValue(dollars);
                        var cents     = securityService.decryptValue(encrypted, 'numeric');

                        amounts.append(cents);
                        totalCents += cents;
                    }

                    // Sum all amounts - pure integer arithmetic
                    var calculatedSum = 0;
                    amounts.each((cents) => {
                        calculatedSum += cents;
                    });

                    // Should match EXACTLY with NO tolerance needed
                    expect(calculatedSum).toBe(totalCents, 'Summing 1000 large amounts should have perfect precision');

                    // Verify the difference is EXACTLY zero (not "close to zero")
                    var difference = abs(calculatedSum - totalCents);
                    expect(difference).toBe(
                        0,
                        'Difference should be exactly 0, not just close. Difference: #difference#'
                    );
                });

                it('Verifies edge cases for cent conversion', () => {
                    var edgeCases = [
                        {
                            input          : 0,
                            expectedCents  : 0,
                            expectedDollars: 0.00
                        },
                        {
                            input          : 0.001,
                            expectedCents  : 0,
                            expectedDollars: 0.00
                        }, // Rounds down
                        {
                            input          : 0.005,
                            expectedCents  : 1,
                            expectedDollars: 0.01
                        }, // Rounds up
                        {
                            input          : 0.01,
                            expectedCents  : 1,
                            expectedDollars: 0.01
                        },
                        {
                            input          : 0.99,
                            expectedCents  : 99,
                            expectedDollars: 0.99
                        },
                        {
                            input          : 1.00,
                            expectedCents  : 100,
                            expectedDollars: 1.00
                        },
                        {
                            input          : 9999.99,
                            expectedCents  : 999999,
                            expectedDollars: 9999.99
                        },
                        {
                            input          : 10000.00,
                            expectedCents  : 1000000,
                            expectedDollars: 10000.00
                        },
                        {
                            input          : 99999.99,
                            expectedCents  : 9999999,
                            expectedDollars: 99999.99
                        }
                    ];

                    edgeCases.each((testCase) => {
                        var encrypted = securityService.encryptValue(testCase.input);
                        var cents     = securityService.decryptValue(encrypted, 'numeric');
                        var dollars   = securityService.intToFloat(cents);

                        expect(cents).toBe(
                            testCase.expectedCents,
                            'Input $#testCase.input# should convert to #testCase.expectedCents# cents'
                        );

                        expect(dollars).toBe(
                            testCase.expectedDollars,
                            'Cents #cents# should convert back to $#testCase.expectedDollars#'
                        );
                    });
                });
            });

            it('Can save expenses with various decimal amounts and verify pagination totals', () => {
                // Test data with various decimal precision scenarios
                var testExpenses = [
                    {amount: 10.99, description: 'Two decimal places'},
                    {amount: 25.50, description: 'Single trailing zero'},
                    {amount: 100.00, description: 'Two trailing zeros'},
                    {amount: 7.01, description: 'Small decimal'},
                    {amount: 99.99, description: 'Max cents value'},
                    {amount: 15.49, description: 'Mid-range decimal'},
                    {amount: 50.00, description: 'Round dollar amount'},
                    {amount: 33.33, description: 'Repeating decimal'},
                    {amount: 1.05, description: 'Low single digit'},
                    {amount: 200.75, description: 'Large amount'},
                    {amount: 99.99, description: 'Max cents value'},
                    {amount: 99.99, description: 'Max cents value'},
                    {amount: 99.99, description: 'Max cents value'},
                    {amount: 99.99, description: 'Max cents value'},
                    {amount: 9.99, description: 'Max cents value'},
                    {amount: 999.99, description: 'Max cents value'},
                    {amount: 6.35, description: '35 cents'},
                    {amount: 6.35, description: '35 cents'},
                    {amount: 6.35, description: '35 cents'},
                    {amount: 14.49, description: createUUID()},
                    {amount: 600.00, description: createUUID()},
                    {amount: 30.27, description: createUUID()},
                    {amount: 8.47, description: createUUID()}
                ];

                var expectedTotalCents = 0;
                var startDate          = dateAdd('d', -1, now());
                var endDate            = dateAdd('d', 1, now());

                // Save all test expenses
                testExpenses.each((expense) => {
                    var event = post(
                        route   = '/api/v1/expenses',
                        headers = {'x-auth-token': jwt},
                        params  = {
                            date       : now(),
                            amount     : expense.amount,
                            description: expense.description,
                            categoryid : 1,
                            receipt    : ''
                        }
                    );

                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(200);
                    expect(response.getError()).toBeFalse();
                    expect(response.getMessages()[1]).toBe('Successfully saved expense.');

                    // Convert to cents for tracking (same logic as encryption service)
                    expectedTotalCents += round(expense.amount * 100, 0);
                });

                // Convert expected cents back to dollars for API comparison
                var expectedTotalDollars = securityService.intToFloat(expectedTotalCents);

                // Test pagination endpoint - retrieve all expenses
                var paginateEvent = get(
                    route   = '/api/v1/expenses',
                    headers = {'x-auth-token': jwt},
                    params  = {
                        startDate: dateFormat(startDate, 'yyyy-mm-dd'),
                        endDate  : dateFormat(endDate, 'yyyy-mm-dd'),
                        page     : 1,
                        records  : 50
                    }
                );

                var paginateResponse     = paginateEvent.getResponse();
                var paginateResponseData = paginateResponse.getData();

                expenseHelper.validateApiResponse(
                    response        = paginateResponse,
                    totalSum        = expectedTotalDollars,
                    filteredSum     = expectedTotalDollars,
                    recordsReturned = testExpenses.len(),
                    totalRecords    = testExpenses.len(),
                    filteredRecords = testExpenses.len(),
                    pageSize        = 50,
                    page            = 1
                );

                // Verify individual expense amounts are correctly decrypted
                var returnedExpenses = paginateResponseData.expenses;
                expect(returnedExpenses.len()).toBe(testExpenses.len());

                var calculatedSumCents = 0;
                returnedExpenses.each((expense) => {
                    expect(expense.keyExists('amount')).toBeTrue();
                    expect(isNumeric(expense.amount)).toBeTrue();

                    // Convert back to cents for perfect precision sum
                    calculatedSumCents += round(expense.amount * 100, 0);
                });

                // Verify sum in cents matches exactly
                expect(calculatedSumCents).toBe(
                    expectedTotalCents,
                    'Sum of returned expenses (in cents) should match exactly. Expected: #expectedTotalCents# cents, Got: #calculatedSumCents# cents'
                );

                // Also verify in dollars
                var calculatedSumDollars = calculatedSumCents / 100;
                expect(calculatedSumDollars).toBe(
                    expectedTotalDollars,
                    'Sum of returned expenses (in dollars) should match. Expected: $#numberFormat(expectedTotalDollars, '999,999.99')#, Got: $#numberFormat(calculatedSumDollars, '999,999.99')#'
                );
            });

            it('Can filter expenses and verify filtered sum accuracy', () => {
                // Create expenses with specific descriptions for filtering
                var groceryExpenses = [
                    {amount: 45.67, description: 'Grocery store trip'},
                    {amount: 23.45, description: 'Grocery delivery'},
                    {amount: 78.90, description: 'Weekly groceries'}
                ];

                var otherExpenses = [
                    {amount: 100.00, description: 'Gas station'},
                    {amount: 50.50, description: 'Restaurant'},
                    {amount: 25.25, description: 'Coffee shop'}
                ];

                var expectedGroceryCents = 0;
                var expectedOverallCents = 0;

                // Save grocery expenses
                groceryExpenses.each((expense) => {
                    post(
                        route   = '/api/v1/expenses',
                        headers = {'x-auth-token': jwt},
                        params  = {
                            date       : now(),
                            amount     : expense.amount,
                            description: expense.description,
                            categoryid : 1,
                            receipt    : ''
                        }
                    );
                    var cents = round(expense.amount * 100, 0);
                    expectedGroceryCents += cents;
                    expectedOverallCents += cents;
                });

                // Save other expenses
                otherExpenses.each((expense) => {
                    post(
                        route   = '/api/v1/expenses',
                        headers = {'x-auth-token': jwt},
                        params  = {
                            date       : now(),
                            amount     : expense.amount,
                            description: expense.description,
                            categoryid : 1,
                            receipt    : ''
                        }
                    );
                    expectedOverallCents += round(expense.amount * 100, 0);
                });

                // Convert to dollars for API comparison
                var expectedGroceryDollars = expectedGroceryCents / 100;
                var expectedOverallDollars = expectedOverallCents / 100;

                var startDate = dateAdd('d', -1, now());
                var endDate   = dateAdd('d', 1, now());

                // Test with search filter for "grocery"
                var filteredEvent = get(
                    route   = '/api/v1/expenses',
                    headers = {'x-auth-token': jwt},
                    params  = {
                        startDate: dateFormat(startDate, 'yyyy-mm-dd'),
                        endDate  : dateFormat(endDate, 'yyyy-mm-dd'),
                        page     : 1,
                        records  : 50,
                        search   : 'grocer'
                    }
                );

                var filteredResponse = filteredEvent.getResponse();
                var filteredData     = filteredResponse.getData();

                // Verify filtered results
                // 1. filtered sum matches only grocery expenses
                // 2. total sum includes all expenses
                expenseHelper.validateApiResponse(
                    response        = filteredResponse,
                    totalSum        = expectedOverallDollars,
                    filteredSum     = expectedGroceryDollars,
                    recordsReturned = groceryExpenses.len(),
                    totalRecords    = groceryExpenses.len() + otherExpenses.len(),
                    filteredRecords = groceryExpenses.len(),
                    pageSize        = 50,
                    page            = 1
                );

                // Verify by manually summing returned expenses (in cents for precision)
                var manualFilteredCents = 0;
                filteredData.expenses.each((expense) => {
                    manualFilteredCents += round(expense.amount * 100, 0);
                });

                expect(manualFilteredCents).toBe(
                    expectedGroceryCents,
                    'Manual filtered sum should match expected grocery total. Expected: #expectedGroceryCents# cents, Got: #manualFilteredCents# cents'
                );
            });

            it('Handles edge case decimal amounts correctly', () => {
                var edgeCaseExpenses = [
                    {amount: 0.01, description: 'Single penny'},
                    {amount: 0.99, description: 'Just under dollar'},
                    {amount: 999.99, description: 'Large amount max cents'},
                    {amount: 1000.00, description: 'Round thousand'},
                    {amount: 12.345, description: 'More than 2 decimals (should round to 12.35)'},
                    {amount: 7.999, description: 'Should round up to 8.00'}
                ];

                // Expected values after conversion to cents and back
                var expectedCents      = [1, 99, 99999, 100000, 1235, 800];
                var expectedDollars    = [0.01, 0.99, 999.99, 1000.00, 12.35, 8.00];
                var expectedTotalCents = expectedCents.sum();

                // Save all edge case expenses
                edgeCaseExpenses.each((expense) => {
                    post(
                        route   = '/api/v1/expenses',
                        headers = {'x-auth-token': jwt},
                        params  = {
                            date       : now(),
                            amount     : expense.amount,
                            description: expense.description,
                            categoryid : 1,
                            receipt    : ''
                        }
                    );
                });

                // Retrieve and verify
                var startDate = dateAdd('d', -1, now());
                var endDate   = dateAdd('d', 1, now());

                var event = get(
                    route   = '/api/v1/expenses',
                    headers = {'x-auth-token': jwt},
                    params  = {
                        startDate: dateFormat(startDate, 'yyyy-mm-dd'),
                        endDate  : dateFormat(endDate, 'yyyy-mm-dd'),
                        page     : 1,
                        records  : 50
                    }
                );

                var response = event.getResponse();
                var data     = response.getData();

                var expectedTotalDollars = expectedTotalCents / 100;

                expenseHelper.validateApiResponse(
                    response        = response,
                    totalSum        = expectedTotalDollars,
                    filteredSum     = expectedTotalDollars,
                    recordsReturned = edgeCaseExpenses.len(),
                    totalRecords    = edgeCaseExpenses.len(),
                    filteredRecords = edgeCaseExpenses.len(),
                    pageSize        = 50,
                    page            = 1
                );

                // Verify each individual amount is properly rounded
                var returnedExpenses = data.expenses;
                expect(returnedExpenses.len()).toBe(edgeCaseExpenses.len());

                returnedExpenses.each((expense, index) => {
                    var expectedAmount = expectedDollars[index];
                    var actualAmount   = expense.amount;

                    expect(actualAmount).toBe(expectedAmount);
                });

                // Verify total in cents
                var manualSumCents = 0;
                returnedExpenses.each((expense) => {
                    manualSumCents += round(expense.amount * 100, 0);
                });

                expect(manualSumCents).toBe(expectedTotalCents);
            });

            it('Maintains precision with large monetary amounts', () => {
                // Test large amounts - no floating point precision issues with cent storage
                var largeAmounts = [
                    {amount: 9999.99, description: 'Just under 10k'},
                    {amount: 10000.00, description: 'Exactly 10k'},
                    {amount: 15678.45, description: 'Mid five-figure'},
                    {amount: 25000.50, description: '25k with cents'},
                    {amount: 50000.01, description: '50k and one penny'},
                    {amount: 75432.10, description: 'Large with decimal'},
                    {amount: 99999.99, description: 'Just under 100k'},
                    {amount: 100000.00, description: 'Exactly 100k'},
                    {amount: 123456.78, description: 'Six-figure amount'},
                    {amount: 250000.25, description: 'Quarter million'}
                ];

                var expectedTotalCents = 0;
                var startDate          = dateAdd('d', -1, now());
                var endDate            = dateAdd('d', 1, now());

                // Save all large expenses
                largeAmounts.each((expense) => {
                    var event = post(
                        route   = '/api/v1/expenses',
                        headers = {'x-auth-token': jwt},
                        params  = {
                            date       : now(),
                            amount     : expense.amount,
                            description: expense.description,
                            categoryid : 1,
                            receipt    : ''
                        }
                    );

                    expect(event.getResponse().getStatusCode()).toBe(200);

                    // Track in cents (integer arithmetic - perfect precision!)
                    expectedTotalCents += round(expense.amount * 100, 0);
                });

                var expectedTotalDollars = expectedTotalCents / 100;

                // Retrieve all expenses
                var event = get(
                    route   = '/api/v1/expenses',
                    headers = {'x-auth-token': jwt},
                    params  = {
                        startDate: dateFormat(startDate, 'yyyy-mm-dd'),
                        endDate  : dateFormat(endDate, 'yyyy-mm-dd'),
                        page     : 1,
                        records  : 50
                    }
                );

                var response = event.getResponse();
                var data     = response.getData();

                expenseHelper.validateApiResponse(
                    response        = response,
                    totalSum        = expectedTotalDollars,
                    filteredSum     = expectedTotalDollars,
                    recordsReturned = largeAmounts.len(),
                    totalRecords    = largeAmounts.len(),
                    filteredRecords = largeAmounts.len(),
                    pageSize        = 50,
                    page            = 1
                );

                // Verify each individual large amount maintains precision
                var retrievedAmountsCents = [];
                data.expenses.each((expense) => {
                    retrievedAmountsCents.append(round(expense.amount * 100, 0));
                });

                // Check that each original amount exists in retrieved amounts (as cents)
                largeAmounts.each((originalExpense) => {
                    var expectedCents = round(originalExpense.amount * 100, 0);
                    var found         = retrievedAmountsCents.find((cents) => cents == expectedCents);

                    expect(found).toBeTypeOf(
                        'numeric',
                        'Large amount #originalExpense.amount# (#expectedCents# cents) not found in retrieved expenses'
                    );
                });

                // Verify manual sum matches (in cents for perfect precision)
                var manualSumCents = 0;
                data.expenses.each((expense) => {
                    manualSumCents += round(expense.amount * 100, 0);
                });

                expect(manualSumCents).toBe(
                    expectedTotalCents,
                    'Manual sum should match exactly (integer arithmetic). Expected: #expectedTotalCents# cents, Got: #manualSumCents# cents'
                );
            });

            it('Handles extremely large single expense amounts', () => {
                // Test individual very large amounts - cent storage handles these perfectly
                var extremeAmounts = [999998.99, 100000.00, 500000.50, 99999.99];

                var expectedTotalCents = 0;

                extremeAmounts.each((amount) => {
                    post(
                        route   = '/api/v1/expenses',
                        headers = {'x-auth-token': jwt},
                        params  = {
                            date       : now(),
                            amount     : amount,
                            description: 'Extreme amount test: $#numberFormat(amount, '999,999,999.99')#',
                            categoryid : 1,
                            receipt    : ''
                        }
                    );
                    expectedTotalCents += round(amount * 100, 0);
                });

                var expectedTotalDollars = expectedTotalCents / 100;

                // Retrieve and verify
                var startDate = dateAdd('d', -1, now());
                var endDate   = dateAdd('d', 1, now());

                var event = get(
                    route   = '/api/v1/expenses',
                    headers = {'x-auth-token': jwt},
                    params  = {
                        startDate: dateFormat(startDate, 'yyyy-mm-dd'),
                        endDate  : dateFormat(endDate, 'yyyy-mm-dd'),
                        page     : 1,
                        records  : 50
                    }
                );

                var response = event.getResponse();
                var data     = response.getData();

                expenseHelper.validateApiResponse(
                    response        = response,
                    totalSum        = expectedTotalDollars,
                    filteredSum     = expectedTotalDollars,
                    recordsReturned = extremeAmounts.len(),
                    totalRecords    = extremeAmounts.len(),
                    filteredRecords = extremeAmounts.len(),
                    pageSize        = 50,
                    page            = 1
                );

                // Verify precision with cent comparison
                var manualSumCents = 0;
                data.expenses.each((expense) => {
                    manualSumCents += round(expense.amount * 100, 0);
                });

                expect(manualSumCents).toBe(
                    expectedTotalCents,
                    'Extreme amounts should maintain perfect precision. Expected: #expectedTotalCents# cents, Got: #manualSumCents# cents'
                );
            });


            it('Maintains perfect precision when summing many large amounts', () => {
                // Test combining all tests above into a stress test
                // This has many large sum amounts with various floating point precision
                var numExpenses        = randRange(800, 1000);
                var baseAmount         = 12345.01;
                var expectedTotalCents = 0;
                var sentAmounts        = [];
                var rollingSum         = 0;

                for(var i = 1; i <= numExpenses; i++) {
                    // Generate amount with potential floating-point imprecision
                    var rand        = round(randRange(0, 98) / 100, 2);
                    var amount      = baseAmount + i + rand;
                    var description = '#i# Large batch expense';

                    post(
                        route   = '/api/v1/expenses',
                        headers = {'x-auth-token': jwt},
                        params  = {
                            date       : now(),
                            amount     : amount,
                            description: description,
                            categoryid : 1,
                            receipt    : ''
                        }
                    );

                    // Track in cents (integer - perfect precision!)
                    expectedTotalCents += round(amount * 100, 0);
                    sentAmounts.append({
                        amount     : amount,
                        rand       : rand,
                        description: description
                    });
                    rollingSum += amount;
                }

                var expectedTotalDollars = expectedTotalCents / 100;

                // Retrieve all expenses across multiple pages
                var startDate = dateAdd('d', -1, now());
                var endDate   = dateAdd('d', 1, now());

                var event = get(
                    route   = '/api/v1/expenses',
                    headers = {'x-auth-token': jwt},
                    params  = {
                        startDate: dateFormat(startDate, 'yyyy-mm-dd'),
                        endDate  : dateFormat(endDate, 'yyyy-mm-dd'),
                        page     : 1,
                        records  : 100,
                        orderCol : 'description',
                        orderDir : 'asc'
                    }
                );

                var response = event.getResponse();
                var data     = response.getData();

                expenseHelper.validateApiResponse(
                    response        = response,
                    totalSum        = expectedTotalDollars,
                    filteredSum     = rollingSum,
                    recordsReturned = 100,
                    totalRecords    = numExpenses,
                    filteredRecords = numExpenses,
                    pageSize        = 100,
                    page            = 1
                );

                // Get all expenses across all pages
                var allExpenses = data.expenses;
                var totalPages  = ceiling(numExpenses / 100);

                for(var i = 2; i <= totalPages; i++) {
                    var currEvent = get(
                        route   = '/api/v1/expenses',
                        headers = {'x-auth-token': jwt},
                        params  = {
                            startDate: dateFormat(startDate, 'yyyy-mm-dd'),
                            endDate  : dateFormat(endDate, 'yyyy-mm-dd'),
                            page     : i,
                            records  : 100
                        }
                    );
                    var currData = currEvent.getResponse().getData();
                    allExpenses.append(currData.expenses, true);
                }

                expect(allExpenses.len()).toBe(numExpenses, 'Should have collected all expenses across pages');

                // At this point we know the total amounts are equal (checked against rollingSum, expectedTotalDollars)
                // Lets verify each individual expense saved. We can check based on the unique description
                sentAmounts.each((amount) => {
                    var currDescription = amount.description;
                    var currAmount      = amount.amount;

                    var check = allExpenses.filter((expense) => {
                        // Match description
                        return expense.description == currDescription;
                    });

                    expect(check.len()).toBe(1);

                    // Check the amount
                    var expenseRecord = check[1];
                    expect(expenseRecord.amount).toBe(currAmount);
                });
            });
        });
    };

}
