component extends="tests.resources.baseTest" {

    function beforeAll() {
        super.beforeAll();

        mockUser = getInstance("tests.resources.mockuser");
    }

    function afterAll() {
        super.afterAll();
    }

    function run() {
        describe("Impersonation only works in development", () => {
            beforeEach(() => {
                setup();

                userService         = getInstance("services.user");
                storedImpersonation = userService.getImpersonation();
                storedEnvironment   = userService.getEnvironment();
            });

            afterEach(() => {
                userService.setImpersonation(storedImpersonation);
                userService.setEnvironment(storedEnvironment);
                cbauth.logout();
            });

            it("Stays off outside development even when the setting is on", () => {
                userService.setImpersonation(true);

                for(var env in ["test", "production", "staging", ""]) {
                    userService.setEnvironment(env);
                    expect(userService.isImpersonating()).toBeFalse("Impersonation must be off in [#env#]");
                }
            });

            it("Is on in development only when the setting is on", () => {
                userService.setEnvironment("development");

                userService.setImpersonation(false);
                expect(userService.isImpersonating()).toBeFalse();

                userService.setImpersonation(true);
                expect(userService.isImpersonating()).toBeTrue();
            });

            it("Rejects a wrong password at login outside development even when the setting is on", () => {
                var user = mockUser.make();

                userService.setImpersonation(true);
                userService.setEnvironment("production");

                var event = post(
                    route  = "/api/v1/login",
                    params = {
                        email     : user.getEmail(),
                        password  : createUUID(),
                        rememberMe: false
                    }
                );

                expect(event.getResponse().getStatusCode()).toBe(401);
                expect(event.getResponse().getHasData()).toBeFalse();

                mockUser.delete(user);
            });
        });
    }

}
