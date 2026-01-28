component extends="tests.resources.baseTest" {

    function beforeAll() {
        super.beforeAll();
        categoryService = getInstance('services.category');
        expenseService  = getInstance('services.expense');
        mockUser        = getInstance('tests.resources.mockuser');

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
        describe('GET /expenses', () => {
            beforeEach(() => {
                setup();
            });

            it('Can return a paginated page with the correct counts', () => {
                // Mock some expense data
                var n = randRange(30, 39);
                totalRecords += n;

                var mock = expenseHelper.mock(
                    userid      = user.getId(),
                    count       = n,
                    date        = now(),
                    description = 'Paginate Test',
                    categoryid  = 1
                );
                rollingTotalSum += mock.sum;

                // Get the first page
                var pageSize = 10;
                var event    = get(
                    route   = '/api/v1/expenses',
                    headers = {'x-auth-token': jwt},
                    params  = {
                        startDate: dateAdd('d', -7, now()),
                        endDate  : now(),
                        page     : 1,
                        records  : pageSize,
                        search   : '',
                        orderCol : '',
                        orderDir : ''
                    }
                );

                // Verify JSON response
                expenseHelper.validateApiResponse(
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
                    route   = '/api/v1/expenses',
                    headers = {'x-auth-token': jwt},
                    params  = {
                        startDate: dateAdd('d', -7, now()),
                        endDate  : now(),
                        page     : 2,
                        records  : pageSize,
                        search   : '',
                        orderCol : '',
                        orderDir : ''
                    }
                );

                // Verify JSON response
                expenseHelper.validateApiResponse(
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

            it('Can filter results by date', () => {
                // Mock expense data for 8 days ago
                var outsideDateRecords = randRange(4, 9);
                totalRecords += outsideDateRecords;

                var mock = expenseHelper.mock(
                    userid      = user.getId(),
                    count       = outsideDateRecords,
                    date        = dateAdd('d', -8, now()),
                    description = 'Paginate Test Outside Date',
                    categoryid  = 1
                );
                var outsideDateSum = mock.sum;
                rollingTotalSum += mock.sum;

                // Get the first page without new records
                var pageSize = 10;
                var event    = get(
                    route   = '/api/v1/expenses',
                    headers = {'x-auth-token': jwt},
                    params  = {
                        startDate: dateAdd('d', -7, now()),
                        endDate  : now(),
                        page     : 1,
                        records  : pageSize,
                        search   : '',
                        orderCol : '',
                        orderDir : ''
                    }
                );

                // Verify JSON response
                // Modifying the dates != filtering
                expenseHelper.validateApiResponse(
                    response        = event.getResponse(),
                    totalSum        = rollingTotalSum - outsideDateSum, // the total sum will be the total minus what we just mocked above
                    filteredSum     = rollingTotalSum - outsideDateSum,
                    recordsReturned = (totalRecords - outsideDateRecords) == 0 ? 0 : pageSize, // check if this test is ran solo
                    totalRecords    = totalRecords - outsideDateRecords, // same thing as total records - we are excluding what we mocked above
                    filteredRecords = totalRecords - outsideDateRecords,
                    pageSize        = pageSize,
                    page            = 1
                );

                // Get the first page with new records only
                event = get(
                    route   = '/api/v1/expenses',
                    headers = {'x-auth-token': jwt},
                    params  = {
                        startDate: dateAdd('d', -15, now()),
                        endDate  : dateAdd('d', -8, now()),
                        page     : 1,
                        records  : pageSize,
                        search   : '',
                        orderCol : '',
                        orderDir : ''
                    }
                );

                // Verify JSON response
                expenseHelper.validateApiResponse(
                    response        = event.getResponse(),
                    totalSum        = outsideDateSum, // The total sum will now only be what we just added
                    filteredSum     = outsideDateSum,
                    recordsReturned = outsideDateRecords,
                    totalRecords    = outsideDateRecords, // same thing as total records - we are excluding what we mocked above
                    filteredRecords = outsideDateRecords,
                    pageSize        = pageSize,
                    page            = 1
                );
            });

            it('Can filter results by search term', () => {
                var uniqueRecords = randRange(15, 30);
                totalRecords += uniqueRecords;

                var searchTerm = 'unique#left(createUUID(), 10)#';
                var mock       = expenseHelper.mock(
                    userid      = user.getId(),
                    count       = uniqueRecords,
                    date        = now(),
                    description = searchTerm,
                    categoryid  = 1
                );
                var uniqueSum = mock.sum;
                rollingTotalSum += mock.sum;

                // Grab first page for search term. This will exclude the previous data
                var pageSize    = 10;
                var searchEvent = get(
                    route   = '/api/v1/expenses',
                    headers = {'x-auth-token': jwt},
                    params  = {
                        startDate: dateAdd('d', -30, now()), // this encapsulates all the date ranges we've used
                        endDate  : now(),
                        page     : 1,
                        records  : pageSize,
                        search   : searchTerm, // filter for just records with the unique description we added
                        orderCol : '',
                        orderDir : ''
                    }
                );

                var searchResponse = searchEvent.getResponse();

                // Verify JSON response
                expenseHelper.validateApiResponse(
                    response        = searchResponse,
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

                var mock = expenseHelper.mock(
                    userid      = user.getId(),
                    count       = categoryRecords,
                    date        = now(),
                    description = 'Paginate Test Category',
                    categoryid  = category.id
                );
                var categorySum = mock.sum;
                rollingTotalSum += mock.sum;

                // Grab first page for category name
                var pageSize     = 10;
                var categoryPage = get(
                    route   = '/api/v1/expenses',
                    headers = {'x-auth-token': jwt},
                    params  = {
                        startDate: dateAdd('d', -30, now()), // this encapsulates all the date ranges we've used
                        endDate  : now(),
                        page     : 1,
                        records  : pageSize,
                        search   : left(category.name, 5), // filter on the category name
                        orderCol : '',
                        orderDir : ''
                    }
                );

                var categoryResponse = categoryPage.getResponse();

                // Verify JSON response
                expenseHelper.validateApiResponse(
                    response        = categoryResponse,
                    totalSum        = rollingTotalSum,
                    filteredSum     = categorySum, // the filter sum will be the just what we've filtered for
                    recordsReturned = categoryRecords, // our category records < pageSize, so we only return this many
                    totalRecords    = totalRecords,
                    filteredRecords = categoryRecords,
                    pageSize        = pageSize,
                    page            = 1
                );
            });
        });
    }

}
