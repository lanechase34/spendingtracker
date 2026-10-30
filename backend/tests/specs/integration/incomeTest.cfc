component extends="tests.resources.baseTest" {

    function beforeAll() {
        super.beforeAll();

        mockUser     = getInstance('tests.resources.mockuser');
        incomeHelper = getInstance('tests.resources.incomeHelper');

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
     * GET /income/extra for the shared user and return the response
     */
    private any function getExtra(required string startDate, required string endDate) {
        setup();
        return get(
            route   = '/api/v1/income/extra',
            headers = {'x-auth-token': jwt},
            params  = {startDate: startDate, endDate: endDate}
        ).getResponse();
    }

    /**
     * POST /income/extra for the shared user and return the response
     */
    private any function postExtra(required struct params) {
        setup();
        return post(
            route   = '/api/v1/income/extra',
            headers = {'x-auth-token': jwt},
            params  = params
        ).getResponse();
    }

    /**
     * Count the shared user's income_extra rows
     */
    private numeric function countExtra() {
        return queryExecute(
            'SELECT count(id) AS total FROM income_extra WHERE userid = :userid',
            {userid: {value: user.getId(), cfsqltype: 'numeric'}}
        ).total;
    }

    function run() {
        describe('/api/v1/income', () => {
            beforeEach(() => {
                setup();
            });

            it('GET /income to return income', () => {
                var event = get(
                    route   = '/api/v1/income',
                    headers = {'x-auth-token': jwt},
                    params  = {startDate: '2025-01-01', endDate: '2025-03-01'}
                );

                var response = event.getResponse();
                expect(response.getStatusCode()).toBe(200);
                expect(response.getError()).toBeFalse();
                expect(response.getData()).toBeStruct();
                expect(response.getData()).toHaveKey('pay');
                expect(response.getData()).toHaveKey('extra');
            });

            it('GET /income returns error for invalid parameters', () => {
                var event = get(
                    route   = '/api/v1/income',
                    headers = {'x-auth-token': jwt},
                    params  = {
                        startDate: '2025-01-x', // invalid format should be YYYY-MM-DD
                        endDate  : '2025-03-01'
                    }
                );

                var response = event.getResponse();
                expect(response.getStatusCode()).toBe(400);
                expect(response.getError()).toBeTrue();
                expect(response.getMessages()[1]).toInclude('Invalid Parameters');
            });

            it('PUT /income to save income successfully', () => {
                var event = put(
                    route   = '/api/v1/income',
                    headers = {'x-auth-token': jwt},
                    params  = {date: '2025-01-01', pay: 5000}
                );
                var response = event.getResponse();
                expect(response.getStatusCode()).toBe(200);
                expect(response.getError()).toBeFalse();
                expect(response.getMessages()[1]).toInclude('Successfully saved');

                /**
                 * Get the date for this month and verify it saved
                 */
                event = get(
                    route   = '/api/v1/income',
                    headers = {'x-auth-token': jwt},
                    params  = {startDate: '2025-01-01', endDate: '2025-03-01'}
                );
                response = event.getResponse();
                expect(response.getStatusCode()).toBe(200);
                expect(response.getData().pay).toBe(5000);
                expect(response.getData().extra).toBe(0);
            });

            it('PUT /income returns error for invalid parameters', () => {
                var event = put(
                    route   = '/api/v1/income',
                    headers = {'x-auth-token': jwt},
                    params  = {date: '2025-01-01', pay: -5000}
                );

                var response = event.getResponse();
                expect(response.getStatusCode()).toBe(400);
                expect(response.getError()).toBeTrue();
                expect(response.getMessages()[1]).toInclude('Invalid Parameters');
            });

            it('PUT /income returns error when pay is missing', () => {
                var event = put(
                    route   = '/api/v1/income',
                    headers = {'x-auth-token': jwt},
                    params  = {date: '2025-01-01'}
                );

                var response = event.getResponse();
                expect(response.getStatusCode()).toBe(400);
                expect(response.getError()).toBeTrue();
                expect(response.getMessages()[1]).toInclude('Invalid Parameters');
            });

            it('PUT /income updates existing record', () => {
                var beforeCheck = queryExecute(
                    'select count(id) from income where userid = :userid and date = :date',
                    {
                        userid: {value: user.getId(), cfsqltype: 'numeric'},
                        date  : {value: '2025-01-01-01', cfsqltype: 'date'}
                    }
                ).count;

                /**
                 * Update the record saved above
                 */
                var event = put(
                    route   = '/api/v1/income',
                    headers = {'x-auth-token': jwt},
                    params  = {date: '2025-01-01', pay: 500}
                );
                var response = event.getResponse();
                expect(response.getStatusCode()).toBe(200);
                expect(response.getError()).toBeFalse();
                expect(response.getMessages()[1]).toInclude('Successfully saved');

                /**
                 * Get the date for this month and verify it updated
                 */
                event = get(
                    route   = '/api/v1/income',
                    headers = {'x-auth-token': jwt},
                    params  = {startDate: '2025-01-01', endDate: '2025-03-01'}
                );
                response = event.getResponse();
                expect(response.getStatusCode()).toBe(200);
                expect(response.getData().pay).toBe(500);
                expect(response.getData().extra).toBe(0);

                /**
                 * Check that a new record has not been created
                 */
                var afterCheck = queryExecute(
                    'select count(id) from income where userid = :userid and date = :date',
                    {
                        userid: {value: user.getId(), cfsqltype: 'numeric'},
                        date  : {value: '2025-01-01-01', cfsqltype: 'date'}
                    }
                ).count;

                expect(beforeCheck).toBe(afterCheck);
            });

            it('PUT /income ignores a legacy extra param and does not create extra income', () => {
                var before = countExtra();

                var event = put(
                    route   = '/api/v1/income',
                    headers = {'x-auth-token': jwt},
                    params  = {
                        date : '2024-11-01',
                        pay  : 100,
                        extra: 50
                    }
                );
                expect(event.getResponse().getStatusCode()).toBe(200);
                expect(countExtra()).toBe(before);

                setup();
                event = get(
                    route   = '/api/v1/income',
                    headers = {'x-auth-token': jwt},
                    params  = {startDate: '2024-11-01', endDate: '2024-11-01'}
                );
                var response = event.getResponse();
                expect(response.getData().pay).toBe(100);
                expect(response.getData().extra).toBe(0);
            });

            it('GET /income to return income in date range', () => {
                var event;

                /**
                 * Save pay for 2025-02, 2025-03, and 2025-04
                 */
                event = put(
                    route   = '/api/v1/income',
                    headers = {'x-auth-token': jwt},
                    params  = {date: '2025-02-01', pay: 10}
                );
                event = put(
                    route   = '/api/v1/income',
                    headers = {'x-auth-token': jwt},
                    params  = {date: '2025-03-01', pay: 20}
                );
                event = put(
                    route   = '/api/v1/income',
                    headers = {'x-auth-token': jwt},
                    params  = {date: '2025-04-01', pay: 30}
                );

                /**
                 * Save extra income on arbitrary days in those months, plus one outside the range
                 */
                postExtra({
                    date       : '2025-02-14',
                    amount     : 1,
                    description: 'Feb extra'
                });
                postExtra({
                    date       : '2025-03-31',
                    amount     : 2,
                    description: 'Mar extra'
                });
                postExtra({
                    date       : '2025-04-30',
                    amount     : 3,
                    description: 'Apr extra'
                });
                postExtra({
                    date       : '2025-05-01',
                    amount     : 100,
                    description: 'Out of range'
                });

                /**
                 * Get sum of all the income in this date range
                 */
                setup();
                event = get(
                    route   = '/api/v1/income',
                    headers = {'x-auth-token': jwt},
                    params  = {startDate: '2025-02-01', endDate: '2025-04-01'}
                );

                var response = event.getResponse();
                expect(response.getStatusCode()).toBe(200);
                expect(response.getData().pay).toBe(60); // sum of all pay
                expect(response.getData().extra).toBe(6); // sum of all extra, end month is fully included
            });
        });

        describe('/api/v1/income/extra', () => {
            beforeEach(() => {
                setup();
            });

            describe('GET /income/extra', () => {
                it('Returns an empty array when there is no extra income in range', () => {
                    var response = getExtra('2024-02-01', '2024-02-29');

                    expect(response.getStatusCode()).toBe(200);
                    expect(response.getError()).toBeFalse();
                    expect(response.getData()).toBeArray();
                    expect(response.getData()).toBeEmpty();
                });

                it('Returns every entry across the full months in range, newest first', () => {
                    var ids = {
                        firstDay: postExtra({
                            date       : '2025-09-01',
                            amount     : 10,
                            description: 'Sep 1'
                        }).getData().id,
                        midA: postExtra({
                            date       : '2025-09-15',
                            amount     : 20,
                            description: 'Sep 15 A'
                        }).getData().id,
                        midB: postExtra({
                            date       : '2025-09-15',
                            amount     : 30,
                            description: 'Sep 15 B'
                        }).getData().id,
                        lastDay: postExtra({
                            date       : '2025-09-30',
                            amount     : 40,
                            description: 'Sep 30'
                        }).getData().id,
                        tooEarly: postExtra({
                            date       : '2025-08-31',
                            amount     : 50,
                            description: 'Aug 31'
                        }).getData().id,
                        tooLate: postExtra({
                            date       : '2025-10-01',
                            amount     : 60,
                            description: 'Oct 1'
                        }).getData().id
                    };

                    // Mid month dates still return the full month
                    var response = getExtra('2025-09-20', '2025-09-21');
                    expect(response.getStatusCode()).toBe(200);
                    expect(response.getError()).toBeFalse();

                    var data = response.getData();
                    expect(data).toBeArray();

                    // Ordered by date desc, then id desc for entries on the same day
                    expect(data.map((row) => row.id)).toBe([ids.lastDay, ids.midB, ids.midA, ids.firstDay]);

                    // Response shape
                    expect(data[1]).toBe({
                        id         : ids.lastDay,
                        date       : '2025-09-30',
                        amount     : 40,
                        description: 'Sep 30'
                    });
                });

                it('Only returns the authenticated user''s entries', () => {
                    var otherUser = mockUser.make();
                    var theirs    = incomeHelper.mock(
                        userid      = otherUser.getId(),
                        date        = createDate(2025, 12, 10),
                        pay         = 0,
                        extra       = 123.45,
                        description = 'Other user extra'
                    ).extraIds[1];
                    var mine = postExtra({
                        date       : '2025-12-10',
                        amount     : 5,
                        description: 'My extra'
                    }).getData().id;

                    var data = getExtra('2025-12-01', '2025-12-31').getData();
                    expect(data.map((row) => row.id)).toBe([mine]);
                    expect(data.map((row) => row.id)).notToInclude(theirs);

                    mockUser.delete(otherUser);
                });

                it('Returns error for an invalid startDate', () => {
                    var response = getExtra('2025-01-x', '2025-03-01');

                    expect(response.getStatusCode()).toBe(400);
                    expect(response.getError()).toBeTrue();
                    expect(response.getMessages()[1]).toInclude('Invalid Parameters');
                });

                it('Returns error when endDate is missing', () => {
                    var event = get(
                        route   = '/api/v1/income/extra',
                        headers = {'x-auth-token': jwt},
                        params  = {startDate: '2025-01-01'}
                    );

                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(400);
                    expect(response.getError()).toBeTrue();
                    expect(response.getMessages()[1]).toInclude('Invalid Parameters');
                });

                it('Returns error when the date range is larger than a year', () => {
                    var response = getExtra('2024-01-01', '2025-06-01');

                    expect(response.getStatusCode()).toBe(400);
                    expect(response.getError()).toBeTrue();
                    expect(response.getMessages()[1]).toInclude('Invalid Parameters');
                });

                it('Returns error when endDate is before startDate', () => {
                    var response = getExtra('2025-06-01', '2025-01-01');

                    expect(response.getStatusCode()).toBe(400);
                    expect(response.getError()).toBeTrue();
                    expect(response.getMessages()[1]).toInclude('Invalid Parameters');
                });

                it('Returns 401 with no token', () => {
                    var event = get(
                        route  = '/api/v1/income/extra',
                        params = {startDate: '2025-01-01', endDate: '2025-01-31'}
                    );

                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(401);
                    expect(response.getError()).toBeTrue();
                });
            });

            describe('POST /income/extra', () => {
                it('Saves an extra income entry on the exact date supplied', () => {
                    var before   = countExtra();
                    var response = postExtra({
                        date       : '2025-06-15',
                        amount     : 250.5,
                        description: 'Freelance project'
                    });

                    expect(response.getStatusCode()).toBe(200);
                    expect(response.getError()).toBeFalse();
                    expect(response.getMessages()[1]).toBe('Successfully saved extra income.');
                    expect(response.getData()).toHaveKey('id');
                    expect(response.getData().id).toBeNumeric().toBeGTE(1);
                    expect(countExtra()).toBe(before + 1);

                    // Saved on the day supplied, not normalized to the first of the month
                    var data = getExtra('2025-06-01', '2025-06-01').getData();
                    expect(data.len()).toBe(1);
                    expect(data[1]).toBe({
                        id         : response.getData().id,
                        date       : '2025-06-15',
                        amount     : 250.5,
                        description: 'Freelance project'
                    });

                    // Stored encrypted
                    var stored = queryExecute(
                        'SELECT amount FROM income_extra WHERE id = :id',
                        {id: {value: response.getData().id, cfsqltype: 'numeric'}}
                    ).amount;
                    expect(stored).notToBe('250.5');
                });

                it('Allows multiple entries in a month and adds them to the income total without touching pay', () => {
                    setup();
                    put(
                        route   = '/api/v1/income',
                        headers = {'x-auth-token': jwt},
                        params  = {date: '2025-07-01', pay: 4000}
                    );

                    postExtra({
                        date       : '2025-07-03',
                        amount     : 100,
                        description: 'Tutoring'
                    });
                    postExtra({
                        date       : '2025-07-03',
                        amount     : 100,
                        description: 'Tutoring'
                    });
                    postExtra({
                        date       : '2025-07-28',
                        amount     : 49.99,
                        description: 'Cashback'
                    });

                    expect(getExtra('2025-07-01', '2025-07-01').getData().len()).toBe(3);

                    setup();
                    var response = get(
                        route   = '/api/v1/income',
                        headers = {'x-auth-token': jwt},
                        params  = {startDate: '2025-07-01', endDate: '2025-07-01'}
                    ).getResponse();
                    expect(response.getData().pay).toBe(4000);
                    expect(response.getData().extra).toBe(249.99);
                });

                it('Sums extra income without floating point drift', () => {
                    postExtra({
                        date       : '2026-02-01',
                        amount     : 0.1,
                        description: 'Dime'
                    });
                    postExtra({
                        date       : '2026-02-02',
                        amount     : 0.2,
                        description: 'Two dimes'
                    });

                    setup();
                    var response = get(
                        route   = '/api/v1/income',
                        headers = {'x-auth-token': jwt},
                        params  = {startDate: '2026-02-01', endDate: '2026-02-01'}
                    ).getResponse();
                    expect(response.getData().extra).toBe(0.3);
                });

                it('Accepts the boundary values for amount and description', () => {
                    var description = repeatString('a', 500);

                    var minResponse = postExtra({
                        date       : '2026-03-01',
                        amount     : 0.01,
                        description: 'Min'
                    });
                    expect(minResponse.getStatusCode()).toBe(200);

                    var maxResponse = postExtra({
                        date       : '2026-03-02',
                        amount     : 99999,
                        description: description
                    });
                    expect(maxResponse.getStatusCode()).toBe(200);

                    var data = getExtra('2026-03-01', '2026-03-01').getData();
                    expect(data.map((row) => row.amount)).toBe([99999, 0.01]);
                    expect(data[1].description).toBe(description);
                });

                // Each invalid payload should be rejected with a 400 and nothing saved
                var valid = {
                    date       : '2026-04-15',
                    amount     : 25,
                    description: 'Valid'
                };
                var invalidCases = [
                    {name: 'amount is missing', params: {date: valid.date, description: valid.description}},
                    {
                        name  : 'amount is zero',
                        params: {
                            date       : valid.date,
                            amount     : 0,
                            description: valid.description
                        }
                    },
                    {
                        name  : 'amount is negative',
                        params: {
                            date       : valid.date,
                            amount     : -25,
                            description: valid.description
                        }
                    },
                    {
                        name  : 'amount is above the max',
                        params: {
                            date       : valid.date,
                            amount     : 100000,
                            description: valid.description
                        }
                    },
                    {
                        name  : 'amount is not numeric',
                        params: {
                            date       : valid.date,
                            amount     : 'abc',
                            description: valid.description
                        }
                    },
                    {name: 'description is missing', params: {date: valid.date, amount: valid.amount}},
                    {
                        name  : 'description is empty',
                        params: {
                            date       : valid.date,
                            amount     : valid.amount,
                            description: ''
                        }
                    },
                    {
                        name  : 'description is too long',
                        params: {
                            date       : valid.date,
                            amount     : valid.amount,
                            description: repeatString('a', 501)
                        }
                    },
                    {name: 'date is missing', params: {amount: valid.amount, description: valid.description}},
                    {
                        name  : 'date is invalid',
                        params: {
                            date       : '2026-04-x',
                            amount     : valid.amount,
                            description: valid.description
                        }
                    },
                    {
                        name  : 'date is too early',
                        params: {
                            date       : '2023-12-31',
                            amount     : valid.amount,
                            description: valid.description
                        }
                    },
                    {
                        name  : 'date is too late',
                        params: {
                            date       : '2075-01-02',
                            amount     : valid.amount,
                            description: valid.description
                        }
                    }
                ];

                invalidCases.each((testCase) => {
                    it('Returns error when #testCase.name#', () => {
                        var before   = countExtra();
                        var response = postExtra(testCase.params);

                        expect(response.getStatusCode()).toBe(400);
                        expect(response.getError()).toBeTrue();
                        expect(response.getMessages()[1]).toInclude('Invalid Parameters');
                        expect(countExtra()).toBe(before);
                    });
                });

                it('Returns 401 with no token', () => {
                    var event = post(route = '/api/v1/income/extra', params = valid);

                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(401);
                    expect(response.getError()).toBeTrue();
                });
            });

            describe('DELETE /income/extra/:id', () => {
                it('Deletes an extra income entry and removes it from the totals', () => {
                    var keep = postExtra({
                        date       : '2025-11-05',
                        amount     : 10,
                        description: 'Keep'
                    }).getData().id;
                    var remove = postExtra({
                        date       : '2025-11-20',
                        amount     : 90,
                        description: 'Remove'
                    }).getData().id;
                    var before = countExtra();

                    setup();
                    var event    = delete(route = '/api/v1/income/extra/#remove#', headers = {'x-auth-token': jwt});
                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(200);
                    expect(response.getError()).toBeFalse();
                    expect(response.getMessages()[1]).toBe('Successfully deleted extra income.');
                    expect(countExtra()).toBe(before - 1);

                    // No longer listed
                    var data = getExtra('2025-11-01', '2025-11-01').getData();
                    expect(data.map((row) => row.id)).toBe([keep]);

                    // No longer counted in the totals
                    setup();
                    response = get(
                        route   = '/api/v1/income',
                        headers = {'x-auth-token': jwt},
                        params  = {startDate: '2025-11-01', endDate: '2025-11-01'}
                    ).getResponse();
                    expect(response.getData().extra).toBe(10);
                });

                it('Returns 404 when deleting the same entry twice', () => {
                    var id = postExtra({
                        date       : '2025-11-25',
                        amount     : 5,
                        description: 'Delete twice'
                    }).getData().id;

                    setup();
                    expect(
                        delete(route = '/api/v1/income/extra/#id#', headers = {'x-auth-token': jwt})
                            .getResponse()
                            .getStatusCode()
                    ).toBe(200);

                    setup();
                    var response = delete(route = '/api/v1/income/extra/#id#', headers = {'x-auth-token': jwt}).getResponse();
                    expect(response.getStatusCode()).toBe(404);
                    expect(response.getError()).toBeTrue();
                    expect(response.getMessages()[1]).toBe('Not found.');
                });

                it('Returns 404 for an id that does not exist', () => {
                    var event = delete(route = '/api/v1/income/extra/2147483647', headers = {'x-auth-token': jwt});

                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(404);
                    expect(response.getError()).toBeTrue();
                    expect(response.getMessages()[1]).toBe('Not found.');
                });

                it('Returns 404 and does not delete another user''s entry', () => {
                    var otherUser = mockUser.make();
                    var theirs    = incomeHelper.mock(
                        userid      = otherUser.getId(),
                        date        = createDate(2025, 11, 10),
                        pay         = 0,
                        extra       = 42,
                        description = 'Not yours'
                    ).extraIds[1];

                    var event    = delete(route = '/api/v1/income/extra/#theirs#', headers = {'x-auth-token': jwt});
                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(404);
                    expect(response.getError()).toBeTrue();

                    var stillExists = queryExecute(
                        'SELECT count(id) AS total FROM income_extra WHERE id = :id',
                        {id: {value: theirs, cfsqltype: 'numeric'}}
                    ).total;
                    expect(stillExists).toBe(1);

                    mockUser.delete(otherUser);
                });

                it('Returns error for an id below 1', () => {
                    var event = delete(route = '/api/v1/income/extra/0', headers = {'x-auth-token': jwt});

                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(400);
                    expect(response.getError()).toBeTrue();
                    expect(response.getMessages()[1]).toInclude('Invalid Parameters');
                });

                it('Returns 401 with no token', () => {
                    var event = delete(route = '/api/v1/income/extra/1');

                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(401);
                    expect(response.getError()).toBeTrue();
                });
            });

            describe('Invalid HTTP methods', () => {
                it('Returns 405 when using PUT on /income/extra', () => {
                    var event = put(route = '/api/v1/income/extra', headers = {'x-auth-token': jwt});

                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(405);
                    expect(response.getError()).toBeTrue();
                    expect(response.getMessages()[1]).toInclude('InvalidHTTPMethod Execution');
                });

                it('Returns 405 when using GET on /income/extra/:id', () => {
                    var event = get(route = '/api/v1/income/extra/1', headers = {'x-auth-token': jwt});

                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(405);
                    expect(response.getError()).toBeTrue();
                    expect(response.getMessages()[1]).toInclude('InvalidHTTPMethod Execution');
                });
            });
        });
    }

}
