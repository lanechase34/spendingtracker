component extends="tests.resources.baseTest" {

    function beforeAll() {
        super.beforeAll();
        categoryService = getInstance('services.category');
        expenseHelper   = getInstance('tests.resources.expenseHelper');
        mockUser        = getInstance('tests.resources.mockuser');
        securityService = getInstance('services.security');
        q               = getInstance('provider:QueryBuilder@qb');
    }

    function afterAll() {
        super.afterAll();
    }

    /**
      * Find x-axis label in array of labels returned
      */
    private struct function findDataset(required array datasets, required string label) {
        for(var d in datasets) {
            if(d.label == label) {
                return d;
            }
        }

        fail('No dataset found for label "#label#". Datasets: #serializeJSON(datasets)#');
        return {};
    }

    function run() {
        describe('GET /widgets/stackedBarChart', () => {
            beforeEach(() => {
                setup();

                /**
                 * Unique user + categories per test
                 */
                user = mockUser.make();
                jwt  = mockUser.login(user);

                categoryAId = categoryService.save(
                    name   = 'ChartCatA_#left(createUUID().replace('-', '', 'all'), 8)#',
                    userid = user.getId()
                );
                categoryBId = categoryService.save(
                    name   = 'ChartCatB_#left(createUUID().replace('-', '', 'all'), 8)#',
                    userid = user.getId()
                );
                categoryA = categoryService.getFromId(categoryAId);
                categoryB = categoryService.getFromId(categoryBId);
            });

            afterEach(() => {
                mockUser.logout(user, jwt);
                mockUser.delete(user);
            });

            describe('Week view (< 7 days) - grouped by day', () => {
                it('Produces one label per day, in short-date format, and empty datasets when there is no data', () => {
                    setup();
                    var event = get(
                        route   = '/api/v1/widgets/stackedBarChart',
                        headers = {'x-auth-token': jwt},
                        params  = {startDate: '2026-02-02', endDate: '2026-02-08'}
                    );

                    var response = event.getResponse();
                    expect(response.getStatusCode()).toBe(200);
                    expect(response.getError()).toBeFalse();

                    var data = response.getData();
                    expect(data).toHaveKey('labels');
                    expect(data).toHaveKey('datasets');
                    expect(data.labels).toBe([
                        '2/2/26',
                        '2/3/26',
                        '2/4/26',
                        '2/5/26',
                        '2/6/26',
                        '2/7/26',
                        '2/8/26'
                    ]);
                    expect(data.datasets).toBeArray();
                    expect(data.datasets.len()).toBe(0);
                });

                it('Trims the start/end date entirely to the date range under one week', () => {
                    // 2026-03-10 -> 2026-03-13 (4 days) - only shows these 4 days in between this range
                    expenseHelper.mock(
                        userid      = user.getId(),
                        count       = 1,
                        date        = createDate(2026, 3, 11),
                        description = 'Mid-range',
                        categoryid  = categoryAId,
                        amount      = 42
                    );

                    setup();
                    var event = get(
                        route   = '/api/v1/widgets/stackedBarChart',
                        headers = {'x-auth-token': jwt},
                        params  = {startDate: '2026-03-10', endDate: '2026-03-13'}
                    );

                    var data = event.getResponse().getData();
                    expect(data.labels).toBe(['3/10/26', '3/11/26', '3/12/26', '3/13/26']);

                    var dataset = findDataset(data.datasets, categoryA.name);
                    expect(dataset.data[2]).toBe(42);
                });

                it('Buckets each expense on the correct day and sums same-day, same-category expenses', () => {
                    // Day 1 (2/2): single expense
                    expenseHelper.mock(
                        userid      = user.getId(),
                        count       = 1,
                        date        = createDate(2026, 2, 2),
                        description = 'Day 1',
                        categoryid  = categoryAId,
                        amount      = 10
                    );

                    // Day 3 (2/4): two expenses that must be summed together
                    expenseHelper.mock(
                        userid      = user.getId(),
                        count       = 1,
                        date        = createDate(2026, 2, 4),
                        description = 'Day 3a',
                        categoryid  = categoryAId,
                        amount      = 8
                    );
                    expenseHelper.mock(
                        userid      = user.getId(),
                        count       = 1,
                        date        = createDate(2026, 2, 4),
                        description = 'Day 3b',
                        categoryid  = categoryAId,
                        amount      = 12
                    );

                    // Day 7 (2/8): single expense
                    expenseHelper.mock(
                        userid      = user.getId(),
                        count       = 1,
                        date        = createDate(2026, 2, 8),
                        description = 'Day 7',
                        categoryid  = categoryAId,
                        amount      = 30
                    );

                    setup();
                    var event = get(
                        route   = '/api/v1/widgets/stackedBarChart',
                        headers = {'x-auth-token': jwt},
                        params  = {startDate: '2026-02-02', endDate: '2026-02-08'}
                    );

                    var data    = event.getResponse().getData();
                    var dataset = findDataset(data.datasets, categoryA.name);

                    expect(dataset.data[1]).toBe(10); // 2/2
                    expect(dataset.data[3]).toBe(20); // 2/4, summed (8 + 12)
                    expect(dataset.data[7]).toBe(30); // 2/8
                });

                it('Creates a separate dataset per category with the correct label and backgroundColor', () => {
                    expenseHelper.mock(
                        userid      = user.getId(),
                        count       = 1,
                        date        = createDate(2026, 2, 3),
                        description = 'Cat A expense',
                        categoryid  = categoryAId,
                        amount      = 15
                    );
                    expenseHelper.mock(
                        userid      = user.getId(),
                        count       = 1,
                        date        = createDate(2026, 2, 3),
                        description = 'Cat B expense',
                        categoryid  = categoryBId,
                        amount      = 25
                    );

                    setup();
                    var event = get(
                        route   = '/api/v1/widgets/stackedBarChart',
                        headers = {'x-auth-token': jwt},
                        params  = {startDate: '2026-02-02', endDate: '2026-02-08'}
                    );

                    var data = event.getResponse().getData();
                    expect(data.datasets.len()).toBe(2);

                    var dsA = findDataset(data.datasets, categoryA.name);
                    var dsB = findDataset(data.datasets, categoryB.name);

                    expect(dsA.backgroundColor).toBe('###categoryA.color#');
                    expect(dsB.backgroundColor).toBe('###categoryB.color#');
                    expect(dsA.data[2]).toBe(15);
                    expect(dsB.data[2]).toBe(25);
                });

                it('Includes expenses that fall exactly on the first and last day of the range', () => {
                    expenseHelper.mock(
                        userid      = user.getId(),
                        count       = 1,
                        date        = createDate(2026, 2, 2), // startDate itself
                        description = 'First day',
                        categoryid  = categoryAId,
                        amount      = 5
                    );
                    expenseHelper.mock(
                        userid      = user.getId(),
                        count       = 1,
                        date        = createDate(2026, 2, 8), // endDate itself
                        description = 'Last day',
                        categoryid  = categoryAId,
                        amount      = 6
                    );

                    setup();
                    var event = get(
                        route   = '/api/v1/widgets/stackedBarChart',
                        headers = {'x-auth-token': jwt},
                        params  = {startDate: '2026-02-02', endDate: '2026-02-08'}
                    );

                    var dataset = findDataset(event.getResponse().getData().datasets, categoryA.name);
                    expect(dataset.data[1]).toBe(5);
                    expect(dataset.data[7]).toBe(6);
                });

                it('Excludes expenses that fall outside the 7-day range', () => {
                    expenseHelper.mock(
                        userid      = user.getId(),
                        count       = 1,
                        date        = createDate(2026, 2, 1), // one day before start
                        description = 'Before range',
                        categoryid  = categoryAId,
                        amount      = 100
                    );
                    expenseHelper.mock(
                        userid      = user.getId(),
                        count       = 1,
                        date        = createDate(2026, 2, 9), // one day after end
                        description = 'After range',
                        categoryid  = categoryAId,
                        amount      = 100
                    );

                    setup();
                    var event = get(
                        route   = '/api/v1/widgets/stackedBarChart',
                        headers = {'x-auth-token': jwt},
                        params  = {startDate: '2026-02-02', endDate: '2026-02-08'}
                    );

                    // Nothing falls inside the range, so no dataset should be created at all
                    expect(
                        event
                            .getResponse()
                            .getData()
                            .datasets
                            .len()
                    ).toBe(0);
                });

                it('Handles decimal-precision amounts correctly within a single day bucket', () => {
                    expenseHelper.mock(
                        userid      = user.getId(),
                        count       = 1,
                        date        = createDate(2026, 2, 5),
                        description = 'Decimal a',
                        categoryid  = categoryAId,
                        amount      = 12.34
                    );
                    expenseHelper.mock(
                        userid      = user.getId(),
                        count       = 1,
                        date        = createDate(2026, 2, 5),
                        description = 'Decimal b',
                        categoryid  = categoryAId,
                        amount      = 3.33
                    );

                    setup();
                    var event = get(
                        route   = '/api/v1/widgets/stackedBarChart',
                        headers = {'x-auth-token': jwt},
                        params  = {startDate: '2026-02-02', endDate: '2026-02-08'}
                    );

                    var dataset = findDataset(event.getResponse().getData().datasets, categoryA.name);
                    expect(dataset.data[4]).toBe(15.67);
                });
            });

            describe('Month/year view (> 7 days) - grouped by week', () => {
                it('Groups a month into weekly buckets with natural boundaries when start/end already align to a week', () => {
                    // Feb 2026 happens to start and end exactly on week boundaries - no start/end trimming should occur
                    setup();
                    var event = get(
                        route   = '/api/v1/widgets/stackedBarChart',
                        headers = {'x-auth-token': jwt},
                        params  = {startDate: '2026-02-01', endDate: '2026-02-28'}
                    );

                    var data = event.getResponse().getData();
                    expect(data.labels).toBe([
                        '2/1/26 - 2/7/26',
                        '2/8/26 - 2/14/26',
                        '2/15/26 - 2/21/26',
                        '2/22/26 - 2/28/26'
                    ]);
                    expect(data.datasets.len()).toBe(0);
                });

                it('Buckets month-view expenses into the correct week and aggregates multiple expenses within the same week', () => {
                    // Week 1 (2/1 - 2/7): two expenses on different days, must be summed
                    expenseHelper.mock(
                        userid      = user.getId(),
                        count       = 1,
                        date        = createDate(2026, 2, 1),
                        description = 'Week 1a',
                        categoryid  = categoryAId,
                        amount      = 50
                    );
                    expenseHelper.mock(
                        userid      = user.getId(),
                        count       = 1,
                        date        = createDate(2026, 2, 5),
                        description = 'Week 1b',
                        categoryid  = categoryAId,
                        amount      = 30
                    );

                    // Week 3 (2/15 - 2/21): two expenses on different days, must be summed
                    expenseHelper.mock(
                        userid      = user.getId(),
                        count       = 1,
                        date        = createDate(2026, 2, 15),
                        description = 'Week 3a',
                        categoryid  = categoryAId,
                        amount      = 40
                    );
                    expenseHelper.mock(
                        userid      = user.getId(),
                        count       = 1,
                        date        = createDate(2026, 2, 18),
                        description = 'Week 3b',
                        categoryid  = categoryAId,
                        amount      = 10
                    );

                    setup();
                    var event = get(
                        route   = '/api/v1/widgets/stackedBarChart',
                        headers = {'x-auth-token': jwt},
                        params  = {startDate: '2026-02-01', endDate: '2026-02-28'}
                    );

                    var dataset = findDataset(event.getResponse().getData().datasets, categoryA.name);
                    expect(dataset.data[1]).toBe(80); // week 1: 50 + 30
                    expect(dataset.data[3]).toBe(50); // week 3: 40 + 10
                });

                it('Excludes month-view expenses that fall outside the requested range', () => {
                    expenseHelper.mock(
                        userid      = user.getId(),
                        count       = 1,
                        date        = createDate(2026, 1, 31), // day before start
                        description = 'Before range',
                        categoryid  = categoryAId,
                        amount      = 999
                    );
                    expenseHelper.mock(
                        userid      = user.getId(),
                        count       = 1,
                        date        = createDate(2026, 3, 1), // day after end
                        description = 'After range',
                        categoryid  = categoryAId,
                        amount      = 999
                    );

                    setup();
                    var event = get(
                        route   = '/api/v1/widgets/stackedBarChart',
                        headers = {'x-auth-token': jwt},
                        params  = {startDate: '2026-02-01', endDate: '2026-02-28'}
                    );

                    expect(
                        event
                            .getResponse()
                            .getData()
                            .datasets
                            .len()
                    ).toBe(0);
                });
            });

            describe('Year-boundary', () => {
                it('Buckets a January 1st expense into the FIRST week bucket for a year with 53 ISO weeks', () => {
                    // 2026 has 53 ISO weeks (week(2026-01-01) = 1, week(2026-12-31) = 53).
                    expenseHelper.mock(
                        userid      = user.getId(),
                        count       = 1,
                        date        = createDate(2026, 1, 1),
                        description = 'New Year expense',
                        categoryid  = categoryAId,
                        amount      = 111
                    );

                    setup();
                    var event = get(
                        route   = '/api/v1/widgets/stackedBarChart',
                        headers = {'x-auth-token': jwt},
                        params  = {startDate: '2026-01-01', endDate: '2026-12-31'}
                    );

                    var data = event.getResponse().getData();
                    expect(data.labels.len()).toBe(53);

                    var dataset = findDataset(data.datasets, categoryA.name);
                    expect(dataset.data[1]).toBe(111);
                });

                it('Buckets a December 31st expense into the LAST week bucket for a year with 53 ISO weeks', () => {
                    expenseHelper.mock(
                        userid      = user.getId(),
                        count       = 1,
                        date        = createDate(2026, 12, 31),
                        description = 'Year-end expense',
                        categoryid  = categoryAId,
                        amount      = 222
                    );

                    setup();
                    var event = get(
                        route   = '/api/v1/widgets/stackedBarChart',
                        headers = {'x-auth-token': jwt},
                        params  = {startDate: '2026-01-01', endDate: '2026-12-31'}
                    );

                    var data    = event.getResponse().getData();
                    var dataset = findDataset(data.datasets, categoryA.name);
                    expect(dataset.data[53]).toBe(222);
                });

                it('Keeps January 1st and the wrapped final week distinct in the SAME request (no key collision)', () => {
                    expenseHelper.mock(
                        userid      = user.getId(),
                        count       = 1,
                        date        = createDate(2026, 1, 1),
                        description = 'New Year expense',
                        categoryid  = categoryAId,
                        amount      = 111
                    );
                    expenseHelper.mock(
                        userid      = user.getId(),
                        count       = 1,
                        date        = createDate(2026, 12, 31),
                        description = 'Year-end expense',
                        categoryid  = categoryAId,
                        amount      = 222
                    );

                    setup();
                    var event = get(
                        route   = '/api/v1/widgets/stackedBarChart',
                        headers = {'x-auth-token': jwt},
                        params  = {startDate: '2026-01-01', endDate: '2026-12-31'}
                    );

                    var dataset = findDataset(event.getResponse().getData().datasets, categoryA.name);
                    expect(dataset.data[1]).toBe(111);
                    expect(dataset.data[53]).toBe(222);
                });

                it('Correctly separates expenses across a calendar-year boundary in a fiscal-year-style range', () => {
                    // A range that itself spans two calendar years
                    expenseHelper.mock(
                        userid      = user.getId(),
                        count       = 1,
                        date        = createDate(2026, 12, 25),
                        description = 'Pre-boundary expense',
                        categoryid  = categoryAId,
                        amount      = 77
                    );
                    expenseHelper.mock(
                        userid      = user.getId(),
                        count       = 1,
                        date        = createDate(2027, 1, 5),
                        description = 'Post-boundary expense',
                        categoryid  = categoryAId,
                        amount      = 88
                    );

                    setup();
                    var event = get(
                        route   = '/api/v1/widgets/stackedBarChart',
                        headers = {'x-auth-token': jwt},
                        params  = {startDate: '2026-04-01', endDate: '2027-03-31'}
                    );

                    var data = event.getResponse().getData();
                    expect(data.labels.len()).toBe(53);

                    var dataset = findDataset(data.datasets, categoryA.name);
                    expect(dataset.data[39]).toBe(77);
                    expect(dataset.data[41]).toBe(88);
                });
            });

            describe('General behavior', () => {
                it('Returns 401 when no auth token is provided', () => {
                    setup();
                    var event = get(
                        route  = '/api/v1/widgets/stackedBarChart',
                        params = {startDate: '2026-01-01', endDate: '2026-01-31'}
                    );

                    expect(event.getResponse().getStatusCode()).toBe(401);
                });

                it('Does not let a user see another user''s expense data', () => {
                    var otherUser       = mockUser.make();
                    var otherCategoryId = categoryService.save(
                        name   = 'OtherUserCat_#left(createUUID().replace('-', '', 'all'), 8)#',
                        userid = otherUser.getId()
                    );

                    expenseHelper.mock(
                        userid      = otherUser.getId(),
                        count       = 1,
                        date        = createDate(2026, 1, 15),
                        description = 'Other user expense',
                        categoryid  = otherCategoryId,
                        amount      = 9999
                    );

                    setup();
                    var event = get(
                        route   = '/api/v1/widgets/stackedBarChart',
                        headers = {'x-auth-token': jwt},
                        params  = {startDate: '2026-01-01', endDate: '2026-01-31'}
                    );

                    expect(
                        event
                            .getResponse()
                            .getData()
                            .datasets
                            .len()
                    ).toBe(0);

                    mockUser.delete(otherUser);
                });

                it('Serves the cached result on a repeated request, then reflects fresh data once the cache is invalidated', () => {
                    expenseHelper.mock(
                        userid      = user.getId(),
                        count       = 1,
                        date        = createDate(2026, 2, 5),
                        description = 'Original expense',
                        categoryid  = categoryAId,
                        amount      = 40
                    );

                    setup();
                    var firstEvent = get(
                        route   = '/api/v1/widgets/stackedBarChart',
                        headers = {'x-auth-token': jwt},
                        params  = {startDate: '2026-02-01', endDate: '2026-02-28'}
                    );

                    var firstDataset = findDataset(firstEvent.getResponse().getData().datasets, categoryA.name);
                    expect(firstDataset.data[1]).toBe(40);

                    // Mutate the existing expense's amount directly in the DB, bypassing
                    // the helper's cache invalidation, to prove the next identical
                    // request is served from cache rather than recomputed.
                    q.from('expense')
                        .where(
                            'userid',
                            '=',
                            {value: user.getId(), cfsqltype: 'numeric'}
                        )
                        .update({amount: {value: securityService.encryptValue(999), cfsqltype: 'varchar'}});

                    setup();
                    var secondEvent = get(
                        route   = '/api/v1/widgets/stackedBarChart',
                        headers = {'x-auth-token': jwt},
                        params  = {startDate: '2026-02-01', endDate: '2026-02-28'}
                    );

                    var secondDataset = findDataset(secondEvent.getResponse().getData().datasets, categoryA.name);
                    expect(secondDataset.data[1]).toBe(
                        40,
                        'Should still return the cached value even though the underlying row changed'
                    );

                    // Adding a new expense clears the cache, so the NEXT request should
                    // reflect both the mutated row (now 999) and the new one (10).
                    expenseHelper.mock(
                        userid      = user.getId(),
                        count       = 1,
                        date        = createDate(2026, 2, 5),
                        description = 'New expense after invalidation',
                        categoryid  = categoryAId,
                        amount      = 10
                    );

                    setup();
                    var thirdEvent = get(
                        route   = '/api/v1/widgets/stackedBarChart',
                        headers = {'x-auth-token': jwt},
                        params  = {startDate: '2026-02-01', endDate: '2026-02-28'}
                    );

                    var thirdDataset = findDataset(thirdEvent.getResponse().getData().datasets, categoryA.name);
                    expect(thirdDataset.data[1]).toBe(
                        1009,
                        'Should reflect the mutated amount (999) plus the new expense (10)'
                    );
                });
            });
        });
    }

}
