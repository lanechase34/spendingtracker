component extends="coldbox.system.testing.BaseTestCase" {

    function beforeAll() {
        super.beforeAll();

        mockUser         = getInstance('tests.resources.mockuser');
        securityService  = getInstance('services.security');
        realQueryBuilder = getInstance('provider:QueryBuilder@qb');
    }

    /**
     * Replace the real query builder with a stub
     * Each @chain method returns the stub, @terminal ends the chain and returns @result
     */
    private any function stubQueryBuilder(
        required array chain,
        required string terminal,
        any result
    ) {
        var stub = createStub();
        chain.each((method) => {
            stub.$(method).$results(stub);
        });

        stub.$(terminal);
        if(!isNull(arguments.result)) {
            stub.$results(arguments.result);
        }

        incomeService.$property(propertyName = 'q', mock = stub);
        return stub;
    }

    /**
     * Stub the payMonthly() users query to return @rows of [userid, encrypted monthlyTakeHome]
     */
    private any function stubPayMonthlyQuery(required array rows) {
        return stubQueryBuilder(
            chain = [
                'from',
                'leftJoin',
                'whereNull',
                'andWhere',
                'select'
            ],
            terminal = 'get',
            result   = queryNew(
                'userid,monthlyTakeHome',
                'numeric,varchar',
                rows
            )
        );
    }

    /**
     * Cache key the service builds, start and end months are the first of the month
     */
    private string function cacheKey(
        required string method,
        required date startMonth,
        required date endMonth
    ) {
        return 'userid=#user.getId()#|income.#method#|startDate=#startMonth#|endDate=#endMonth#';
    }

    private void function addPay(required date date, required numeric pay) {
        incomeService.pay(date = date, userid = user.getId(), pay = pay);
    }

    private numeric function addExtra(
        required date date,
        required numeric amount,
        string description = 'Extra income',
        numeric userid     = user.getId()
    ) {
        return incomeService.saveExtra(
            date        = date,
            amount      = amount,
            description = description,
            userid      = userid
        );
    }

    private struct function totalFor(required date startDate, date endDate) {
        return incomeService.getTotal(
            startDate = startDate,
            endDate   = arguments.endDate ?: startDate,
            userid    = user.getId()
        );
    }

    private array function extrasFor(required date startDate, date endDate) {
        return incomeService.getExtra(
            startDate = startDate,
            endDate   = arguments.endDate ?: startDate,
            userid    = user.getId()
        );
    }

    /**
     * Expect the income and widget caches to have been cleared for the user
     */
    private void function expectIncomeCacheCleared(required numeric userid) {
        expect(mockCacheStorage.$times(2, 'clearByKeySnippet')).toBeTrue();
        var snippets = mockCacheStorage.$callLog().clearByKeySnippet.map((args) => args.keySnippet);
        expect(snippets).toBe([
            'userid=#userid#|income',
            'userid=#userid#|widget'
        ]);
    }

    function run() {
        describe('services.income', () => {
            beforeEach(() => {
                setup();

                // Real instance with a mocked cache, queries hit the database unless stubbed
                incomeService    = prepareMock(object = new models.services.income());
                mockCacheStorage = createEmptyMock(className = 'coldbox.system.cache.providers.CacheBoxProvider');
                mockCacheStorage.$('get').$results();
                mockCacheStorage.$('set').$results();
                mockCacheStorage.$('clearByKeySnippet').$results();

                incomeService.setSecurityService(securityService);
                incomeService.$property(propertyName = 'cacheStorage', mock = mockCacheStorage);
                incomeService.$property(propertyName = 'q', mock = realQueryBuilder);
                incomeService.$property(propertyName = 'maxThreads', mock = 1);

                user = mockUser.make();
            });

            afterEach(() => {
                mockUser.delete(user);
            });

            describe('Caching', () => {
                var cachedResults = {
                    getTotal        : {pay: 5000, extra: 500},
                    getMonthlyTotals: {'2026-01': {pay: 5000, extra: 500}},
                    getExtra        : [
                        {
                            id         : 1,
                            date       : '2026-01-15',
                            amount     : 25,
                            description: 'Cached'
                        }
                    ]
                };

                cachedResults.each((method, cachedData) => {
                    it('#method#() should cache its result under a key built from userid and the start/end months', () => {
                        var expectedKey = cacheKey(
                            method,
                            createDate(2026, 1, 1),
                            createDate(2026, 3, 1)
                        );

                        // Mid month dates are normalized to the first of the month
                        var result = invoke(
                            incomeService,
                            method,
                            {
                                startDate: createDate(2026, 1, 12),
                                endDate  : createDate(2026, 3, 31),
                                userid   : user.getId()
                            }
                        );

                        expect(mockCacheStorage.$once('get')).toBeTrue();
                        expect(mockCacheStorage.$callLog().get[1][1]).toBe(expectedKey);

                        expect(mockCacheStorage.$once('set')).toBeTrue();
                        expect(mockCacheStorage.$callLog().set[1][1]).toBe(expectedKey);
                        expect(mockCacheStorage.$callLog().set[1][2]).toBe(result);
                    });

                    it('#method#() should return cached data on a cache hit', () => {
                        mockCacheStorage
                            .$('get')
                            .$args(
                                cacheKey(
                                    method,
                                    createDate(2026, 1, 1),
                                    createDate(2026, 1, 1)
                                )
                            )
                            .$results(cachedData);

                        var result = invoke(
                            incomeService,
                            method,
                            {
                                startDate: createDate(2026, 1, 1),
                                endDate  : createDate(2026, 1, 31),
                                userid   : user.getId()
                            }
                        );

                        expect(result).toBe(cachedData);
                        expect(mockCacheStorage.$never('set')).toBeTrue();
                    });
                });
            });

            describe('getTotal()', () => {
                it('Should sum pay and every extra income entry across the full months in range', () => {
                    // In range: Jan + Feb pay, extras on any day of Jan -> Mar
                    addPay(createDate(2026, 1, 1), 1000);
                    addPay(createDate(2026, 2, 1), 2000);
                    addExtra(createDate(2026, 1, 1), 10);
                    addExtra(createDate(2026, 1, 20), 20.25);
                    addExtra(createDate(2026, 3, 31), 30.5);

                    // Out of range on either side
                    addPay(createDate(2025, 12, 1), 9999);
                    addExtra(createDate(2025, 12, 31), 999);
                    addExtra(createDate(2026, 4, 1), 999);

                    // Mid month start/end still span the full months
                    var result = totalFor(createDate(2026, 1, 15), createDate(2026, 3, 5));

                    expect(result.pay).toBe(3000);
                    expect(result.extra).toBe(60.75);
                });

                it('Should return extra income for a month with no pay record', () => {
                    addExtra(createDate(2025, 6, 12), 45);

                    var result = totalFor(createDate(2025, 6, 1));

                    expect(result.pay).toBe(0);
                    expect(result.extra).toBe(45);
                });

                it('Should sum extra entries in cents to avoid floating point drift', () => {
                    addExtra(createDate(2025, 7, 1), 0.1);
                    addExtra(createDate(2025, 7, 2), 0.2);

                    expect(totalFor(createDate(2025, 7, 1)).extra).toBe(0.3);
                });

                it('Should not include another user''s extra income', () => {
                    var otherUser = mockUser.make();

                    addExtra(createDate(2025, 8, 3), 15);
                    addExtra(
                        date   = createDate(2025, 8, 3),
                        amount = 500,
                        userid = otherUser.getId()
                    );

                    expect(totalFor(createDate(2025, 8, 1)).extra).toBe(15);
                    mockUser.delete(otherUser);
                });
            });

            describe('getMonthlyTotals()', () => {
                it('Should bucket pay and summed extra income by month', () => {
                    // Jan: pay + two extras (incl. last day of month)
                    addPay(createDate(2026, 1, 1), 1000);
                    addExtra(createDate(2026, 1, 10), 100.25);
                    addExtra(createDate(2026, 1, 31), 50.5);

                    // Feb: pay only
                    addPay(createDate(2026, 2, 1), 2000);

                    // Mar: extra only
                    addExtra(createDate(2026, 3, 15), 75);

                    // Out of range
                    addExtra(createDate(2025, 12, 31), 999);
                    addPay(createDate(2026, 4, 1), 999);
                    addExtra(createDate(2026, 4, 1), 999);

                    var result = incomeService.getMonthlyTotals(
                        startDate = createDate(2026, 1, 20),
                        endDate   = createDate(2026, 3, 5),
                        userid    = user.getId()
                    );

                    expect(result).toBe({
                        '2026-01': {pay: 1000, extra: 150.75},
                        '2026-02': {pay: 2000, extra: 0},
                        '2026-03': {pay: 0, extra: 75}
                    });
                });

                it('Should return an empty struct when there is no income in range', () => {
                    var result = incomeService.getMonthlyTotals(
                        startDate = createDate(2024, 1, 1),
                        endDate   = createDate(2024, 3, 1),
                        userid    = user.getId()
                    );

                    expect(result).toBeStruct();
                    expect(result).toBeEmpty();
                });
            });

            describe('payMonthly()', () => {
                beforeEach(() => {
                    incomeService.$('pay');
                });

                it('Should pay each user without income for the month their decrypted take home', () => {
                    var q = stubPayMonthlyQuery([
                        [101, securityService.encryptValue(5000)],
                        [102, securityService.encryptValue(6000)]
                    ]);

                    incomeService.payMonthly(createDate(2025, 1, 1));

                    expect(q.$callLog().from[1][1]).toBe('users');
                    expect(q.$callLog().whereNull[1][1]).toBe('income.id');

                    // Threaded, so calls can land in any order
                    var payCallLog = incomeService.$callLog().pay;
                    var paid       = {};
                    payCallLog.each((call) => {
                        expect(call.date).toBe(createDate(2025, 1, 1));
                        paid[call.userid] = call.pay;
                    });
                    expect(paid).toBe({'101': 5000, '102': 6000});
                });

                it('Should use current month when no month provided', () => {
                    stubPayMonthlyQuery([[101, securityService.encryptValue(7000)]]);

                    incomeService.payMonthly();

                    var payCallLog = incomeService.$callLog().pay;
                    expect(payCallLog[1].date).toBe(createDate(year(now()), month(now()), 1));
                    expect(payCallLog[1].userid).toBe(101);
                    expect(payCallLog[1].pay).toBe(7000);
                });

                it('Should handle empty result set', () => {
                    stubPayMonthlyQuery([]);

                    incomeService.payMonthly(createDate(2026, 1, 1));

                    expect(incomeService.$never('pay')).toBeTrue();
                });

                it('Should process large result sets with parallel execution', () => {
                    var rows = [];
                    for(var i = 1; i <= 25; i++) {
                        rows.append([i, securityService.encryptValue(5)]);
                    }
                    stubPayMonthlyQuery(rows);

                    incomeService.payMonthly(createDate(2026, 1, 1));

                    expect(incomeService.$times(25, 'pay')).toBeTrue();
                });
            });

            describe('pay()', () => {
                it('Should insert encrypted pay on the first of the month', () => {
                    var q = stubQueryBuilder(chain = ['from'], terminal = 'insert');

                    incomeService.pay(
                        date   = createDate(2026, 1, 15),
                        userid = 12323,
                        pay    = 5000
                    );

                    expect(q.$callLog().from[1][1]).toBe('income');
                    expect(q.$once('insert')).toBeTrue();

                    var insertArgs = q.$callLog().insert[1][1];
                    expect(insertArgs.date.value).toBe(createDate(2026, 1, 1));
                    expect(insertArgs.userid.value).toBe(12323);
                    expect(insertArgs.pay.value).toBe(securityService.encryptValue(5000));
                });

                it('Should only write pay, extra income lives in income_extra', () => {
                    var q = stubQueryBuilder(chain = ['from'], terminal = 'insert');

                    incomeService.pay(
                        date   = createDate(2026, 1, 15),
                        userid = 12323,
                        pay    = 5000
                    );

                    var columns = q.$callLog().insert[1][1].keyArray().map((column) => lCase(column));
                    arraySort(columns, 'text');
                    expect(columns).toBe(['date', 'pay', 'userid']);
                });
            });

            describe('upsert()', () => {
                it('Should insert new record when none exists', () => {
                    var date = createDate(2025, 1, 15);
                    expect(totalFor(date)).toBe({pay: 0, extra: 0});

                    incomeService.upsert(date = date, userid = user.getId(), pay = 6600);

                    expect(totalFor(date)).toBe({pay: 6600, extra: 0});
                });

                it('Should update existing record on conflict', () => {
                    var date = createDate(2025, 1, 15);

                    incomeService.upsert(date = date, userid = user.getId(), pay = 6600);
                    expect(totalFor(date).pay).toBe(6600);

                    incomeService.upsert(date = date, userid = user.getId(), pay = 71);
                    expect(totalFor(date).pay).toBe(71);

                    // Still a single row for the month
                    var rowCount = queryExecute(
                        'SELECT count(id) AS total FROM income WHERE userid = :userid AND date = :date',
                        {
                            userid: {value: user.getId(), cfsqltype: 'numeric'},
                            date  : {value: createDate(2025, 1, 1), cfsqltype: 'date'}
                        }
                    ).total;
                    expect(rowCount).toBe(1);
                });

                it('Should not modify extra income entries in the same month', () => {
                    var date = createDate(2025, 2, 15);

                    incomeService.upsert(date = date, userid = user.getId(), pay = 6600);
                    var extraId = addExtra(date, 71, 'Side gig');

                    // Update pay for the month
                    incomeService.upsert(date = date, userid = user.getId(), pay = 71);

                    expect(totalFor(date)).toBe({pay: 71, extra: 71});
                    expect(extrasFor(date).map((row) => row.id)).toBe([extraId]);
                });

                it('Should clear the income and widget cache after upsert', () => {
                    incomeService.upsert(
                        date   = createDate(2026, 1, 15),
                        userid = user.getId(),
                        pay    = 5000
                    );

                    expectIncomeCacheCleared(user.getId());
                });

                it('Should handle zero values correctly', () => {
                    var date = createDate(2026, 1, 15);

                    incomeService.upsert(date = date, userid = user.getId(), pay = 0);

                    expect(totalFor(date)).toBe({pay: 0, extra: 0});
                });
            });

            describe('getExtra()', () => {
                it('Should return each entry with a decrypted amount and formatted date', () => {
                    var id = addExtra(
                        createDate(2026, 1, 15),
                        1234.56,
                        'Freelance project'
                    );

                    expect(extrasFor(createDate(2026, 1, 1))).toBe([
                        {
                            id         : id,
                            date       : '2026-01-15',
                            amount     : 1234.56,
                            description: 'Freelance project'
                        }
                    ]);
                });

                it('Should return entries across the full months in range, newest first', () => {
                    var firstDay = addExtra(createDate(2026, 1, 1), 1);
                    var midA     = addExtra(createDate(2026, 2, 14), 2);
                    var midB     = addExtra(createDate(2026, 2, 14), 3);
                    var lastDay  = addExtra(createDate(2026, 3, 31), 4);

                    // Out of range on either side
                    addExtra(createDate(2025, 12, 31), 5);
                    addExtra(createDate(2026, 4, 1), 6);

                    // Mid month start/end still span the full months
                    var ids = extrasFor(createDate(2026, 1, 20), createDate(2026, 3, 2)).map((row) => row.id);

                    // Ordered by date desc, then id desc for entries on the same day
                    expect(ids).toBe([lastDay, midB, midA, firstDay]);
                });

                it('Should only return the user''s own entries', () => {
                    var otherUser = mockUser.make();

                    var mine = addExtra(createDate(2026, 2, 3), 10);
                    addExtra(
                        date   = createDate(2026, 2, 3),
                        amount = 20,
                        userid = otherUser.getId()
                    );

                    expect(extrasFor(createDate(2026, 2, 1)).map((row) => row.id)).toBe([mine]);
                    mockUser.delete(otherUser);
                });

                it('Should return an empty array when there are no entries', () => {
                    var result = extrasFor(createDate(2024, 1, 1), createDate(2024, 12, 1));

                    expect(result).toBeArray();
                    expect(result).toBeEmpty();
                });
            });

            describe('saveExtra()', () => {
                it('Should insert an encrypted amount on the exact date supplied and return the new id', () => {
                    var q = stubQueryBuilder(
                        chain    = ['from', 'returning'],
                        terminal = 'insert',
                        result   = {result: {id: 42}}
                    );

                    var id = incomeService.saveExtra(
                        date        = createDate(2026, 1, 15),
                        amount      = 250.75,
                        description = 'Freelance project',
                        userid      = 12323
                    );

                    expect(id).toBe(42);
                    expect(q.$callLog().from[1][1]).toBe('income_extra');
                    expect(q.$callLog().returning[1][1]).toBe('id');

                    var insertArgs = q.$callLog().insert[1][1];

                    // Date is NOT normalized to the first of the month
                    expect(insertArgs.date.value).toBe(createDate(2026, 1, 15));
                    expect(insertArgs.amount.value).toBe(securityService.encryptValue(250.75));
                    expect(insertArgs.description.value).toBe('Freelance project');
                    expect(insertArgs.userid.value).toBe(12323);

                    expectIncomeCacheCleared(12323);
                });

                it('Should persist an entry that round trips through the database', () => {
                    var id = addExtra(createDate(2026, 5, 9), 99.99, 'Sold a bike');

                    var row = queryExecute(
                        'SELECT date, amount, description, userid FROM income_extra WHERE id = :id',
                        {id: {value: id, cfsqltype: 'numeric'}}
                    );

                    expect(row.recordCount).toBe(1);
                    expect(dateFormat(row.date, 'yyyy-mm-dd')).toBe('2026-05-09');
                    expect(row.description).toBe('Sold a bike');
                    expect(row.userid).toBe(user.getId());

                    // Stored encrypted as cents
                    expect(row.amount).notToBe('99.99');
                    expect(securityService.decryptValue(row.amount, 'numeric')).toBe(9999);
                });

                it('Should allow multiple entries on the same date', () => {
                    var date = createDate(2026, 6, 1);

                    var first  = addExtra(date, 5);
                    var second = addExtra(date, 5);

                    expect(first).notToBe(second);
                    expect(totalFor(date).extra).toBe(10);
                });
            });

            describe('deleteExtra()', () => {
                it('Should scope the delete to the id and userid, and clear the cache', () => {
                    var q = stubQueryBuilder(
                        chain    = ['from', 'where', 'andWhere'],
                        terminal = 'delete',
                        result   = {result: {recordCount: 1}}
                    );

                    expect(incomeService.deleteExtra(id = 7, userid = 12323)).toBeTrue();

                    expect(q.$callLog().from[1][1]).toBe('income_extra');

                    var whereArgs = q.$callLog().where[1];
                    expect(whereArgs[1]).toBe('id');
                    expect(whereArgs[3].value).toBe(7);

                    var andWhereArgs = q.$callLog().andWhere[1];
                    expect(andWhereArgs[1]).toBe('userid');
                    expect(andWhereArgs[3].value).toBe(12323);

                    expectIncomeCacheCleared(12323);
                });

                it('Should return false and not clear the cache when nothing was deleted', () => {
                    stubQueryBuilder(
                        chain    = ['from', 'where', 'andWhere'],
                        terminal = 'delete',
                        result   = {result: {recordCount: 0}}
                    );

                    expect(incomeService.deleteExtra(id = 7, userid = 12323)).toBeFalse();
                    expect(mockCacheStorage.$never('clearByKeySnippet')).toBeTrue();
                });

                it('Should delete the user''s own entry from the database', () => {
                    var date   = createDate(2026, 7, 4);
                    var keep   = addExtra(date, 10);
                    var remove = addExtra(date, 20);

                    expect(incomeService.deleteExtra(id = remove, userid = user.getId())).toBeTrue();
                    expect(extrasFor(date).map((row) => row.id)).toBe([keep]);

                    // Deleting again finds nothing
                    expect(incomeService.deleteExtra(id = remove, userid = user.getId())).toBeFalse();
                });

                it('Should not delete another user''s entry', () => {
                    var otherUser = mockUser.make();
                    var theirs    = addExtra(
                        date   = createDate(2026, 7, 4),
                        amount = 20,
                        userid = otherUser.getId()
                    );

                    expect(incomeService.deleteExtra(id = theirs, userid = user.getId())).toBeFalse();

                    var stillExists = queryExecute(
                        'SELECT count(id) AS total FROM income_extra WHERE id = :id',
                        {id: {value: theirs, cfsqltype: 'numeric'}}
                    ).total;
                    expect(stillExists).toBe(1);
                    mockUser.delete(otherUser);
                });

                it('Should return false for an id that does not exist', () => {
                    expect(incomeService.deleteExtra(id = 2147483647, userid = user.getId())).toBeFalse();
                });
            });

            describe('Integration scenarios', () => {
                it('Should handle upsert + saveExtra -> getTotal with cache clear', () => {
                    incomeService.upsert(
                        date   = createDate(2026, 1, 15),
                        userid = user.getId(),
                        pay    = 35
                    );
                    addExtra(createDate(2026, 1, 20), 77);

                    // Cache cleared (income + widget) once per write
                    expect(mockCacheStorage.$times(4, 'clearByKeySnippet')).toBeTrue();

                    expect(totalFor(createDate(2026, 1, 1), createDate(2026, 1, 31))).toBe({pay: 35, extra: 77});
                });

                it('Should handle saveExtra -> deleteExtra -> getTotal', () => {
                    var date = createDate(2026, 8, 10);

                    var id = addExtra(date, 300);
                    expect(totalFor(date).extra).toBe(300);

                    incomeService.deleteExtra(id = id, userid = user.getId());
                    expect(totalFor(date).extra).toBe(0);
                });
            });
        });
    }

}
