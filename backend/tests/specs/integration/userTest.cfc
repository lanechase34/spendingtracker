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

                it('Returns 400 when updating password without currentPassword', () => {
                    var event = patch(
                        route   = '/api/v1/me',
                        params  = {password: 'NewPassword123!'},
                        headers = {'x-auth-token': jwt}
                    );
                    var response = event.getResponse();

                    expect(response.getStatusCode()).toBe(400);
                    expect(response.getError()).toBeTrue();
                    expect(response.getMessages()[1]).toBe('Current password is incorrect.');
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
                        params  = {settings: serializeJSON({theme: 'dark'})},
                        headers = {'x-auth-token': jwt}
                    );
                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(200);
                    expect(response.getMessages()[1]).toInclude('Successfully updated');

                    setup();
                    var user = get(route = '/api/v1/me', headers = {'x-auth-token': jwt});

                    var userResponse = user.getResponse();
                    expect(userResponse.getStatusCode()).toBe(200);

                    var userRecord = userResponse.getData();
                    expect(userRecord).toHaveKey('settings');
                    expect(userRecord.settings).toHaveKey('theme');
                    expect(userRecord.settings.theme).toBe('dark');
                    expect(userRecord.settings).notToHaveKey('updated');
                });

                it('Persists multiple settings keys correctly', () => {
                    patch(
                        route  = '/api/v1/me',
                        params = {
                            settings: serializeJSON({
                                theme   : 'light',
                                fontSize: 'large',
                                sidebar : true
                            })
                        },
                        headers = {'x-auth-token': jwt}
                    );

                    setup();
                    var settings = get(route = '/api/v1/me', headers = {'x-auth-token': jwt})
                        .getResponse()
                        .getData()
                        .settings;

                    expect(settings.theme).toBe('light');
                    expect(settings.fontSize).toBe('large');
                    expect(settings.sidebar).toBeTrue();
                    expect(settings).notToHaveKey('updated');
                });

                it('Replaces settings entirely on second update - does not merge', () => {
                    patch(
                        route   = '/api/v1/me',
                        params  = {settings: serializeJSON({theme: 'dark', fontSize: 'small'})},
                        headers = {'x-auth-token': jwt}
                    );

                    setup();
                    patch(
                        route   = '/api/v1/me',
                        params  = {settings: serializeJSON({theme: 'light'})},
                        headers = {'x-auth-token': jwt}
                    );

                    setup();
                    var settings = get(route = '/api/v1/me', headers = {'x-auth-token': jwt})
                        .getResponse()
                        .getData()
                        .settings;

                    expect(settings.theme).toBe('light');
                    expect(settings).notToHaveKey('fontSize');
                });

                it('Does not update settings when settings param is omitted', () => {
                    patch(
                        route   = '/api/v1/me',
                        params  = {settings: serializeJSON({theme: 'dark'})},
                        headers = {'x-auth-token': jwt}
                    );

                    setup();
                    patch(
                        route   = '/api/v1/me',
                        params  = {salary: 75000},
                        headers = {'x-auth-token': jwt}
                    );

                    setup();
                    var settings = get(route = '/api/v1/me', headers = {'x-auth-token': jwt})
                        .getResponse()
                        .getData()
                        .settings;

                    expect(settings.theme).toBe('dark');
                });

                it('Stores a value containing a single quote as a literal - not SQL injection', () => {
                    var maliciousValue = 'O''Brien';
                    patch(
                        route   = '/api/v1/me',
                        params  = {settings: serializeJSON({name: maliciousValue})},
                        headers = {'x-auth-token': jwt}
                    );

                    setup();
                    var settings = get(route = '/api/v1/me', headers = {'x-auth-token': jwt})
                        .getResponse()
                        .getData()
                        .settings;

                    expect(settings.name).toBe(maliciousValue);
                });

                it('Stores a SQL DDL injection payload as a literal string - does not execute', () => {
                    var maliciousValue = '''; DROP TABLE users; --';
                    patch(
                        route   = '/api/v1/me',
                        params  = {settings: serializeJSON({theme: maliciousValue})},
                        headers = {'x-auth-token': jwt}
                    );

                    setup();
                    var meResponse = get(route = '/api/v1/me', headers = {'x-auth-token': jwt}).getResponse();

                    // Users table must still exist and the request must succeed
                    expect(meResponse.getStatusCode()).toBe(200);
                    expect(meResponse.getData().settings.theme).toBe(maliciousValue);
                });

                it('Stores a SQL UNION injection payload as a literal string', () => {
                    var maliciousValue = 'dark'' UNION SELECT password FROM users--';
                    patch(
                        route   = '/api/v1/me',
                        params  = {settings: serializeJSON({theme: maliciousValue})},
                        headers = {'x-auth-token': jwt}
                    );

                    setup();
                    var settings = get(route = '/api/v1/me', headers = {'x-auth-token': jwt})
                        .getResponse()
                        .getData()
                        .settings;

                    expect(settings.theme).toBe(maliciousValue);
                });

                it('Stores JSON structural characters as a plain string - does not expand into JSONB object', () => {
                    var maliciousValue = '{"injected":true}';
                    patch(
                        route   = '/api/v1/me',
                        params  = {settings: serializeJSON({theme: maliciousValue, updated: true})},
                        headers = {'x-auth-token': jwt}
                    );

                    setup();
                    var settings = get(route = '/api/v1/me', headers = {'x-auth-token': jwt})
                        .getResponse()
                        .getData()
                        .settings;

                    expect(settings.theme).toBe(maliciousValue);
                    expect(settings).notToHaveKey('injected');
                });

                it('Returns an error when settings is not valid JSON', () => {
                    var event = patch(
                        route   = '/api/v1/me',
                        params  = {settings: 'not-valid-json'},
                        headers = {'x-auth-token': jwt}
                    );
                    var response = event.getResponse();

                    expect(response.getStatusCode()).toBe(400);
                    expect(response.getError()).toBeTrue();
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

            describe('PATCH /api/v1/me - changing password', () => {
                beforeEach(() => {
                    setup();

                    cbauth.logout();
                    getInstance('JwtService@cbsecurity').getTokenStorage().clearAll();

                    // checkCurrentPassword always checks the real password, even with impersonation on
                    currentPassword = 'CurrentPassword123!';
                    newPassword     = 'NewPassword456!';
                    user            = mockUser.make(password = currentPassword);
                    jwt             = mockUser.login(user);

                    storedImpersonation = getInstance('services.user').getImpersonation();
                    setup();
                });

                afterEach(() => {
                    getInstance('services.user').setImpersonation(storedImpersonation);

                    // The token may be revoked by now, so don't go through /logout
                    cbauth.logout();
                    getInstance('JwtService@cbsecurity').getTokenStorage().clearAll();
                    mockUser.delete(user);
                });

                it('Returns 400 and changes nothing without currentPassword', () => {
                    var before = getPasswordRecord(user.getId());

                    var event = patch(
                        route   = '/api/v1/me',
                        params  = {password: newPassword},
                        headers = {'x-auth-token': jwt}
                    );
                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(400);
                    expect(response.getError()).toBeTrue();
                    expect(response.getMessages()[1]).toBe('Current password is incorrect.');

                    var after = getPasswordRecord(user.getId());
                    expect(after.password).toBe(before.password);
                    expect(after.changed).toBeFalse();

                    // Token still works
                    setup();
                    expect(get(route = '/api/v1/me', headers = {'x-auth-token': jwt}).getResponse().getStatusCode()).toBe(
                        200
                    );
                });

                it('Returns 400 and changes nothing with a wrong currentPassword', () => {
                    var before = getPasswordRecord(user.getId());

                    var event = patch(
                        route   = '/api/v1/me',
                        params  = {password: newPassword, currentPassword: 'WrongPassword999!'},
                        headers = {'x-auth-token': jwt}
                    );
                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(400);
                    expect(response.getError()).toBeTrue();
                    expect(response.getMessages()[1]).toBe('Current password is incorrect.');

                    var after = getPasswordRecord(user.getId());
                    expect(after.password).toBe(before.password);
                    expect(after.changed).toBeFalse();

                    // Token still works
                    setup();
                    expect(get(route = '/api/v1/me', headers = {'x-auth-token': jwt}).getResponse().getStatusCode()).toBe(
                        200
                    );
                });

                it('Does not apply other fields sent with a rejected password change', () => {
                    setup();
                    var originalSalary = get(route = '/api/v1/me', headers = {'x-auth-token': jwt})
                        .getResponse()
                        .getData()
                        .salary;

                    setup();
                    patch(
                        route  = '/api/v1/me',
                        params = {
                            password       : newPassword,
                            currentPassword: 'WrongPassword999!',
                            salary         : 123456
                        },
                        headers = {'x-auth-token': jwt}
                    );

                    setup();
                    var salary = get(route = '/api/v1/me', headers = {'x-auth-token': jwt})
                        .getResponse()
                        .getData()
                        .salary;
                    expect(salary).toBe(originalSalary);
                });

                it('Returns 400 when the new password is too short', () => {
                    var event = patch(
                        route   = '/api/v1/me',
                        params  = {password: 'short', currentPassword: currentPassword},
                        headers = {'x-auth-token': jwt}
                    );
                    expect(event.getResponse().getStatusCode()).toBe(400);
                    expect(getPasswordRecord(user.getId()).changed).toBeFalse();
                });

                it('Updates salary without currentPassword and keeps the token valid', () => {
                    var event = patch(
                        route   = '/api/v1/me',
                        params  = {salary: 91000},
                        headers = {'x-auth-token': jwt}
                    );
                    expect(event.getResponse().getStatusCode()).toBe(200);
                    expect(event.getResponse().getMessages()[1]).toInclude('Successfully updated');
                    expect(getPasswordRecord(user.getId()).changed).toBeFalse();

                    setup();
                    var meEvent = get(route = '/api/v1/me', headers = {'x-auth-token': jwt});
                    expect(meEvent.getResponse().getStatusCode()).toBe(200);
                    expect(meEvent.getResponse().getData().salary).toBe(91000);
                });

                it('Returns 200 and asks to log in again with the right currentPassword', () => {
                    var before = getPasswordRecord(user.getId());

                    var event = patch(
                        route   = '/api/v1/me',
                        params  = {password: newPassword, currentPassword: currentPassword},
                        headers = {'x-auth-token': jwt}
                    );
                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(200);
                    expect(response.getError()).toBeFalse();
                    expect(response.getMessages()[1]).toBe('Password updated. Please log in again.');

                    var after = getPasswordRecord(user.getId());
                    expect(after.password).notToBe(before.password);
                    expect(after.changed).toBeTrue();
                });

                it('Rejects the old token on secured routes after the password changes', () => {
                    patch(
                        route   = '/api/v1/me',
                        params  = {password: newPassword, currentPassword: currentPassword},
                        headers = {'x-auth-token': jwt}
                    );
                    // A real next request starts logged out - request scope carries over between test requests
                    cbauth.logout();

                    setup();
                    var meResponse = get(route = '/api/v1/me', headers = {'x-auth-token': jwt}).getResponse();
                    expect(meResponse.getStatusCode()).toBe(401);
                    expect(meResponse.getError()).toBeTrue();

                    setup();
                    var patchResponse = patch(
                        route   = '/api/v1/me',
                        params  = {salary: 1000},
                        headers = {'x-auth-token': jwt}
                    ).getResponse();
                    expect(patchResponse.getStatusCode()).toBe(401);
                });

                it('Rejects the old token when the rate limiter loads the user before the firewall', () => {
                    // The rate limiter authenticates the token first and swallows the rejection -
                    // the revoked token must still be refused by the firewall afterwards
                    var rateLimiter = application.cbController
                        .getInterceptorService()
                        .getInterceptor('rateLimiterInterceptor');
                    rateLimiter.injectPropertyMixin(propertyName = 'useRateLimiter', propertyValue = true);
                    getInstance('cachebox:rateStorage').clearAll();

                    try {
                        patch(
                            route   = '/api/v1/me',
                            params  = {password: newPassword, currentPassword: currentPassword},
                            headers = {'x-auth-token': jwt}
                        );
                        cbauth.logout();

                        // user.updateprofile has a per-user rate limit, so the limiter loads the user from the token
                        setup();
                        var patchResponse = patch(
                            route   = '/api/v1/me',
                            params  = {salary: 1000},
                            headers = {'x-auth-token': jwt}
                        ).getResponse();
                        expect(patchResponse.getStatusCode()).toBe(401);
                    }
                    finally {
                        rateLimiter.injectPropertyMixin(propertyName = 'useRateLimiter', propertyValue = false);
                    }
                });

                it('Logs in with the new password, not the old one, after changing it', () => {
                    patch(
                        route   = '/api/v1/me',
                        params  = {password: newPassword, currentPassword: currentPassword},
                        headers = {'x-auth-token': jwt}
                    );
                    cbauth.logout();

                    // Real password checks for login
                    getInstance('services.user').setImpersonation(false);

                    setup();
                    var oldLogin = post(
                        route  = '/api/v1/login',
                        params = {
                            email     : user.getEmail(),
                            password  : currentPassword,
                            rememberMe: false
                        }
                    );
                    expect(oldLogin.getResponse().getStatusCode()).toBe(401);

                    // Tokens issued in the same second as the change are revoked too (iat <= password_changed_at)
                    sleep(1100);

                    setup();
                    var newLogin = post(
                        route  = '/api/v1/login',
                        params = {
                            email     : user.getEmail(),
                            password  : newPassword,
                            rememberMe: false
                        }
                    );
                    expect(newLogin.getResponse().getStatusCode()).toBe(200);
                    var newJwt = newLogin.getResponse().getData().access_token;

                    // The new token is issued after the change, so it works
                    setup();
                    expect(get(route = '/api/v1/me', headers = {'x-auth-token': newJwt}).getResponse().getStatusCode()).toBe(
                        200
                    );
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

    /**
     * Read the user's password hash and whether password_changed_at is set, straight from the database
     */
    private struct function getPasswordRecord(required numeric id) {
        return queryExecute(
            'SELECT password, password_changed_at IS NOT NULL AS changed FROM users WHERE id = :id',
            {id: {value: id, cfsqltype: 'integer'}},
            {returnType: 'array'}
        )[1];
    }

}
