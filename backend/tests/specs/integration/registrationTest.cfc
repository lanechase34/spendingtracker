component extends="tests.resources.baseTest" {

    property name="jwtService" inject="JwtService@cbsecurity";
    property name="cbauth"     inject="authenticationService@cbauth";

    function beforeAll() {
        super.beforeAll();
    }

    function afterAll() {
        super.afterAll();
    }

    function run() {
        describe("Registration Tests", () => {
            beforeEach((currentSpec) => {
                setup();

                // Make sure nothing is logged in to start our calls
                cbauth.logout();
                jwtService.getTokenStorage().clearAll();

                // Real password checks - impersonation only works in development, this guards against it anyway
                var userService     = getInstance("services.user");
                storedImpersonation = userService.getImpersonation();
                userService.setImpersonation(false);

                // Test vars
                testEmail    = "test_#createUUID()#@example.com";
                testPassword = "TestPassword123!";
                testSalary   = 75000;
                testTakeHome = 5000;
                testUserId   = -1;
            });

            afterEach(() => {
                getInstance("services.user").setImpersonation(storedImpersonation);

                // Make sure we log out any user(s) made
                cbauth.logout();
                jwtService.getTokenStorage().clearAll();

                testUserId = -1;
            });

            describe("POST /register - invalid inputs", () => {
                it("Fails when email is missing", () => {
                    var event = post(
                        route  = "/api/v1/register",
                        params = {
                            password       : testPassword,
                            salary         : testSalary,
                            monthlyTakeHome: testTakeHome
                        }
                    );
                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(400);
                    expect(response.getError()).toBeTrue();
                });

                it("Fails when password is missing", () => {
                    var event = post(
                        route  = "/api/v1/register",
                        params = {
                            email          : testEmail,
                            salary         : testSalary,
                            monthlyTakeHome: testTakeHome
                        }
                    );
                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(400);
                    expect(response.getError()).toBeTrue();
                });

                it("Fails when salary is missing", () => {
                    var event = post(
                        route  = "/api/v1/register",
                        params = {
                            email          : testEmail,
                            password       : testPassword,
                            monthlyTakeHome: testTakeHome
                        }
                    );
                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(400);
                    expect(response.getError()).toBeTrue();
                });

                it("Fails with an invalid email format", () => {
                    var event = post(
                        route  = "/api/v1/register",
                        params = {
                            email          : "not-a-valid-email",
                            password       : testPassword,
                            salary         : testSalary,
                            monthlyTakeHome: testTakeHome
                        }
                    );
                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(400);
                    expect(response.getError()).toBeTrue();
                });
            });

            describe("POST /register - rate limiting", () => {
                beforeEach(() => {
                    enableRateLimiter();
                });

                afterEach(() => {
                    disableRateLimiter();
                });

                it("Returns 429 with correct JSON response after exceeding the rate limit", () => {
                    var registerLimit = application.cbController.getSetting("rateLimits")["auth.register"][1].limit;

                    // exhaust the limit
                    for(var i = 1; i <= registerLimit; i++) {
                        setup();
                        post(
                            route  = "/api/v1/register",
                            params = {
                                email          : "test_#createUUID()#@example.com",
                                password       : testPassword,
                                salary         : testSalary,
                                monthlyTakeHome: testTakeHome
                            }
                        );
                    }

                    // Next request should be rate limited
                    setup();
                    var event = post(
                        route  = "/api/v1/register",
                        params = {
                            email          : "test_#createUUID()#@example.com",
                            password       : testPassword,
                            salary         : testSalary,
                            monthlyTakeHome: testTakeHome
                        }
                    );
                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(429);
                    expect(response.getError()).toBeTrue();
                    expect(response.getMessages()[1]).toBe("Too many attempts. Please try again later.");

                    // Check the rendered data and ensure json packet
                    var renderData = event.getRenderData();

                    expect(renderData.statusCode).toBe(429);
                    expect(renderData.type).toBe("json");
                    expect(renderData.data.error).toBeTrue();
                    expect(renderData.data.messages[1]).toBe("Too many attempts. Please try again later.");
                });
            });

            describe("POST /register - success", () => {
                it("Returns a 200 with the verification message and no access_token", () => {
                    var event    = postRegister();
                    var response = event.getResponse();

                    expect(response.getStatusCode()).toBe(200);
                    expect(response.getError()).toBeFalse();
                    expect(response.getMessages()[1]).toBe("Check your email for a verification code.");
                    expect(response.getHasData()).toBeFalse();
                });

                it("Creates the user in an unverified state with security_level 0 and a pending code", () => {
                    postRegister();

                    var record = getUserRecord(testEmail);

                    expect(record).notToBeEmpty();
                    expect(record.verified).toBeFalse();
                    expect(record.security_level).toBe(0);
                    expect(record.hascode).toBeTrue();
                    expect(record.hassentdate).toBeTrue();
                });

                it("Stores the email lowercased", () => {
                    postRegister(email = uCase(testEmail));

                    var record = getUserRecord(testEmail);
                    expect(record).notToBeEmpty();
                    expect(record.email).toBe(lCase(testEmail));
                });
            });

            describe("POST /register - existing email", () => {
                it("Returns the same 200 response for a verified email and changes nothing", () => {
                    postRegister();
                    forceVerify(testEmail);
                    var before = getUserRecord(testEmail);

                    setup();
                    var event = postRegister(
                        password        = "DifferentPassword456!",
                        salary          = 1,
                        monthlyTakeHome = 1
                    );

                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(200);
                    expect(response.getError()).toBeFalse();
                    expect(response.getMessages()[1]).toBe("Check your email for a verification code.");
                    expect(response.getHasData()).toBeFalse();

                    var after = getUserRecord(testEmail);
                    expect(after.password).toBe(before.password);
                    expect(after.salary).toBe(before.salary);
                    expect(after.monthlytakehome).toBe(before.monthlytakehome);
                    expect(after.verified).toBeTrue();
                    expect(after.security_level).toBe(10);

                    // Still exactly one account for the email
                    var count = queryExecute(
                        "SELECT count(*) AS total FROM users WHERE email = :email",
                        {email: {value: lCase(testEmail), cfsqltype: "varchar"}}
                    );
                    expect(count.total).toBe(1);
                });

                it("Can still log in with the original password after a duplicate registration of a verified email", () => {
                    postRegister();
                    forceVerify(testEmail);

                    setup();
                    postRegister(password = "DifferentPassword456!");

                    setup();
                    var event = post(
                        route  = "/api/v1/login",
                        params = {
                            email     : testEmail,
                            password  : testPassword,
                            rememberMe: false
                        }
                    );
                    expect(event.getResponse().getStatusCode()).toBe(200);
                    expect(event.getResponse().getData()).toHaveKey("access_token");
                });

                it("Overwrites the password of an unverified account", () => {
                    postRegister();
                    var before = getUserRecord(testEmail);

                    setup();
                    var event = postRegister(password = "DifferentPassword456!");

                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(200);
                    expect(response.getMessages()[1]).toBe("Check your email for a verification code.");
                    expect(response.getHasData()).toBeFalse();

                    var after = getUserRecord(testEmail);
                    expect(after.id).toBe(before.id);
                    expect(after.password).notToBe(before.password);
                    expect(after.verified).toBeFalse();
                });

                it("Verifies an unverified account only with the latest password after re-registering", () => {
                    postRegister();

                    setup();
                    postRegister(password = "DifferentPassword456!");
                    var plainCode = seedCode(testEmail);

                    // Original password no longer works
                    setup();
                    var oldEvent = postVerify(code = plainCode);
                    expect(oldEvent.getResponse().getStatusCode()).toBe(400);
                    expect(oldEvent.getResponse().getMessages()[1]).toBe("Invalid or expired verification code.");

                    // Latest password does
                    setup();
                    var newEvent = postVerify(password = "DifferentPassword456!", code = plainCode);
                    expect(newEvent.getResponse().getStatusCode()).toBe(200);
                    expect(newEvent.getResponse().getData()).toHaveKey("access_token");
                });

                it("Does not send a new code when re-registering an unverified email within the cooldown", () => {
                    postRegister();
                    var before = getUserRecord(testEmail);

                    setup();
                    postRegister(password = "DifferentPassword456!");

                    var after = getUserRecord(testEmail);
                    expect(after.verificationcode).toBe(before.verificationcode);
                });

                it("Sends a new code when re-registering an unverified email after the cooldown", () => {
                    postRegister();
                    backdateSentDate(testEmail);
                    var before = getUserRecord(testEmail);

                    setup();
                    postRegister(password = "DifferentPassword456!");

                    var after = getUserRecord(testEmail);
                    expect(after.verificationcode).notToBe(before.verificationcode);
                    expect(after.verificationsentdate).toBeGT(before.verificationsentdate);
                });
            });

            describe("POST /verify - invalid inputs", () => {
                beforeEach(() => {
                    postRegister();
                    plainCode = seedCode(testEmail);
                    setup();
                });

                it("Returns 400 when the email is missing", () => {
                    var event = post(
                        route  = "/api/v1/verify",
                        params = {password: testPassword, verificationCode: plainCode}
                    );
                    expect(event.getResponse().getStatusCode()).toBe(400);
                    expect(event.getResponse().getError()).toBeTrue();
                    expect(getUserRecord(testEmail).verified).toBeFalse();
                });

                it("Returns 400 when the password is missing", () => {
                    var event = post(route = "/api/v1/verify", params = {email: testEmail, verificationCode: plainCode});
                    expect(event.getResponse().getStatusCode()).toBe(400);
                    expect(event.getResponse().getError()).toBeTrue();
                    expect(getUserRecord(testEmail).verified).toBeFalse();
                });

                it("Returns 400 with an empty code", () => {
                    var event = postVerify(code = "");
                    expect(event.getResponse().getStatusCode()).toBe(400);
                    expect(event.getResponse().getError()).toBeTrue();
                });

                it("Returns 400 with a code that is not 8 characters", () => {
                    var event = postVerify(code = "ABC234");
                    expect(event.getResponse().getStatusCode()).toBe(400);
                    expect(event.getResponse().getError()).toBeTrue();
                });
            });

            describe("POST /verify - invalid verification", () => {
                beforeEach(() => {
                    postRegister();
                    plainCode = seedCode(testEmail);
                    setup();
                });

                it("Returns 400 with a wrong code", () => {
                    var event    = postVerify(code = "WRNGCD23");
                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(400);
                    expect(response.getError()).toBeTrue();
                    expect(response.getMessages()[1]).toBe("Invalid or expired verification code.");
                    expect(response.getHasData()).toBeFalse();
                    expect(getUserRecord(testEmail).verified).toBeFalse();
                });

                it("Returns the same 400 with the right code but a wrong password", () => {
                    var event    = postVerify(password = "WrongPassword999!", code = plainCode);
                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(400);
                    expect(response.getError()).toBeTrue();
                    expect(response.getMessages()[1]).toBe("Invalid or expired verification code.");
                    expect(response.getHasData()).toBeFalse();

                    var record = getUserRecord(testEmail);
                    expect(record.verified).toBeFalse();
                    expect(record.security_level).toBe(0);
                });

                it("Returns the same 400 for an email with no account", () => {
                    var event    = postVerify(email = "nobody_#createUUID()#@example.com", code = plainCode);
                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(400);
                    expect(response.getError()).toBeTrue();
                    expect(response.getMessages()[1]).toBe("Invalid or expired verification code.");
                    expect(response.getHasData()).toBeFalse();
                });

                it("Returns 400 when the code has expired", () => {
                    var verificationLifespan = application.cbController.getSetting("verificationLifespan");
                    backdateSentDate(testEmail, verificationLifespan + 5);

                    var event    = postVerify(code = plainCode);
                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(400);
                    expect(response.getError()).toBeTrue();
                    expect(response.getMessages()[1]).toBe("Invalid or expired verification code.");
                    expect(getUserRecord(testEmail).verified).toBeFalse();
                });
            });

            describe("POST /verify - already verified account", () => {
                it("Returns 400 with an 'already verified' message when the password is right", () => {
                    postRegister();
                    var plainCode = seedCode(testEmail);
                    forceVerify(testEmail);

                    setup();
                    var response = postVerify(code = plainCode).getResponse();
                    expect(response.getStatusCode()).toBe(400);
                    expect(response.getError()).toBeTrue();
                    expect(response.getMessages()[1]).toBe("Account already verified. Please log in.");
                    expect(response.getHasData()).toBeFalse();
                });

                it("Returns the generic invalid code message when the password is wrong", () => {
                    postRegister();
                    var plainCode = seedCode(testEmail);
                    forceVerify(testEmail);

                    setup();
                    var response = postVerify(password = "WrongPassword999!", code = plainCode).getResponse();
                    expect(response.getStatusCode()).toBe(400);
                    expect(response.getMessages()[1]).toBe("Invalid or expired verification code.");
                });
            });

            describe("POST /verify - success", () => {
                beforeEach(() => {
                    postRegister();
                    storeTestUserId(testEmail);
                    plainCode = seedCode(testEmail);
                    setup();
                });

                it("Returns 200 with a new access_token without needing a token", () => {
                    var event    = postVerify(code = plainCode);
                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(200);
                    expect(response.getError()).toBeFalse();
                    expect(response.getData()).toHaveKey("access_token");
                    expect(response.getData().access_token).toBeString().notToBeEmpty();

                    var payload = jwtService.decode(response.getData().access_token);
                    expect(payload.sub).toBe(testUserId);
                });

                it("Accepts the code in lowercase", () => {
                    var event    = postVerify(code = lCase(plainCode));
                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(200);
                    expect(response.getData()).toHaveKey("access_token");
                    expect(getUserRecord(testEmail).verified).toBeTrue();
                });

                it("Accepts the email in a different case", () => {
                    var event = postVerify(email = uCase(testEmail), code = plainCode);
                    expect(event.getResponse().getStatusCode()).toBe(200);
                });

                it("Marks the user verified with security_level 10 (USER) and clears the code", () => {
                    postVerify(code = plainCode);

                    var record = getUserRecord(testEmail);
                    expect(record.verified).toBeTrue();
                    expect(record.security_level).toBe(10);
                    expect(record.hascode).toBeFalse();
                });

                it("Does not accept the same code again after verifying", () => {
                    var first = postVerify(code = plainCode);
                    expect(first.getResponse().getStatusCode()).toBe(200);

                    setup();
                    var second   = postVerify(code = plainCode);
                    var response = second.getResponse();
                    expect(response.getStatusCode()).toBe(400);
                    expect(response.getHasData()).toBeFalse();

                    // Even if the account were unverified again the cleared code can not be used
                    queryExecute(
                        "UPDATE users SET verified = false, security_level = 0 WHERE email = :email",
                        {email: {value: lCase(testEmail), cfsqltype: "varchar"}}
                    );
                    getInstance("cachebox:coldboxStorage").clearByKeySnippet(keySnippet = "user_#testUserId#");

                    setup();
                    var third = postVerify(code = plainCode);
                    expect(third.getResponse().getStatusCode()).toBe(400);
                    expect(third.getResponse().getMessages()[1]).toBe("Invalid or expired verification code.");
                    expect(getUserRecord(testEmail).verified).toBeFalse();
                });

                it("Grants access to User-secured routes with the returned token", () => {
                    var verifyEvent   = postVerify(code = plainCode);
                    var verifiedToken = verifyEvent.getResponse().getData().access_token;

                    setup();
                    var profileEvent = get(route = "/api/v1/me", headers = {"x-auth-token": verifiedToken});
                    expect(profileEvent.getResponse().getStatusCode()).toBe(200);
                });

                it("Allows access to /csrf with the returned token", () => {
                    var verifyEvent   = postVerify(code = plainCode);
                    var verifiedToken = verifyEvent.getResponse().getData().access_token;

                    setup();
                    var csrfEvent = get(route = "/api/v1/csrf", headers = {"x-auth-token": verifiedToken});
                    var response  = csrfEvent.getResponse();
                    expect(response.getStatusCode()).toBe(200);
                    expect(response.getData()).toHaveKey("csrf_token");
                });

                it("Can log in normally after verifying", () => {
                    postVerify(code = plainCode);

                    setup();
                    var event = post(
                        route  = "/api/v1/login",
                        params = {
                            email     : testEmail,
                            password  : testPassword,
                            rememberMe: false
                        }
                    );
                    expect(event.getResponse().getStatusCode()).toBe(200);
                    expect(event.getResponse().getData()).toHaveKey("access_token");
                });
            });

            describe("POST /verify - rate limiting", () => {
                beforeEach(() => {
                    postRegister();
                    plainCode = seedCode(testEmail);
                    enableRateLimiter();
                    setup();
                });

                afterEach(() => {
                    disableRateLimiter();
                });

                it("Returns 429 after too many attempts for one email", () => {
                    // The tightest per-email rule trips first
                    var emailLimit = 0;
                    for(var rule in application.cbController.getSetting("rateLimits")["auth.verify"]) {
                        if(rule.by == "email" && (emailLimit == 0 || rule.limit < emailLimit)) {
                            emailLimit = rule.limit;
                        }
                    }
                    expect(emailLimit).toBeGT(0);

                    for(var i = 1; i <= emailLimit; i++) {
                        setup();
                        var attempt = postVerify(code = "WRNGCD23");
                        expect(attempt.getResponse().getStatusCode()).toBe(400);
                    }

                    // Even the right code is now rate limited
                    setup();
                    var event    = postVerify(code = plainCode);
                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(429);
                    expect(response.getMessages()[1]).toBe("Too many attempts. Please try again later.");
                    expect(getUserRecord(testEmail).verified).toBeFalse();
                });
            });

            describe("POST /resendverificationcode", () => {
                beforeEach(() => {
                    postRegister();
                    setup();
                });

                it("Returns 400 when the email or password is missing", () => {
                    var event = post(route = "/api/v1/resendverificationcode", params = {email: testEmail});
                    expect(event.getResponse().getStatusCode()).toBe(400);

                    setup();
                    event = post(route = "/api/v1/resendverificationcode", params = {password: testPassword});
                    expect(event.getResponse().getStatusCode()).toBe(400);
                });

                it("Returns 405 when using GET", () => {
                    var event = get(
                        route  = "/api/v1/resendverificationcode",
                        params = {email: testEmail, password: testPassword}
                    );
                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(405);
                    expect(response.getError()).toBeTrue();
                    expect(response.getMessages()[1]).toInclude("InvalidHTTPMethod Execution");
                });

                it("Returns 429 with the right password during the cooldown", () => {
                    var before = getUserRecord(testEmail);

                    var event    = postResend();
                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(429);
                    expect(response.getError()).toBeTrue();
                    expect(response.getMessages()[1]).toInclude("wait");

                    // No new code was sent
                    expect(getUserRecord(testEmail).verificationcode).toBe(before.verificationcode);
                });

                it("Returns the generic 200 with a wrong password during the cooldown", () => {
                    var before = getUserRecord(testEmail);

                    var event    = postResend(password = "WrongPassword999!");
                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(200);
                    expect(response.getError()).toBeFalse();
                    expect(response.getMessages()[1]).toBe("If your account needs verifying, a new code has been sent.");

                    expect(getUserRecord(testEmail).verificationcode).toBe(before.verificationcode);
                });

                it("Returns the generic 200 for an email with no account", () => {
                    var event    = postResend(email = "nobody_#createUUID()#@example.com");
                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(200);
                    expect(response.getError()).toBeFalse();
                    expect(response.getMessages()[1]).toBe("If your account needs verifying, a new code has been sent.");
                });

                it("Returns 200 and sends a new code when the cooldown period has passed", () => {
                    backdateSentDate(testEmail);
                    var before = getUserRecord(testEmail);

                    var event    = postResend();
                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(200);
                    expect(response.getMessages()[1]).toBe("If your account needs verifying, a new code has been sent.");

                    var after = getUserRecord(testEmail);
                    expect(after.verificationcode).notToBe(before.verificationcode);
                    expect(after.verificationsentdate).toBeGT(before.verificationsentdate);
                });

                it("Does not send a new code with a wrong password after the cooldown", () => {
                    backdateSentDate(testEmail);
                    var before = getUserRecord(testEmail);

                    var event = postResend(password = "WrongPassword999!");
                    expect(event.getResponse().getStatusCode()).toBe(200);

                    var after = getUserRecord(testEmail);
                    expect(after.verificationcode).toBe(before.verificationcode);
                    expect(after.verificationsentdate).toBe(before.verificationsentdate);
                });

                it("Does not send a code to a verified account", () => {
                    var plainCode = seedCode(testEmail);
                    setup();
                    postVerify(code = plainCode);
                    backdateSentDate(testEmail);
                    var before = getUserRecord(testEmail);

                    setup();
                    var event = postResend();
                    expect(event.getResponse().getStatusCode()).toBe(200);
                    expect(event.getResponse().getMessages()[1]).toBe("If your account needs verifying, a new code has been sent.");

                    var after = getUserRecord(testEmail);
                    expect(after.hascode).toBeFalse();
                    expect(after.verificationsentdate).toBe(before.verificationsentdate);
                });
            });

            describe("POST /resendverificationcode - rate limiting", () => {
                beforeEach(() => {
                    enableRateLimiter();
                });

                afterEach(() => {
                    disableRateLimiter();
                });

                it("Returns 429 after too many requests for one email", () => {
                    var emailRule = application.cbController.getSetting("rateLimits")["auth.resendverificationcode"].filter((rule) => rule.by == "email")[
                        1
                    ];
                    var unknownEmail = "nobody_#createUUID()#@example.com";

                    for(var i = 1; i <= emailRule.limit; i++) {
                        setup();
                        var attempt = postResend(email = unknownEmail);
                        expect(attempt.getResponse().getStatusCode()).toBe(200);
                    }

                    setup();
                    var response = postResend(email = unknownEmail).getResponse();
                    expect(response.getStatusCode()).toBe(429);
                    expect(response.getMessages()[1]).toBe("Too many attempts. Please try again later.");
                });
            });

            describe("POST /login - during registration", () => {
                beforeEach(() => {
                    postRegister();
                    setup();
                });

                it("Returns 403 without an access_token when credentials are valid but account is unverified", () => {
                    var event = post(
                        route  = "/api/v1/login",
                        params = {
                            email     : testEmail,
                            password  : testPassword,
                            rememberMe: false
                        }
                    );
                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(403);
                    expect(response.getMessages()[1]).toInclude("Please verify your email");
                    expect(response.getHasData()).toBeFalse();
                });

                it("Returns 401 when the password is wrong", () => {
                    var event = post(
                        route  = "/api/v1/login",
                        params = {
                            email     : testEmail,
                            password  : "WrongPassword!",
                            rememberMe: false
                        }
                    );
                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(401);
                    expect(response.getError()).toBeTrue();
                });
            });
        });
    }

    /**
     * POST /register with the test user's details, overriding any passed
     */
    private any function postRegister(
        string email            = testEmail,
        string password         = testPassword,
        numeric salary          = testSalary,
        numeric monthlyTakeHome = testTakeHome
    ) {
        return post(
            route  = "/api/v1/register",
            params = {
                email          : arguments.email,
                password       : arguments.password,
                salary         : arguments.salary,
                monthlyTakeHome: arguments.monthlyTakeHome
            }
        );
    }

    /**
     * POST /verify with the test user's email/password, overriding any passed
     */
    private any function postVerify(
        string email    = testEmail,
        string password = testPassword,
        required string code
    ) {
        return post(
            route  = "/api/v1/verify",
            params = {
                email           : arguments.email,
                password        : arguments.password,
                verificationCode: arguments.code
            }
        );
    }

    /**
     * POST /resendverificationcode with the test user's email/password, overriding any passed
     */
    private any function postResend(string email = testEmail, string password = testPassword) {
        return post(
            route  = "/api/v1/resendverificationcode",
            params = {email: arguments.email, password: arguments.password}
        );
    }

    /**
     * Seed a known plaintext code directly, bypassing the email
     * Returns the plaintext code
     */
    private string function seedCode(required string email, string plainCode = "SEED2345") {
        var bcryptService = getInstance("@BCrypt");
        var hashedCode    = bcryptService.hashPassword(password = plainCode, salt = bcryptService.generateSalt());
        queryExecute(
            "UPDATE users SET verificationcode = :code, verificationsentdate = :now WHERE email = :email",
            {
                code : {value: hashedCode, cfsqltype: "varchar"},
                now  : {value: now(), cfsqltype: "timestamp"},
                email: {value: lCase(email), cfsqltype: "varchar"}
            }
        );
        return plainCode;
    }

    /**
     * Move verificationsentdate into the past (beyond the resend cooldown by default)
     */
    private void function backdateSentDate(required string email, numeric minutes = 9999) {
        queryExecute(
            "UPDATE users SET verificationsentdate = :oldDate WHERE email = :email",
            {
                oldDate: {value: dateAdd("n", -minutes, now()), cfsqltype: "timestamp"},
                email  : {value: lCase(email), cfsqltype: "varchar"}
            }
        );
    }

    /**
     * Mark the user verified directly in the database
     */
    private void function forceVerify(required string email) {
        queryExecute(
            "UPDATE users SET verified = true, security_level = 10 WHERE email = :email",
            {email: {value: lCase(email), cfsqltype: "varchar"}}
        );
        getInstance("cachebox:coldboxStorage").clearByKeySnippet(keySnippet = "user_");
    }

    /**
     * Read the user's row straight from the database, empty struct if there is none
     */
    private struct function getUserRecord(required string email) {
        var records = queryExecute(
            "SELECT id, email, password, verified, security_level, salary, monthlytakehome,
                verificationcode, verificationsentdate,
                verificationcode IS NOT NULL AS hascode,
                verificationsentdate IS NOT NULL AS hassentdate
            FROM users WHERE email = :email",
            {email: {value: lCase(email), cfsqltype: "varchar"}},
            {returnType: "array"}
        );
        return records.len() ? records[1] : {};
    }

    private void function storeTestUserId(required string email) {
        var result = queryExecute(
            "SELECT id FROM users WHERE email = :email LIMIT 1",
            {email: {value: lCase(arguments.email), cfsqltype: "varchar"}}
        );

        if(result.recordCount()) {
            testUserId = result.id;
        }
    }

    /**
     * Turn the rate limiter on with a clean slate
     */
    private void function enableRateLimiter() {
        var rateLimiter = application.cbController.getInterceptorService().getInterceptor("rateLimiterInterceptor");
        rateLimiter.injectPropertyMixin(propertyName = "useRateLimiter", propertyValue = true);

        // Clear the rate limit cache
        getInstance("cachebox:rateStorage").clearAll();
    }

    /**
     * Restore rate limiter to off so other tests are unaffected
     */
    private void function disableRateLimiter() {
        var rateLimiter = application.cbController.getInterceptorService().getInterceptor("rateLimiterInterceptor");
        rateLimiter.injectPropertyMixin(propertyName = "useRateLimiter", propertyValue = false);
    }

}
