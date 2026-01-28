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
        describe('/api/v1/income', () => {
            beforeEach(() => {
                setup();
            });

            it('GET /income to return income', () => {
                var event = get(
                    route   = '/api/v1/income',
                    headers = {'x-auth-token': jwt},
                    params  = {startDate: '2025-01', endDate: '2025-03'}
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
                        startDate: '2025-01-01', // invalid format should be YYYY-MM
                        endDate  : '2025-03'
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
                    params  = {date: '2025-01', pay: 5000, extra: 200}
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
                    params  = {startDate: '2025-01', endDate: '2025-03'}
                );
                response = event.getResponse();
                expect(response.getStatusCode()).toBe(200);
                expect(response.getData().pay).toBe(5000);
                expect(response.getData().extra).toBe(200);
            });

            it('PUT /income returns error for invalid parameters', () => {
                var event = put(
                    route   = '/api/v1/income',
                    headers = {'x-auth-token': jwt},
                    params  = {
                        date : '2025-01',
                        pay  : -5000,
                        extra: 200
                    }
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
                        date  : {value: '2025-01-01', cfsqltype: 'date'}
                    }
                ).count;

                /**
                 * Update the record saved above
                 */
                var event = put(
                    route   = '/api/v1/income',
                    headers = {'x-auth-token': jwt},
                    params  = {date: '2025-01', pay: 500, extra: 87}
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
                    params  = {startDate: '2025-01', endDate: '2025-03'}
                );
                response = event.getResponse();
                expect(response.getStatusCode()).toBe(200);
                expect(response.getData().pay).toBe(500);
                expect(response.getData().extra).toBe(87);

                /**
                 * Check that a new record has not been created
                 */
                var afterCheck = queryExecute(
                    'select count(id) from income where userid = :userid and date = :date',
                    {
                        userid: {value: user.getId(), cfsqltype: 'numeric'},
                        date  : {value: '2025-01-01', cfsqltype: 'date'}
                    }
                ).count;

                expect(beforeCheck).toBe(afterCheck);
            });

            it('GET /income to return income in date range', () => {
                var event;

                /**
                 * Save data for 2025-02, 2025-03, and 2025-04
                 */
                event = put(
                    route   = '/api/v1/income',
                    headers = {'x-auth-token': jwt},
                    params  = {date: '2025-02', pay: 10, extra: 1}
                );
                event = put(
                    route   = '/api/v1/income',
                    headers = {'x-auth-token': jwt},
                    params  = {date: '2025-03', pay: 20, extra: 2}
                );
                event = put(
                    route   = '/api/v1/income',
                    headers = {'x-auth-token': jwt},
                    params  = {date: '2025-04', pay: 30, extra: 3}
                );

                /**
                 * Get sum of all the income in this date range
                 */
                event = get(
                    route   = '/api/v1/income',
                    headers = {'x-auth-token': jwt},
                    params  = {startDate: '2025-02', endDate: '2025-04'}
                );

                var response = event.getResponse();
                expect(response.getStatusCode()).toBe(200);
                expect(response.getData().pay).toBe(60); // sum of all pay
                expect(response.getData().extra).toBe(6); // sum of all extra
            });
        });
    }

}

