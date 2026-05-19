component extends="tests.resources.baseTest" {

    function beforeAll() {
        super.beforeAll();
        categoryService = getInstance('services.category');
        expenseHelper   = getInstance('tests.resources.expenseHelper');
        incomeHelper    = getInstance('tests.resources.incomeHelper');
        mockUser        = getInstance('tests.resources.mockuser');

        savingsId = categoryService.getFromName('Savings').id;
    }

    function afterAll() {
        super.afterAll();
    }

    function run() {
        describe('GET /widgets/incomeWaterfall', () => {
            beforeEach(() => {
                setup();

                /**
                 * Unique user per test
                 */
                user = mockUser.make();
                jwt  = mockUser.login(user);
            });

            afterEach(() => {
                mockUser.logout(user, jwt);
                mockUser.delete(user);
            });

            it('Returns the expected response shape', () => {
                var event = get(
                    route   = '/api/v1/widgets/incomeWaterfall',
                    headers = {'x-auth-token': jwt},
                    params  = {startDate: '2026-01-01', endDate: '2026-03-31'}
                );

                var response = event.getResponse();
                expect(response.getStatusCode()).toBe(200);
                expect(response.getError()).toBeFalse();

                var data = response.getData();
                expect(data).toHaveKey('labels');
                expect(data).toHaveKey('segments');
                expect(data.labels).toBeArray();
                expect(data.segments).toBeArray();

                // Jan, Feb, Mar = 3 months
                expect(data.labels.len()).toBe(3);
                expect(data.segments.len()).toBe(3);

                // Each segment should carry net, savings, and runningTotal
                data.segments.each((segment) => {
                    expect(segment).toHaveKey('net');
                    expect(segment).toHaveKey('savings');
                    expect(segment).toHaveKey('runningTotal');
                });
            });

            it('Returns zero-valued segments when there is no data', () => {
                var event = get(
                    route   = '/api/v1/widgets/incomeWaterfall',
                    headers = {'x-auth-token': jwt},
                    params  = {
                        startDate: '2030-01-01', // far future, no data
                        endDate  : '2030-03-31'
                    }
                );

                var data = event.getResponse().getData();
                expect(data.segments.len()).toBe(3);

                data.segments.each((segment) => {
                    expect(segment.net).toBe(0);
                    expect(segment.savings).toBe(0);
                    expect(segment.runningTotal).toBe(0);
                });
            });

            it('Calculates net income as income minus non-savings expenses', () => {
                // Mock $3000 income and $1000 non-savings expense for Jan 2026

                incomeHelper.mock(
                    userid      = user.getId(),
                    date        = createDate(2026, 1, 15),
                    description = 'Jan paycheck',
                    amount      = 3000
                );

                expenseHelper.mock(
                    userid      = user.getId(),
                    count       = 1,
                    date        = createDate(2026, 1, 20),
                    description = 'Jan rent',
                    categoryid  = 1,
                    amount      = 1000
                );

                var event = get(
                    route   = '/api/v1/widgets/incomeWaterfall',
                    headers = {'x-auth-token': jwt},
                    params  = {startDate: '2026-01-01', endDate: '2026-01-31'}
                );

                var data = event.getResponse().getData();
                expect(data.segments.len()).toBe(1);
                expect(data.segments[1].net).toBe(2000);
                expect(data.segments[1].savings).toBe(0);
                expect(data.segments[1].runningTotal).toBe(2000);
            });

            it('Treats savings transfers as positive (does not subtract them from net)', () => {
                // $3000 income, $1000 non-savings expense, $1000 savings transfer
                // Net should be $2000, savings should be $1000

                incomeHelper.mock(
                    userid      = user.getId(),
                    date        = createDate(2026, 1, 15),
                    description = 'Jan paycheck',
                    amount      = 3000
                );

                expenseHelper.mock(
                    userid      = user.getId(),
                    count       = 1,
                    date        = createDate(2026, 1, 20),
                    description = 'Jan rent',
                    categoryid  = 1,
                    amount      = 1000
                );

                expenseHelper.mock(
                    userid      = user.getId(),
                    count       = 1,
                    date        = createDate(2026, 1, 25),
                    description = 'Savings transfer',
                    categoryid  = savingsId,
                    amount      = 1000
                );

                var event = get(
                    route   = '/api/v1/widgets/incomeWaterfall',
                    headers = {'x-auth-token': jwt},
                    params  = {startDate: '2026-01-01', endDate: '2026-01-31'}
                );

                var data = event.getResponse().getData();
                expect(data.segments[1].net).toBe(2000);
                expect(data.segments[1].savings).toBe(1000);
                expect(data.segments[1].runningTotal).toBe(2000);
            });

            it('Accumulates running total across months', () => {
                // Jan: +$2000 net, Feb: +$3000 net, Mar: -$500 net
                // Expected runningTotals: 2000, 5000, 4500

                incomeHelper.mock(
                    userid      = user.getId(),
                    date        = createDate(2026, 1, 15),
                    description = 'Jan paycheck',
                    amount      = 2000
                );

                incomeHelper.mock(
                    userid      = user.getId(),
                    date        = createDate(2026, 2, 15),
                    description = 'Feb paycheck',
                    amount      = 3000
                );

                // Mar: $500 of expenses with no income = -$500 net
                expenseHelper.mock(
                    userid      = user.getId(),
                    count       = 1,
                    date        = createDate(2026, 3, 10),
                    description = 'Mar expense',
                    categoryid  = 1,
                    amount      = 500
                );

                var event = get(
                    route   = '/api/v1/widgets/incomeWaterfall',
                    headers = {'x-auth-token': jwt},
                    params  = {startDate: '2026-01-01', endDate: '2026-03-31'}
                );

                var segments = event.getResponse().getData().segments;

                expect(segments[1].net).toBe(2000);
                expect(segments[1].runningTotal).toBe(2000);

                expect(segments[2].net).toBe(3000);
                expect(segments[2].runningTotal).toBe(5000);

                expect(segments[3].net).toBe(-500);
                expect(segments[3].runningTotal).toBe(4500);
            });

            it('Produces labels in chronological order matching segments', () => {
                var event = get(
                    route   = '/api/v1/widgets/incomeWaterfall',
                    headers = {'x-auth-token': jwt},
                    params  = {startDate: '2026-01-01', endDate: '2026-04-30'}
                );

                var data = event.getResponse().getData();
                expect(data.labels).toBe(['Jan 2026', 'Feb 2026', 'Mar 2026', 'Apr 2026']);
                expect(data.segments.len()).toBe(data.labels.len());
            });

            it('Excludes data outside the requested date range', () => {
                // Add income outside the range
                incomeHelper.mock(
                    userid      = user.getId(),
                    date        = createDate(2025, 12, 15), // before range
                    description = 'Dec paycheck',
                    amount      = 5000
                );

                incomeHelper.mock(
                    userid      = user.getId(),
                    date        = createDate(2026, 4, 15), // after range
                    description = 'Apr paycheck',
                    amount      = 5000
                );

                incomeHelper.mock(
                    userid      = user.getId(),
                    date        = createDate(2026, 2, 15), // And one inside the range
                    description = 'Feb paycheck',
                    amount      = 1500
                );

                var event = get(
                    route   = '/api/v1/widgets/incomeWaterfall',
                    headers = {'x-auth-token': jwt},
                    params  = {startDate: '2026-01-01', endDate: '2026-03-31'}
                );

                var segments = event.getResponse().getData().segments;
                expect(segments.len()).toBe(3);

                // Only Feb should have income
                expect(segments[1].net).toBe(0);
                expect(segments[2].net).toBe(1500);
                expect(segments[3].net).toBe(0);

                // Running total should not include the out-of-range months
                expect(segments[3].runningTotal).toBe(1500);
            });

            it('Handles decimal amounts correctly', () => {
                incomeHelper.mock(
                    userid      = user.getId(),
                    date        = createDate(2026, 1, 15),
                    description = 'Jan paycheck',
                    amount      = 2697.48
                );

                expenseHelper.mock(
                    userid      = user.getId(),
                    count       = 1,
                    date        = createDate(2026, 1, 20),
                    description = 'Savings transfer',
                    categoryid  = savingsId,
                    amount      = 400.50
                );

                var event = get(
                    route   = '/api/v1/widgets/incomeWaterfall',
                    headers = {'x-auth-token': jwt},
                    params  = {startDate: '2026-01-01', endDate: '2026-01-31'}
                );

                var segments = event.getResponse().getData().segments;
                expect(segments[1].net).toBe(2697.48);
                expect(segments[1].savings).toBe(400.50);
                expect(segments[1].runningTotal).toBe(2697.48);
            });

            it('Aggregates multiple expenses and income entries within a single month', () => {
                incomeHelper.mock(
                    userid      = user.getId(),
                    date        = createDate(2026, 1, 15),
                    description = 'Jan paycheck',
                    amount      = 3000
                );

                expenseHelper.mock(
                    userid      = user.getId(),
                    count       = 4,
                    date        = createDate(2026, 1, 20),
                    description = 'Jan expense',
                    categoryid  = 1,
                    amount      = 200 // 4 x 200 = 800
                );
                expenseHelper.mock(
                    userid      = user.getId(),
                    count       = 2,
                    date        = createDate(2026, 1, 25),
                    description = 'Savings transfer',
                    categoryid  = savingsId,
                    amount      = 150 // 2 x 150 = 300
                );

                var event = get(
                    route   = '/api/v1/widgets/incomeWaterfall',
                    headers = {'x-auth-token': jwt},
                    params  = {startDate: '2026-01-01', endDate: '2026-01-31'}
                );

                var segments = event.getResponse().getData().segments;
                expect(segments[1].net).toBe(2200); // 3000 - 800
                expect(segments[1].savings).toBe(300);
                expect(segments[1].runningTotal).toBe(2200);
            });

            it('Includes months with no activity as zero segments', () => {
                // Only Jan has activity
                incomeHelper.mock(
                    userid      = user.getId(),
                    count       = 1,
                    date        = createDate(2026, 1, 15),
                    description = 'Jan paycheck',
                    amount      = 2000
                );

                var event = get(
                    route   = '/api/v1/widgets/incomeWaterfall',
                    headers = {'x-auth-token': jwt},
                    params  = {startDate: '2026-01-01', endDate: '2026-04-30'}
                );

                var segments = event.getResponse().getData().segments;
                expect(segments.len()).toBe(4);

                expect(segments[1].net).toBe(2000);
                expect(segments[1].runningTotal).toBe(2000);

                // Subsequent months are zero but running total carries forward
                expect(segments[2].net).toBe(0);
                expect(segments[2].savings).toBe(0);
                expect(segments[2].runningTotal).toBe(2000);

                expect(segments[3].runningTotal).toBe(2000);
                expect(segments[4].runningTotal).toBe(2000);
            });

            it('Returns a single segment when start and end are within one month', () => {
                incomeHelper.mock(
                    userid      = user.getId(),
                    count       = 1,
                    date        = createDate(2026, 1, 15),
                    description = 'Jan paycheck',
                    amount      = 1500
                );

                var event = get(
                    route   = '/api/v1/widgets/incomeWaterfall',
                    headers = {'x-auth-token': jwt},
                    params  = {startDate: '2026-01-01', endDate: '2026-01-31'}
                );

                var data = event.getResponse().getData();
                expect(data.segments.len()).toBe(1);
                expect(data.labels).toBe(['Jan 2026']);
                expect(data.segments[1].net).toBe(1500);
            });

            it('Returns 401 when no auth token is provided', () => {
                var event = get(
                    route  = '/api/v1/widgets/incomeWaterfall',
                    params = {startDate: '2026-01-01', endDate: '2026-03-31'}
                );

                expect(event.getResponse().getStatusCode()).toBe(401);
            });

            it('Does not let a user see another user''s data', () => {
                // Create another user with income
                var otherUser = mockUser.make();
                incomeHelper.mock(
                    userid      = otherUser.getId(),
                    count       = 1,
                    date        = createDate(2026, 1, 15),
                    description = 'Other user paycheck',
                    amount      = 9999
                );

                // Our user's window should still be empty
                var event = get(
                    route   = '/api/v1/widgets/incomeWaterfall',
                    headers = {'x-auth-token': jwt},
                    params  = {startDate: '2026-01-01', endDate: '2026-01-31'}
                );

                var segments = event.getResponse().getData().segments;
                expect(segments[1].net).toBe(0);
                expect(segments[1].savings).toBe(0);

                mockUser.delete(otherUser);
            });
        });
    }

}
