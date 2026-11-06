component extends="coldbox.system.testing.BaseInterceptorTest" interceptor="interceptors.ratelimiter" {

    function beforeAll() {
        super.beforeAll();

        // Init interceptor
        super.setup();

        // Mock interceptor dependencies
        mockSecurityService  = createEmptyMock(className = "models.services.security");
        mockRateLimitService = createEmptyMock(className = "models.services.ratelimit");
        mockMetricsService   = createEmptyMock(className = "models.services.metrics");
        mockResponse         = createEmptyMock(className = "models.objects.apiresponseobj");
        mockJwtService       = createStub();
    }

    function afterAll() {
        super.afterAll();
    }

    /**
     * Run an interception point on the interceptor with the shared mocks
     */
    private function announce(string point = "preProcess") {
        invoke(
            interceptor,
            point,
            {
                event : mockRequestContext,
                data  : {},
                buffer: "",
                rc    : rc,
                prc   : prc
            }
        );
    }

    /**
     * Configure the rules the interceptor sees
     */
    private function withRules(required struct rules) {
        interceptor.$property(propertyName = "rateLimits", mock = rules);
    }

    /**
     * Mock an authenticated user
     */
    private function mockUser(numeric id = 7) {
        return createStub().$("getId", id).$("isLoaded", true);
    }

    function run() {
        describe("RateLimiter Interceptor", () => {
            beforeEach(() => {
                setup();

                // Reset mocks before each test
                mockSecurityService.$reset();
                mockSecurityService.$("getRequestIP", "192.168.1.1");

                mockRateLimitService.$reset();
                mockRateLimitService.$("buildKey", "mock:key");
                mockRateLimitService.$("hit", true);
                mockRateLimitService.$("clear");
                mockRateLimitService.$("release");

                mockMetricsService.$reset();
                mockMetricsService.$("recordRateLimitBlock");

                mockResponse.$reset();
                mockResponse.$("setErrorMessage", mockResponse);
                mockResponse.$("setStatusCode", mockResponse);
                mockResponse.$("getStatusCode", 200);

                mockJwtService.$reset();
                mockJwtService.$(
                    method         = "getUser",
                    throwException = true,
                    throwType      = "TokenInvalidException"
                );

                // Inject dependencies
                interceptor.$property(propertyName = "securityService", mock = mockSecurityService);
                interceptor.$property(propertyName = "rateLimitService", mock = mockRateLimitService);
                interceptor.$property(propertyName = "metricsService", mock = mockMetricsService);
                interceptor.$property(propertyName = "jwtService", mock = mockJwtService);
                interceptor.$property(propertyName = "useRateLimiter", mock = true);
                withRules({"api.login": [{by: "ip", limit: 5, window: 15}]});

                // Mock event and data objects
                mockRequestContext = createEmptyMock("coldbox.system.web.context.RequestContext");
                mockRequestContext.$("getCurrentEvent", "api.login");
                mockRequestContext.$("getResponse", mockResponse);
                mockRequestContext.$("renderData", mockRequestContext);
                mockRequestContext.$("noExecution", mockRequestContext);
                mockRequestContext.$("isNoExecution", false);

                rc  = {};
                prc = {};
            });

            it("Can be created", () => {
                expect(interceptor).toBeComponent();
            });

            describe("configure", () => {
                it("Should accept valid rules", () => {
                    withRules({
                        "api.login": [
                            {by: "ip", limit: 20, window: 15},
                            {
                                by            : "ip,email",
                                limit         : 5,
                                window        : 15,
                                resetOnSuccess: true
                            }
                        ],
                        "expense.export": [
                            {
                                by             : "user",
                                limit          : 1,
                                window         : 1,
                                refundOnFailure: true
                            }
                        ]
                    });

                    expect(() => interceptor.configure()).notToThrow();
                });

                it("Should accept the real app rules", () => {
                    withRules(application.cbController.getSetting("rateLimits"));

                    expect(() => interceptor.configure()).notToThrow();
                });

                it("Should reject an event name that is not lowercase", () => {
                    withRules({"API.Login": [{by: "ip", limit: 5, window: 15}]});

                    expect(() => interceptor.configure()).toThrow(type = "RateLimitConfigError", regex = "lowercase");
                });

                it("Should reject an event without rules", () => {
                    withRules({"api.login": []});

                    expect(() => interceptor.configure()).toThrow(
                        type  = "RateLimitConfigError",
                        regex = "non empty array"
                    );
                });

                it("Should reject a rule without by", () => {
                    withRules({"api.login": [{limit: 5, window: 15}]});

                    expect(() => interceptor.configure()).toThrow(
                        type  = "RateLimitConfigError",
                        regex = "by is required"
                    );
                });

                it("Should reject an unknown by field", () => {
                    withRules({"api.login": [{by: "ip,emial", limit: 5, window: 15}]});

                    expect(() => interceptor.configure()).toThrow(type = "RateLimitConfigError", regex = "emial");
                });

                it("Should reject a missing or invalid limit and window", () => {
                    for(
                        var rule in [
                            {by: "ip", window: 15},
                            {by: "ip", limit: 0, window: 15},
                            {by: "ip", limit: "five", window: 15},
                            {by: "ip", limit: 5},
                            {by: "ip", limit: 5, window: -1}
                        ]
                    ) {
                        withRules({"api.login": [rule]});

                        expect(() => interceptor.configure()).toThrow(
                            type  = "RateLimitConfigError",
                            regex = "positive integer"
                        );
                    }
                });

                it("Should reject a non boolean flag", () => {
                    withRules({
                        "api.login": [
                            {
                                by            : "ip",
                                limit         : 5,
                                window        : 15,
                                resetOnSuccess: "sometimes"
                            }
                        ]
                    });

                    expect(() => interceptor.configure()).toThrow(
                        type  = "RateLimitConfigError",
                        regex = "resetOnSuccess"
                    );
                });
            });

            describe("preProcess", () => {
                it("Should skip a request an earlier interceptor already rejected", () => {
                    mockRequestContext.$("isNoExecution", true);

                    announce();

                    expect(mockRequestContext.$never("getCurrentEvent")).toBeTrue();
                    expect(mockRateLimitService.$never("hit")).toBeTrue();
                    expect(mockRequestContext.$never("renderData")).toBeTrue();
                });

                it("Should skip rate limiting when useRateLimiter is false", () => {
                    interceptor.$property(propertyName = "useRateLimiter", mock = false);

                    announce();

                    // Returns before even looking at the event
                    expect(mockRequestContext.$never("getCurrentEvent")).toBeTrue();
                    expect(mockRateLimitService.$never("hit")).toBeTrue();
                });

                it("Should skip rate limiting when current event has no rate limit configured", () => {
                    mockRequestContext.$("getCurrentEvent", "api.other");

                    announce();

                    expect(mockSecurityService.$never("getRequestIP")).toBeTrue();
                    expect(mockRateLimitService.$never("buildKey")).toBeTrue();
                    expect(mockRateLimitService.$never("hit")).toBeTrue();
                });

                it("Should handle case insensitive event names", () => {
                    mockRequestContext.$("getCurrentEvent", "API.LOGIN");

                    announce();

                    expect(mockRateLimitService.$once("hit")).toBeTrue();
                    expect(mockRateLimitService.$callLog().buildKey[1].currentEvent).toBe("api.login");
                });

                it("Should resolve the ip from the security service", () => {
                    announce();

                    expect(mockSecurityService.$once("getRequestIP")).toBeTrue();
                    expect(mockRateLimitService.$callLog().buildKey[1].ip).toBe("192.168.1.1");
                });

                it("Should build the key from the rule fields, the ip and the rc", () => {
                    withRules({"api.login": [{by: "ip,email", limit: 5, window: 15}]});
                    rc.email = "test@example.com";

                    announce();

                    var buildKeyCall = mockRateLimitService.$callLog().buildKey[1];
                    expect(buildKeyCall.currentEvent).toBe("api.login");
                    expect(buildKeyCall.by).toBe(["ip", "email"]);
                    expect(buildKeyCall.ip).toBe("192.168.1.1");
                    expect(buildKeyCall.context.email).toBe("test@example.com");
                });

                it("Should not let an rc ip field override the real ip", () => {
                    rc.ip = "10.0.0.1";

                    announce();

                    expect(mockRateLimitService.$callLog().buildKey[1].ip).toBe("192.168.1.1");
                    // rc itself is left untouched
                    expect(rc.ip).toBe("10.0.0.1");
                });

                it("Should hit the counter with the rules limit and window", () => {
                    announce();

                    var hitCall = mockRateLimitService.$callLog().hit[1];
                    expect(hitCall.key).toBe("mock:key");
                    expect(hitCall.limit).toBe(5);
                    expect(hitCall.window).toBe(15);
                });

                it("Should skip a rule when its key cannot be built", () => {
                    mockRateLimitService.$("buildKey", "");

                    announce();

                    expect(mockRateLimitService.$once("buildKey")).toBeTrue();
                    expect(mockRateLimitService.$never("hit")).toBeTrue();
                    expect(mockRequestContext.$never("noExecution")).toBeTrue();
                });

                it("Should count every rule configured for the event", () => {
                    withRules({
                        "api.login": [
                            {by: "ip", limit: 20, window: 15},
                            {by: "ip,email", limit: 5, window: 15},
                            {by: "email", limit: 10, window: 30}
                        ]
                    });
                    mockRateLimitService.$("buildKey").$results("key:ip", "key:ip+email", "key:email");

                    announce();

                    var hitCalls = mockRateLimitService.$callLog().hit;
                    expect(hitCalls.len()).toBe(3);
                    expect(hitCalls.map((call) => call.key)).toBe(["key:ip", "key:ip+email", "key:email"]);
                    expect(hitCalls.map((call) => call.limit)).toBe([20, 5, 10]);
                    expect(hitCalls.map((call) => call.window)).toBe([15, 15, 30]);
                });

                it("Should allow request when rate limit is not exceeded", () => {
                    announce();

                    expect(mockRateLimitService.$once("hit")).toBeTrue();

                    // We did not stop the current execution
                    expect(mockRequestContext.$never("renderData")).toBeTrue();
                    expect(mockRequestContext.$never("noExecution")).toBeTrue();
                });

                it("Should block request and return 429 when rate limit is exceeded", () => {
                    mockRateLimitService.$("hit", false);

                    announce();

                    // Response object was populated
                    expect(mockResponse.$once("setErrorMessage")).toBeTrue();
                    expect(mockResponse.$callLog().setErrorMessage[1][1]).toBe("Too many attempts. Please try again later.");
                    expect(mockResponse.$once("setStatusCode")).toBeTrue();
                    expect(mockResponse.$callLog().setStatusCode[1][1]).toBe(429);

                    // Rendered the response packet and stopped the handler from running
                    expect(mockRequestContext.$once("renderData")).toBeTrue();
                    var renderDataCall = mockRequestContext.$callLog().renderData[1];
                    expect(renderDataCall.statusCode).toBe(429);
                    expect(renderDataCall.type).toBe("json");
                    expect(renderDataCall.data.error).toBeTrue();
                    expect(renderDataCall.data.messages).toBe(["Too many attempts. Please try again later."]);
                    expect(mockRequestContext.$once("noExecution")).toBeTrue();

                    // Block was recorded for the metrics dashboard
                    expect(mockMetricsService.$once("recordRateLimitBlock")).toBeTrue();
                    expect(mockMetricsService.$callLog().recordRateLimitBlock[1].event).toBe("api.login");
                });

                it("Should not record a block when the request is allowed", () => {
                    announce();

                    expect(mockMetricsService.$never("recordRateLimitBlock")).toBeTrue();
                });

                it("Should block when any one rule is exceeded", () => {
                    withRules({
                        "api.login": [
                            {by: "ip", limit: 20, window: 15},
                            {by: "ip,email", limit: 5, window: 15},
                            {by: "email", limit: 10, window: 30}
                        ]
                    });
                    mockRateLimitService.$("hit").$results(true, false, false);

                    announce();

                    // Every rule is still counted
                    expect(mockRateLimitService.$count("hit")).toBe(3);
                    expect(mockRequestContext.$once("renderData")).toBeTrue();
                    expect(mockRequestContext.$once("noExecution")).toBeTrue();
                });
            });

            describe("user scoped rules", () => {
                beforeEach(() => {
                    withRules({"api.login": [{by: "user", limit: 5, window: 15}]});
                });

                it("Should use the user already in prc", () => {
                    prc.authUser = mockUser(id = 7);

                    announce();

                    expect(mockJwtService.$never("getUser")).toBeTrue();
                    expect(mockRateLimitService.$callLog().buildKey[1].userid).toBe("7");
                });

                it("Should resolve the user from the jwt when prc has no user yet", () => {
                    mockJwtService.$("getUser", mockUser(id = 8));

                    announce();

                    expect(mockJwtService.$once("getUser")).toBeTrue();
                    expect(mockRateLimitService.$callLog().buildKey[1].userid).toBe("8");
                });

                it("Should pass an empty user when the jwt is invalid", () => {
                    announce();

                    expect(mockJwtService.$once("getUser")).toBeTrue();
                    expect(mockRateLimitService.$callLog().buildKey[1].userid).toBe("");
                });

                it("Should not let an rc user field override the authenticated user", () => {
                    prc.authUser = mockUser(id = 7);
                    rc.user      = 99;

                    announce();

                    expect(mockRateLimitService.$callLog().buildKey[1].userid).toBe("7");
                });

                it("Should not resolve the user when no rule is scoped by user", () => {
                    withRules({"api.login": [{by: "ip", limit: 5, window: 15}]});

                    announce();

                    expect(mockJwtService.$never("getUser")).toBeTrue();
                    expect(mockRateLimitService.$callLog().buildKey[1].userid).toBe("");
                });
            });

            describe("postProcess", () => {
                describe("resetOnSuccess", () => {
                    beforeEach(() => {
                        withRules({
                            "api.login": [
                                {by: "ip", limit: 20, window: 15},
                                {
                                    by            : "ip,email",
                                    limit         : 5,
                                    window        : 15,
                                    resetOnSuccess: true
                                }
                            ]
                        });
                        rc.email = "test@example.com";

                        // preProcess resolves the current event before postProcess runs
                        prc.currEvent = "api.login";
                    });

                    it("Should clear only the resetOnSuccess rules when the request succeeds", () => {
                        mockRateLimitService.$("buildKey", "key:ip+email");

                        announce("postProcess");

                        // Key only built for the resetOnSuccess rule
                        expect(mockRateLimitService.$once("buildKey")).toBeTrue();
                        expect(mockRateLimitService.$callLog().buildKey[1].by).toBe(["ip", "email"]);

                        expect(mockRateLimitService.$once("clear")).toBeTrue();
                        expect(mockRateLimitService.$callLog().clear[1].key).toBe("key:ip+email");

                        // Never counts a hit
                        expect(mockRateLimitService.$never("hit")).toBeTrue();
                    });

                    it("Should clear on any 2xx status", () => {
                        mockResponse.$("getStatusCode", 204);

                        announce("postProcess");

                        expect(mockRateLimitService.$once("clear")).toBeTrue();
                    });

                    it("Should not clear when the request failed", () => {
                        for(var statusCode in [400, 401, 404, 429, 500]) {
                            mockResponse.$("getStatusCode", statusCode);

                            announce("postProcess");
                        }

                        expect(mockRateLimitService.$never("clear")).toBeTrue();
                    });

                    it("Should not clear when the key cannot be built", () => {
                        mockRateLimitService.$("buildKey", "");

                        announce("postProcess");

                        expect(mockRateLimitService.$never("clear")).toBeTrue();
                    });

                    it("Should skip when no rule for the event is resetOnSuccess", () => {
                        withRules({"api.login": [{by: "ip", limit: 20, window: 15}]});

                        announce("postProcess");

                        expect(mockResponse.$never("getStatusCode")).toBeTrue();
                        expect(mockRateLimitService.$never("clear")).toBeTrue();
                    });

                    it("Should skip when useRateLimiter is false", () => {
                        interceptor.$property(propertyName = "useRateLimiter", mock = false);
                        // preProcess returns before resolving the current event when disabled
                        prc.delete("currEvent");

                        announce("postProcess");

                        expect(mockRateLimitService.$never("buildKey")).toBeTrue();
                        expect(mockRateLimitService.$never("clear")).toBeTrue();
                    });
                });

                describe("refundOnFailure", () => {
                    beforeEach(() => {
                        mockRequestContext.$("getCurrentEvent", "expense.exportreceipts");
                        prc.authUser = mockUser(id = 7);
                        withRules({
                            "expense.exportreceipts": [
                                {
                                    by             : "user",
                                    limit          : 1,
                                    window         : 3,
                                    refundOnFailure: true
                                }
                            ]
                        });
                    });

                    it("Should only track keys for rules with refundOnFailure", () => {
                        withRules({"expense.exportreceipts": [{by: "user", limit: 1, window: 3}]});

                        announce();

                        expect(prc.rateLimitRefunds).toBeEmpty();
                    });

                    it("Should refund the hit when the request failed", () => {
                        for(var statusCode in [400, 404, 500]) {
                            prc = {authUser: mockUser(id = 7)};
                            mockRateLimitService.$reset();
                            mockRateLimitService.$("buildKey", "mock:key");
                            mockRateLimitService.$("hit", true);
                            mockRateLimitService.$("release");
                            mockResponse.$("getStatusCode", statusCode);

                            announce();
                            expect(prc.rateLimitRefunds).toBe(["mock:key"]);

                            announce("postProcess");

                            expect(mockRateLimitService.$once("release")).toBeTrue();
                            expect(mockRateLimitService.$callLog().release[1].key).toBe("mock:key");
                        }
                    });

                    it("Should keep the hit when the request succeeded", () => {
                        announce();
                        announce("postProcess");

                        expect(mockRateLimitService.$never("release")).toBeTrue();
                    });

                    it("Should not refund a rule that blocked the request", () => {
                        mockRateLimitService.$("hit", false);
                        mockResponse.$("getStatusCode", 429);

                        announce();
                        announce("postProcess");

                        expect(prc.rateLimitRefunds).toBeEmpty();
                        expect(mockRateLimitService.$never("release")).toBeTrue();
                    });

                    it("Should refund the rules that counted when another rule blocked the request", () => {
                        withRules({
                            "expense.exportreceipts": [
                                {
                                    by             : "user",
                                    limit          : 1,
                                    window         : 3,
                                    refundOnFailure: true
                                },
                                {by: "ip", limit: 5, window: 3}
                            ]
                        });
                        mockRateLimitService.$("buildKey").$results("key:user", "key:ip");
                        mockRateLimitService.$("hit").$results(true, false);
                        mockResponse.$("getStatusCode", 429);

                        announce();
                        announce("postProcess");

                        expect(mockRateLimitService.$once("release")).toBeTrue();
                        expect(mockRateLimitService.$callLog().release[1].key).toBe("key:user");
                    });
                });
            });
        });
    }

}
