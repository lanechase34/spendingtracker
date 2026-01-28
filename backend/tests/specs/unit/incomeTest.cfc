component extends="coldbox.system.testing.BaseTestCase" {

    function beforeAll() {
        super.beforeAll();

        mockUser = getInstance('tests.resources.mockuser');
    }

    function afterAll() {
        super.afterAll();
    }

    function run() {
        describe('services.income', () => {
            beforeEach(() => {
                setup();

                // Create real instance and prepare for mocking
                var incomeServiceObj = new models.services.income();
                incomeService        = prepareMock(object = incomeServiceObj);

                // Mock dependencies
                mockCacheStorage = createEmptyMock(className = 'coldbox.system.cache.providers.CacheBoxProvider');
                mockQueryBuilder = createStub();

                // Actual security service
                securityService = getInstance('services.security');
                incomeService.setSecurityService(securityService);

                // Reset mocks before each test
                incomeService.$reset();
                mockCacheStorage.$reset();
                mockQueryBuilder.$reset();

                // Default stub methods
                mockCacheStorage.$('get').$results();
                mockCacheStorage.$('set').$results();
                mockCacheStorage.$('clearByKeySnippet').$results();

                // Inject mocked dependencies
                incomeService.$property(propertyName = 'cacheStorage', mock = mockCacheStorage);
                incomeService.$property(propertyName = 'q', mock = mockQueryBuilder);
            });

            describe('getTotal()', () => {
                beforeEach(() => {
                    mockCacheStorage.$reset();
                });

                it('Should build the correct cache key based on userid, startdate, and enddate', () => {
                    var startDate = createDate(2026, 1, 1);
                    var endDate   = createDate(2026, 3, 31);
                    var user      = mockUser.make();

                    // Dates are formatted to START of month
                    var expectedCacheKey = 'userid=#user.getId()#|income.getTotal|startDate={ts ''2026-01-01 00:00:00''}|endDate={ts ''2026-03-01 00:00:00''}';

                    var result = incomeService.getTotal(
                        startDate = startDate,
                        endDate   = endDate,
                        userid    = user.getId()
                    );

                    // Expect both cache get and set to be called with cachekey
                    // Both are called with cachekey as the first argument
                    expect(mockCacheStorage.$once('get')).toBeTrue();
                    expect(mockCacheStorage.$callLog().get[1][1]).toBe(expectedCacheKey);

                    expect(mockCacheStorage.$once('set')).toBeTrue();
                    expect(mockCacheStorage.$callLog().set[1][1]).toBe(expectedCacheKey);
                    mockUser.delete(user);
                });

                it('Should return cached data when available', () => {
                    var cachedData = {pay: 5000, extra: 500};
                    var user       = mockUser.make();

                    // Mock cacheStorage.get with the derived cache key
                    mockCacheStorage
                        .$('get')
                        .$args('userid=#user.getId()#|income.getTotal|startDate={ts ''2026-01-01 00:00:00''}|endDate={ts ''2026-01-01 00:00:00''}')
                        .$results(cachedData);

                    var result = incomeService.getTotal(
                        startDate = createDate(2026, 1, 1),
                        endDate   = createDate(2026, 1, 31),
                        userid    = user.getId()
                    );

                    // Cache hit
                    expect(result).toBe(cachedData);
                    expect(mockCacheStorage.$once('get')).toBeTrue();
                    expect(mockCacheStorage.$never('set')).toBeTrue();
                    mockUser.delete(user);
                });

                it('Should query database and cache result when cache miss', () => {
                    // Create mock user
                    var user = mockUser.make(salary = 6600, monthlyTakeHome = 59);

                    var result = incomeService.getTotal(
                        startDate = now(),
                        endDate   = now(),
                        userid    = user.getId()
                    );

                    expect(result.pay).toBe(59);
                    expect(result.extra).toBe(0);
                    expect(mockCacheStorage.$once('get')).toBeTrue();
                    expect(mockCacheStorage.$once('set')).toBeTrue();

                    // Verify cache key format
                    var cacheArgs = mockCacheStorage.$callLog().set[1];
                    expect(cacheArgs[1]).toInclude('userid=#user.getId()#');
                    expect(cacheArgs[1]).toInclude('income.getTotal');
                    mockUser.delete(user);
                });

                // it('Should handle date range spanning multiple months', () => {
                //     var monthlyTakeHome = 59;

                //     var user = mockUser.make(
                //         salary=6600,
                //         monthlyTakeHome=monthlyTakeHome
                //     );

                //     // Force pay user 3 months out
                //     incomeService.pay(date=dateAdd('m', 1, now()), userid=user.getId(), pay=monthlyTakeHome);
                //     incomeService.pay(date=dateAdd('m', 2, now()), userid=user.getId(), pay=monthlyTakeHome, extra=87);
                //     incomeService.pay(date=dateAdd('m', 3, now()), userid=user.getId(), pay=monthlyTakeHome);

                //     // Will not include these dates
                //     incomeService.pay(date=dateAdd('m', 4, now()), userid=user.getId(), pay=monthlyTakeHome);
                //     incomeService.pay(date=dateAdd('m', -1, now()), userid=user.getId(), pay=monthlyTakeHome);

                //     var result = incomeService.getTotal(
                //         startDate = now(),
                //         endDate   = dateAdd('m', 3, now()),
                //         userid    = user.getId()
                //     );

                //     expect(result.pay).toBe(monthlyTakeHome * 4); // 4 months total
                //     expect(result.extra).toBe(87);
                // });

                // it('Should handle same start and end date', () => {
                //     mockCacheStorage.$('get').$results(javacast('null', ''));

                //     incomeService.$('queryExecute').$results(queryNew('pay,extra', 'numeric,numeric', [[5000, 500]]));

                //     var result = incomeService.getTotal(
                //         startDate = createDate(2026, 1, 1),
                //         endDate   = createDate(2026, 1, 1),
                //         userid    = 12323
                //     );

                //     expect(result.pay).toBe(5000);
                //     expect(result.extra).toBe(500);
                // });
            });

            describe('payMonthly()', () => {
                beforeEach(() => {
                    mockQueryBuilder = createStub();
                    incomeService.$property(propertyName = 'q', mock = mockQueryBuilder);
                });

                it('Should process users without income for current month', () => {
                    var testMonth = createDate(2025, 1, 1);
                    var user1     = mockUser.make();
                    var user2     = mockUser.make();

                    // Mock query builder chain
                    mockQueryBuilder
                        .$('from')
                        .$args('users')
                        .$results(mockQueryBuilder);
                    mockQueryBuilder.$('leftJoin').$results(mockQueryBuilder);
                    mockQueryBuilder
                        .$('whereNull')
                        .$args('income.id')
                        .$results(mockQueryBuilder);
                    mockQueryBuilder.$('andWhere').$results(mockQueryBuilder);
                    mockQueryBuilder.$('select').$results(mockQueryBuilder);
                    mockQueryBuilder
                        .$('get')
                        .$results(
                            queryNew(
                                'userid,monthlyTakeHome',
                                'numeric,varchar',
                                [
                                    [
                                        user1.getId(),
                                        securityService.encryptValue(5000)
                                    ],
                                    [
                                        user2.getId(),
                                        securityService.encryptValue(6000)
                                    ]
                                ]
                            )
                        );

                    // Mock the pay method
                    incomeService.$('pay');

                    incomeService.payMonthly(testMonth);

                    // Verify pay was called for each user
                    var payCallLog = incomeService.$callLog().pay;
                    expect(payCallLog.len()).toBe(2);

                    // This is threaded - we don't know exact order of the call stack, so we must decide
                    // pay() will have been called with decrypted value
                    if(payCallLog[1].userid == user1.getId()) {
                        expect(payCallLog[1].userid).toBe(user1.getId());
                        expect(payCallLog[1].pay).toBe(5000);
                        expect(payCallLog[2].userid).toBe(user2.getId());
                        expect(payCallLog[2].pay).toBe(6000);
                    }
                    else {
                        expect(payCallLog[1].userid).toBe(user2.getId());
                        expect(payCallLog[1].pay).toBe(6000);
                        expect(payCallLog[2].userid).toBe(user1.getId());
                        expect(payCallLog[2].pay).toBe(5000);
                    }
                    mockUser.delete(user1);
                    mockUser.delete(user2);
                });

                it('Should use current month when no month provided', () => {
                    var currentMonth = createDate(year(now()), month(now()), 1);
                    var user         = mockUser.make();

                    mockQueryBuilder.$('from').$results(mockQueryBuilder);
                    mockQueryBuilder.$('leftJoin').$results(mockQueryBuilder);
                    mockQueryBuilder.$('whereNull').$results(mockQueryBuilder);
                    mockQueryBuilder.$('andWhere').$results(mockQueryBuilder);
                    mockQueryBuilder.$('select').$results(mockQueryBuilder);
                    mockQueryBuilder
                        .$('get')
                        .$results(
                            queryNew(
                                'userid,monthlyTakeHome',
                                'numeric,varchar',
                                [[user.getId(), securityService.encryptValue(7000)]]
                            )
                        );

                    incomeService.$('pay');
                    incomeService.payMonthly();

                    // Verify pay was called with the current month
                    var payCallLog = incomeService.$callLog().pay;
                    expect(payCallLog[1].date).toBe(currentMonth);
                    expect(payCallLog[1].userid).toBe(user.getId());
                    expect(payCallLog[1].pay).toBe(7000);
                    mockUser.delete(user);
                });

                it('Should handle empty result set', () => {
                    mockQueryBuilder.$('from').$results(mockQueryBuilder);
                    mockQueryBuilder.$('leftJoin').$results(mockQueryBuilder);
                    mockQueryBuilder.$('whereNull').$results(mockQueryBuilder);
                    mockQueryBuilder.$('andWhere').$results(mockQueryBuilder);
                    mockQueryBuilder.$('select').$results(mockQueryBuilder);
                    mockQueryBuilder.$('get').$results(queryNew('userid,monthlyTakeHome'));

                    incomeService.$('pay');

                    incomeService.payMonthly(createDate(2026, 1, 1));

                    expect(incomeService.$never('pay')).toBeTrue();
                });

                it('Should process large result sets with parallel execution', () => {
                    // Create mock users
                    var userData = [];
                    var userRefs = [];
                    var users    = randRange(15, 25);
                    for(var i = 1; i <= users; i++) {
                        var user = mockUser.make();
                        userRefs.append(user);
                        userData.append([user.getId(), 5]);
                    }

                    mockQueryBuilder.$('from').$results(mockQueryBuilder);
                    mockQueryBuilder.$('leftJoin').$results(mockQueryBuilder);
                    mockQueryBuilder.$('whereNull').$results(mockQueryBuilder);
                    mockQueryBuilder.$('andWhere').$results(mockQueryBuilder);
                    mockQueryBuilder.$('select').$results(mockQueryBuilder);
                    mockQueryBuilder
                        .$('get')
                        .$results(
                            queryNew(
                                'userid,monthlyTakeHome',
                                'numeric,varchar',
                                userData
                            )
                        );

                    incomeService.$('pay');

                    incomeService.payMonthly(createDate(2026, 1, 1));

                    // Verify pay was called for each user
                    var payCallLog = incomeService.$callLog().pay;
                    expect(payCallLog.len()).toBe(users);

                    userRefs.each((user) => {
                        mockUser.delete(user);
                    });
                });
            });

            describe('pay()', () => {
                beforeEach(() => {
                    mockQueryBuilder = createStub();
                    incomeService.$property(propertyName = 'q', mock = mockQueryBuilder);
                });

                it('Should insert income record with pay and extra', () => {
                    mockQueryBuilder.$('from').$results(mockQueryBuilder);
                    mockQueryBuilder.$('insert');

                    incomeService.pay(
                        date   = createDate(2026, 1, 15),
                        userid = 12323,
                        pay    = 5000,
                        extra  = 500
                    );

                    expect(mockQueryBuilder.$once('from')).toBeTrue();
                    expect(mockQueryBuilder.$once('insert')).toBeTrue();

                    var insertArgs = mockQueryBuilder.$callLog().insert[1];
                    expect(insertArgs[1].userid.value).toBe(12323);

                    // Encrypted value inserted
                    expect(insertArgs[1].pay.value).toBe(securityService.encryptValue(5000));
                    expect(insertArgs[1].extra.value).toBe(securityService.encryptValue(500));
                });

                it('Should default extra to 0 when not provided', () => {
                    mockQueryBuilder.$('from').$results(mockQueryBuilder);
                    mockQueryBuilder.$('insert');

                    incomeService.pay(
                        date   = createDate(2026, 1, 15),
                        userid = 12323,
                        pay    = 5000
                    );

                    var insertArgs = mockQueryBuilder.$callLog().insert[1];
                    expect(insertArgs[1].pay.value).toBe(securityService.encryptValue(5000));
                    expect(insertArgs[1].extra.value).toBe(securityService.encryptValue(0));
                });

                it('Should format date to first of month', () => {
                    mockQueryBuilder.$('from').$results(mockQueryBuilder);
                    mockQueryBuilder.$('insert');

                    incomeService.pay(
                        date   = createDate(2026, 1, 15),
                        userid = 12323,
                        pay    = 5000
                    );

                    var insertArgs = mockQueryBuilder.$callLog().insert[1];
                    expect(day(insertArgs[1].date.value)).toBe(1);
                });
            });

            describe('upsert()', () => {
                beforeEach(() => {
                    mockCacheStorage.$reset();
                });

                it('Should insert new record when none exists', () => {
                    var user = mockUser.make();
                    var date = createDate(2025, 1, 15);

                    var beforeTotal = incomeService.getTotal(
                        startDate = date,
                        endDate   = date,
                        userid    = user.getId()
                    );
                    expect(beforeTotal.pay).toBe(0);
                    expect(beforeTotal.extra).toBe(0);

                    incomeService.upsert(
                        date   = date,
                        userid = user.getId(),
                        pay    = 6600,
                        extra  = 71
                    );

                    var afterTotal = incomeService.getTotal(
                        startDate = date,
                        endDate   = date,
                        userid    = user.getId()
                    );
                    expect(afterTotal.pay).toBe(6600);
                    expect(afterTotal.extra).toBe(71);
                    mockUser.delete(user);
                });

                it('Should update existing record on conflict', () => {
                    var user = mockUser.make();
                    var date = createDate(2025, 1, 15);

                    // Create new record
                    incomeService.upsert(
                        date   = date,
                        userid = user.getId(),
                        pay    = 6600,
                        extra  = 71
                    );

                    var beforeTotal = incomeService.getTotal(
                        startDate = date,
                        endDate   = date,
                        userid    = user.getId()
                    );
                    expect(beforeTotal.pay).toBe(6600);
                    expect(beforeTotal.extra).toBe(71);

                    // Update with new values
                    incomeService.upsert(
                        date   = date,
                        userid = user.getId(),
                        pay    = 71,
                        extra  = 6600
                    );

                    var afterTotal = incomeService.getTotal(
                        startDate = date,
                        endDate   = date,
                        userid    = user.getId()
                    );
                    expect(afterTotal.pay).toBe(71);
                    expect(afterTotal.extra).toBe(6600);
                    mockUser.delete(user);
                });

                it('Should clear cache after upsert', () => {
                    var user = mockUser.make();

                    incomeService.upsert(
                        date   = createDate(2026, 1, 15),
                        userid = user.getId(),
                        pay    = 5000,
                        extra  = 500
                    );

                    expect(mockCacheStorage.$once('clearByKeySnippet')).toBeTrue();
                    var cacheArgs = mockCacheStorage.$callLog().clearByKeySnippet[1];
                    expect(cacheArgs.keySnippet).toBe('userid=#user.getId()#|income');
                    mockUser.delete(user);
                });

                it('Should handle zero values correctly', () => {
                    var user = mockUser.make();
                    var date = createDate(2026, 1, 15);

                    incomeService.upsert(
                        date   = date,
                        userid = user.getId(),
                        pay    = 0,
                        extra  = 0
                    );

                    var total = incomeService.getTotal(
                        startDate = date,
                        endDate   = date,
                        userid    = user.getId()
                    );
                    expect(total.pay).toBe(0);
                    expect(total.extra).toBe(0);
                    mockUser.delete(user);
                });
            });

            describe('Integration scenarios', () => {
                it('Should handle full workflow: payMonthly -> getTotal', () => {
                    var user = mockUser.make();

                    // Setup payMonthly
                    mockQueryBuilder.$('from').$results(mockQueryBuilder);
                    mockQueryBuilder.$('leftJoin').$results(mockQueryBuilder);
                    mockQueryBuilder.$('whereNull').$results(mockQueryBuilder);
                    mockQueryBuilder.$('andWhere').$results(mockQueryBuilder);
                    mockQueryBuilder.$('select').$results(mockQueryBuilder);
                    mockQueryBuilder
                        .$('get')
                        .$results(
                            queryNew(
                                'userid,monthlyTakeHome',
                                'numeric,varchar',
                                [[user.getId(), securityService.encryptValue(81)]]
                            )
                        );

                    incomeService.$('pay');

                    // Run payMonthly
                    incomeService.payMonthly(createDate(2026, 2, 1));

                    // Expect pay to be called with the correct args
                    var payArgs = incomeService.$callLog().pay;
                    expect(payArgs.len()).toBe(1);
                    expect(payArgs[1].date).toBe(createDate(2026, 2, 1));
                    expect(payArgs[1].userid).toBe(user.getId());
                    expect(payArgs[1].pay).toBe(81); // decrypted val
                    mockUser.delete(user);
                });

                it('Should handle upsert -> getTotal with cache clear', () => {
                    // Upsert clears cache
                    var user = mockUser.make();
                    incomeService.upsert(
                        date   = createDate(2026, 1, 15),
                        userid = user.getId(),
                        pay    = 35,
                        extra  = 77
                    );

                    // Cache Should be cleared
                    expect(mockCacheStorage.$once('clearByKeySnippet')).toBeTrue();

                    // Next getTotal Should hit database
                    mockCacheStorage.$('get').$results();

                    var result = incomeService.getTotal(
                        startDate = createDate(2026, 1, 1),
                        endDate   = createDate(2026, 1, 31),
                        userid    = user.getId()
                    );

                    // Cache will be set for this call
                    expect(mockCacheStorage.$once('set')).toBeTrue();
                    expect(mockCacheStorage.$callLog().set[1][1]).toBe('userid=#user.getId()#|income.getTotal|startDate={ts ''2026-01-01 00:00:00''}|endDate={ts ''2026-01-01 00:00:00''}');

                    expect(result.pay).toBe(35);
                    expect(result.extra).toBe(77);
                    mockUser.delete(user);
                });
            });
        });
    }

}
