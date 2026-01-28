component extends="tests.resources.baseTest" {

    property name="cbauth" inject="authenticationService@cbauth";

    function beforeAll() {
        super.beforeAll();

        q           = getInstance('provider:QueryBuilder@qb');
        mockUser    = getInstance('tests.resources.mockuser');
        userService = getInstance('services.user');
    }

    function afterAll() {
        super.afterAll();
    }

    function run() {
        describe('Mock User', () => {
            beforeEach((currentSpec) => {
                setup();
            });

            it('Can be created', () => {
                expect(mockUser).toBeComponent();
            });

            describe('Mock user life cycle', () => {
                it('Can create a mock user', () => {
                    count = countUsers();

                    /**
                     * Share user throughout tests
                     */
                    user = mockUser.make();

                    expect(user).toBeComponent();
                    expect(countUsers()).toBe(count + 1);
                    expect(user.getId()).toBeGTE(1);
                });

                it('Can login mock user and receive JWT', () => {
                    jwt = mockUser.login(user);

                    expect(jwt).toBeString();
                    expect(jwt.len()).toBeGT(1);
                });

                it('Can logout mock user and invalidate JWT', () => {
                    mockUser.logout(userObj = user, jwt = jwt);

                    expect(cbauth.isLoggedIn()).toBeFalse();
                });

                it('Can delete a mock user', () => {
                    mockUser.delete(user);

                    /**
                     * Make sure user deleted
                     */
                    // var user = userService.retrieveUserById(user.getId());

                    // expect(user).toBeComponent();
                    // expect(user.isLoaded()).toBeFalse(); // no longer valid
                    // expect(countUsers()).toBe(count); // Count is reverted to original
                });

                it('Can create an admin level user', () => {
                    var adminUser       = mockUser.make(security_level = 50);
                    var adminPermission = 'ADMIN'

                    expect(adminUser.getPermissions()).toInclude(adminPermission);
                    expect(adminUser.hasPermission(adminPermission)).toBeTrue();
                    mockUser.delete(adminUser);
                });
            });
        });
    }

    // Count the number of users in database
    numeric function countUsers() {
        return q.from('users').count();
    }

}
