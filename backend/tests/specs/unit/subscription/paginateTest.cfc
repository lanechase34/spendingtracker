component extends="tests.resources.baseTest" {

    function beforeAll() {
        super.beforeAll();

        categoryService     = getInstance('services.category');
        expenseService      = getInstance('services.expense');
        subscriptionService = getInstance('services.subscription');
        mockUser            = getInstance('tests.resources.mockuser');

        /**
         * Setup user to be shared throughout the test suite
         */
        user = mockUser.make();
        jwt  = mockUser.login(user);

        /**
         * Keep track of the total records and sum
         */
        totalRecords    = 0;
        rollingTotalSum = 0;
    }

    function afterAll() {
        super.afterAll();

        mockUser.logout(user, jwt);
        mockUser.delete(user);
    }

    function run() {
        describe('GET /subscriptions', () => {
            beforeEach(() => {
                setup();
            });

            it('Can return a paginated page with the correct counts', () => {
                var n = randRange(30, 39);
                totalRecords += n;

                var mock = subscriptionHelper.mockMany(
                    userid      = user.getId(),
                    date        = now(),
                    count       = n,
                    description = 'Paginate Test',
                    categoryid  = 1,
                    interval    = 'M',
                    active      = 1
                );
                rollingTotalSum += mock.sum;

                // Get the first page
                var pageSize = 10;
                var event    = get(
                    route   = '/api/v1/subscriptions',
                    headers = {'x-auth-token': jwt},
                    params  = {
                        page    : 1,
                        records : pageSize,
                        search  : '',
                        orderCol: '',
                        orderDir: ''
                    }
                );

                subscriptionHelper.validateApiResponse(
                    response        = event.getResponse(),
                    totalSum        = rollingTotalSum,
                    filteredSum     = rollingTotalSum, // we aren't filtering here, so the filteredSum == totalSum
                    recordsReturned = pageSize,
                    totalRecords    = n,
                    filteredRecords = n, // no filtering so totalRecords=filteredRecords
                    pageSize        = pageSize,
                    page            = 1
                );

                // Get the second page
                event = get(
                    route   = '/api/v1/subscriptions',
                    headers = {'x-auth-token': jwt},
                    params  = {
                        page    : 2,
                        records : pageSize,
                        search  : '',
                        orderCol: '',
                        orderDir: ''
                    }
                );

                subscriptionHelper.validateApiResponse(
                    response        = event.getResponse(),
                    totalSum        = rollingTotalSum,
                    filteredSum     = rollingTotalSum,
                    recordsReturned = pageSize,
                    totalRecords    = n,
                    filteredRecords = n,
                    pageSize        = pageSize,
                    page            = 2
                );
            });

            it('Can filter results by search term', () => {
                var uniqueRecords = randRange(15, 30);
                totalRecords += uniqueRecords;

                var searchTerm = 'unique#left(createUUID(), 10)#';
                var mock       = subscriptionHelper.mockMany(
                    date        = now(),
                    userid      = user.getId(),
                    count       = uniqueRecords,
                    description = searchTerm,
                    categoryid  = 1,
                    interval    = 'M',
                    active      = 1
                );
                var uniqueSum = mock.sum;
                rollingTotalSum += mock.sum;

                var pageSize    = 10;
                var searchEvent = get(
                    route   = '/api/v1/subscriptions',
                    headers = {'x-auth-token': jwt},
                    params  = {
                        page    : 1,
                        records : pageSize,
                        search  : searchTerm,
                        orderCol: '',
                        orderDir: ''
                    }
                );

                subscriptionHelper.validateApiResponse(
                    response        = searchEvent.getResponse(),
                    totalSum        = rollingTotalSum,
                    filteredSum     = uniqueSum, // the filter sum will be the just what we've filtered for
                    recordsReturned = pageSize,
                    totalRecords    = totalRecords,
                    filteredRecords = uniqueRecords, // the filtered records will be the number of records we've added with the filter
                    pageSize        = pageSize,
                    page            = 1
                );
            });

            it('Can filter results by category', () => {
                var category        = categoryService.getFromId(4);
                var categoryRecords = randRange(4, 9);
                totalRecords += categoryRecords;

                var mock = subscriptionHelper.mockMany(
                    date        = now(),
                    userid      = user.getId(),
                    count       = categoryRecords,
                    description = 'Paginate Test Category',
                    categoryid  = category.id,
                    interval    = 'M',
                    active      = 1
                );
                var categorySum = mock.sum;
                rollingTotalSum += mock.sum;

                // Grab first page for category name
                var pageSize     = 10;
                var categoryPage = get(
                    route   = '/api/v1/subscriptions',
                    headers = {'x-auth-token': jwt},
                    params  = {
                        page    : 1,
                        records : pageSize,
                        search  : left(category.name, 5), // filter on the category name
                        orderCol: '',
                        orderDir: ''
                    }
                );

                subscriptionHelper.validateApiResponse(
                    response        = categoryPage.getResponse(),
                    totalSum        = rollingTotalSum,
                    filteredSum     = categorySum, // the filter sum will be the just what we've filtered for
                    recordsReturned = categoryRecords, // our category records < pageSize, so we only return this many
                    totalRecords    = totalRecords,
                    filteredRecords = categoryRecords,
                    pageSize        = pageSize,
                    page            = 1
                );
            });

            it('Can filter results by interval (Y/M)', () => {
                var monthlyRecords = randRange(4, 9);
                var yearlyRecords  = randRange(4, 9);
                totalRecords += monthlyRecords + yearlyRecords;

                var monthlyMock = subscriptionHelper.mockMany(
                    date        = now(),
                    userid      = user.getId(),
                    count       = monthlyRecords,
                    description = 'Interval Test Monthly',
                    categoryid  = 1,
                    interval    = 'M',
                    active      = 1
                );
                rollingTotalSum += monthlyMock.sum;

                var totalMonthlyRecords = totalRecords - yearlyRecords;
                var rollingTotalMonthly = rollingTotalSum; // all mocks up to this point have been M

                var yearlyMock = subscriptionHelper.mockMany(
                    date        = now(),
                    userid      = user.getId(),
                    count       = yearlyRecords,
                    description = 'Interval Test Yearly',
                    categoryid  = 1,
                    interval    = 'Y',
                    active      = 1
                );
                rollingTotalSum += yearlyMock.sum;

                // Filter for monthly only
                var pageSize     = 10;
                var monthlyEvent = get(
                    route   = '/api/v1/subscriptions',
                    headers = {'x-auth-token': jwt},
                    params  = {
                        page    : 1,
                        records : pageSize,
                        search  : '',
                        interval: 'M',
                        orderCol: '',
                        orderDir: ''
                    }
                );

                subscriptionHelper.validateApiResponse(
                    response        = monthlyEvent.getResponse(),
                    totalSum        = rollingTotalSum,
                    filteredSum     = rollingTotalMonthly, // the rolling sum for monthly expenses only
                    recordsReturned = totalMonthlyRecords == monthlyRecords ? monthlyRecords : min(
                        totalMonthlyRecords,
                        10
                    ), // if this suite runs, it's more than 10, but if only this test runs its the num of mocked records
                    totalRecords    = totalRecords,
                    filteredRecords = totalMonthlyRecords,
                    pageSize        = pageSize,
                    page            = 1
                );

                // Filter for yearly only
                var yearlyEvent = get(
                    route   = '/api/v1/subscriptions',
                    headers = {'x-auth-token': jwt},
                    params  = {
                        page    : 1,
                        records : pageSize,
                        search  : '',
                        interval: 'Y',
                        orderCol: '',
                        orderDir: ''
                    }
                );

                subscriptionHelper.validateApiResponse(
                    response        = yearlyEvent.getResponse(),
                    totalSum        = rollingTotalSum,
                    filteredSum     = yearlyMock.sum, // only the yearly mock sum
                    recordsReturned = yearlyRecords,
                    totalRecords    = totalRecords,
                    filteredRecords = yearlyRecords,
                    pageSize        = pageSize,
                    page            = 1
                );
            });
        });
    }

}
