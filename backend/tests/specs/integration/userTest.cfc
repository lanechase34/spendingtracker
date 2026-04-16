component extends="tests.resources.baseTest" {

    function beforeAll() {
        super.beforeAll();

        mockUser = getInstance('tests.resources.mockuser');
    }

    function afterAll() {
        super.afterAll();
    }

    function run() {
        describe('User Endpoints', () => {
            describe('GET /api/v1/me', () => {
                beforeEach(() => {
                    setup();

                    /**
                     * Regular user
                     */
                    cbauth.logout();
                    user = mockUser.make();
                    jwt  = mockUser.login(user);
                });

                afterEach(() => {
                    mockUser.logout(user, jwt);
                    mockUser.delete(user);
                });

                it('Returns 200 with user profile data for a verified user', () => {
                    var event    = get(route = '/api/v1/me', headers = {'x-auth-token': jwt});
                    var response = event.getResponse();

                    expect(response.getStatusCode()).toBe(200);
                    expect(response.getData()).toHaveKey('role');
                    expect(response.getData()).toHaveKey('salary');
                    expect(response.getData()).toHaveKey('monthlytakehome');
                    expect(response.getData()).toHaveKey('settings');
                });

                it('Returns 401 with no token', () => {
                    var event    = get(route = '/api/v1/me');
                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(401);
                    expect(response.getError()).toBeTrue();
                });

                it('Returns 401 with an invalid token', () => {
                    var event    = get(route = '/api/v1/me', headers = {'x-auth-token': 'not.a.real.token'});
                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(401);
                    expect(response.getError()).toBeTrue();
                });

                it('Returns the correct role for the authenticated user', () => {
                    var event    = get(route = '/api/v1/me', headers = {'x-auth-token': jwt});
                    var response = event.getResponse();

                    expect(response.getStatusCode()).toBe(200);
                    expect(response.getData().role).toBeIn(['USER', 'ADMIN']);
                });
            });

            describe('PATCH /api/v1/me', () => {
                beforeEach(() => {
                    setup();

                    /**
                     * Regular user
                     */
                    cbauth.logout();
                    user = mockUser.make();
                    jwt  = mockUser.login(user);
                });

                afterEach(() => {
                    mockUser.logout(user, jwt);
                    mockUser.delete(user);
                });

                it('Returns 200 with a success message when updating password', () => {
                    var event = patch(
                        route   = '/api/v1/me',
                        params  = {password: 'NewPassword123!'},
                        headers = {'x-auth-token': jwt}
                    );
                    var response = event.getResponse();

                    expect(response.getStatusCode()).toBe(200);
                    expect(response.getMessages()[1]).toInclude('Successfully updated');

                    setup();
                    patch(
                        route   = '/api/v1/me',
                        params  = {password: 'TestPassword123!'},
                        headers = {'x-auth-token': jwt}
                    );
                });

                it('Returns 200 when updating salary', () => {
                    var event = patch(
                        route   = '/api/v1/me',
                        params  = {salary: 90000},
                        headers = {'x-auth-token': jwt}
                    );
                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(200);
                    expect(response.getMessages()[1]).toInclude('Successfully updated');
                });

                it('Returns 200 when updating monthlyTakeHome', () => {
                    var event = patch(
                        route   = '/api/v1/me',
                        params  = {monthlyTakeHome: 6000},
                        headers = {'x-auth-token': jwt}
                    );
                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(200);
                    expect(response.getMessages()[1]).toInclude('Successfully updated');
                });

                it('Returns 200 when updating settings', () => {
                    var event = patch(
                        route   = '/api/v1/me',
                        params  = {settings: serializeJSON({theme: 'dark', updated: true})},
                        headers = {'x-auth-token': jwt}
                    );
                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(200);
                    expect(response.getMessages()[1]).toInclude('Successfully updated');
                });

                it('Persists salary update - GET /me reflects new value', () => {
                    patch(
                        route   = '/api/v1/me',
                        params  = {salary: 80000},
                        headers = {'x-auth-token': jwt}
                    );

                    setup();
                    var event    = get(route = '/api/v1/me', headers = {'x-auth-token': jwt});
                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(200);
                    expect(response.getData().salary).toBe(80000);
                });

                it('Persists monthlyTakeHome update - GET /me reflects new value', () => {
                    patch(
                        route   = '/api/v1/me',
                        params  = {monthlyTakeHome: 5500},
                        headers = {'x-auth-token': jwt}
                    );

                    setup();
                    var event    = get(route = '/api/v1/me', headers = {'x-auth-token': jwt});
                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(200);
                    expect(response.getData().monthlytakehome).toBe(5500);
                });

                it('Returns 401 with no token', () => {
                    var event    = patch(route = '/api/v1/me', params = {salary: 90000});
                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(401);
                    expect(response.getError()).toBeTrue();
                });

                it('Ignores salary update when value is 0 or negative', () => {
                    // Get current salary first
                    var beforeEvent  = get(route = '/api/v1/me', headers = {'x-auth-token': jwt});
                    var originalData = beforeEvent.getResponse().getData();

                    setup();
                    patch(
                        route   = '/api/v1/me',
                        params  = {salary: -1},
                        headers = {'x-auth-token': jwt}
                    );

                    setup();
                    var afterEvent = get(route = '/api/v1/me', headers = {'x-auth-token': jwt});
                    expect(afterEvent.getResponse().getData().salary).toBe(originalData.salary);
                });
            });

            describe('GET /api/v1/users', () => {
                beforeEach(() => {
                    setup();

                    /**
                     * ADMIN only endpoint, create jwt for admin user
                     */
                    cbauth.logout();
                    adminUser = mockUser.make(security_level = 50);
                    adminJwt  = mockUser.login(adminUser);
                });

                afterEach(() => {
                    mockUser.logout(adminUser, adminJwt);
                    mockUser.delete(adminUser);
                });

                it('Returns 401 with no token', () => {
                    var event    = get(route = '/api/v1/users');
                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(401);
                    expect(response.getError()).toBeTrue();
                });

                it('Returns 403 for a non-admin User role', () => {
                    // Create regular user
                    cbauth.logout();
                    user = mockUser.make();
                    jwt  = mockUser.login(user);

                    var event = get(
                        route   = '/api/v1/users',
                        params  = {page: 1, records: 10},
                        headers = {'x-auth-token': jwt}
                    );
                    var response = event.getResponse();

                    // User role should be forbidden from Admin-secured route
                    expect(response.getStatusCode()).toBeIn([401, 403]);
                    expect(response.getError()).toBeTrue();
                });

                it('Returns 200 with paginated results for an Admin user', () => {
                    var event = get(
                        route   = '/api/v1/users',
                        params  = {page: 1, records: 10},
                        headers = {'x-auth-token': adminJwt}
                    );
                    var response = event.getResponse();

                    expect(response.getStatusCode()).toBe(200);
                    expect(response.getData()).toHaveKey('users');

                    var pagination = response.getPagination();
                    expect(pagination).toHaveKey('totalRecords');
                    expect(pagination).toHaveKey('filteredRecords');
                    expect(pagination).toHaveKey('page');
                    expect(pagination).toHaveKey('offset');
                });

                it('Returns correct page and offset for page 2', () => {
                    var event = get(
                        route   = '/api/v1/users',
                        params  = {page: 2, records: 10},
                        headers = {'x-auth-token': adminJwt}
                    );
                    var response   = event.getResponse();
                    var pagination = response.getPagination();

                    expect(response.getStatusCode()).toBe(200);
                    expect(pagination.page).toBe(2);
                    expect(pagination.offset).toBe(10);
                });

                it('Filters results by email search term', () => {
                    var event = get(
                        route  = '/api/v1/users',
                        params = {
                            page   : 1,
                            records: 10,
                            search : adminUser.getEmail()
                        },
                        headers = {'x-auth-token': adminJwt}
                    );
                    var response = event.getResponse();

                    expect(response.getStatusCode()).toBe(200);
                    expect(response.getData().users).toHaveLength(1);
                    expect(response.getData().users[1].email).toBe(lCase(adminUser.getEmail()));
                });

                it('Returns empty results for a search term that matches nothing', () => {
                    var event = get(
                        route  = '/api/v1/users',
                        params = {
                            page   : 1,
                            records: 10,
                            search : 'zzznomatch#createUUID()#'
                        },
                        headers = {'x-auth-token': adminJwt}
                    );
                    var response = event.getResponse();

                    expect(response.getStatusCode()).toBe(200);
                    expect(response.getData().users).toHaveLength(0);
                    expect(response.getPagination().filteredRecords).toBe(0);
                });

                it('Returns results ordered by lastlogin desc by default', () => {
                    var event = get(
                        route   = '/api/v1/users',
                        params  = {page: 1, records: 10},
                        headers = {'x-auth-token': adminJwt}
                    );
                    var response = event.getResponse();
                    var users    = response.getData().users;

                    expect(response.getStatusCode()).toBe(200);

                    // Verify descending lastlogin order where both values are not null
                    if(users.len() > 1) {
                        for(var i = 1; i < users.len(); i++) {
                            if(!isNull(users[i].lastlogin) && !isNull(users[i + 1].lastlogin)) {
                                expect(users[i].lastlogin).toBeGTE(users[i + 1].lastlogin);
                            }
                        }
                    }
                });

                it('Maps security_level to role string in returned records', () => {
                    var event = get(
                        route   = '/api/v1/users',
                        params  = {page: 1, records: 50},
                        headers = {'x-auth-token': adminJwt}
                    );
                    var response = event.getResponse();
                    var users    = response.getData().users;

                    expect(response.getStatusCode()).toBe(200);

                    users.each((u) => {
                        expect(u.security_level).toBeIn(['UNVERIFIED', 'USER', 'ADMIN']);
                    });
                });
            });
        });
    }

}
