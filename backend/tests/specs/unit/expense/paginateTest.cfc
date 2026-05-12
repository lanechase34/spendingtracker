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

            it('Can sort results by amount correctly', () => {
                // Mock expenses with known amounts so we can verify sort order
                // Store the largest and smallest amounts
                var amounts = [
                    500,
                    150,
                    999,
                    75,
                    320,
                    840,
                    210,
                    625,
                    45,
                    780,
                    999.99,
                    0.01,
                    0.25,
                    1000.01,
                    999999.99
                ];
                var mockSum = 0;

                amounts.each((amount) => {
                    var mock = expenseHelper.mock(
                        userid      = user.getId(),
                        count       = 1,
                        date        = now(),
                        description = 'Sort Test #amount#',
                        categoryid  = 1,
                        amount      = amount
                    );

                    totalRecords += 1;
                    rollingTotalSum += amount;
                    mockSum += amount;
                });

                // Test ascending sort - all on single page
                var ascPage = get(
                    route   = '/api/v1/expenses',
                    headers = {'x-auth-token': jwt},
                    params  = {
                        startDate: dateAdd('d', -30, now()),
                        endDate  : now(),
                        page     : 1,
                        records  : 100,
                        search   : 'Sort Test',
                        orderCol : 'amount',
                        orderDir : 'asc'
                    }
                );

                var ascResponse = ascPage.getResponse();

                // Verify JSON response
                expenseHelper.validateApiResponse(
                    response        = ascResponse,
                    totalSum        = rollingTotalSum,
                    filteredSum     = mockSum,
                    recordsReturned = amounts.len(),
                    totalRecords    = totalRecords,
                    filteredRecords = amounts.len(),
                    pageSize        = 100,
                    page            = 1
                );

                // Verify each record is <= the next (ascending order)
                var ascExpenses = ascResponse.getData().expenses;
                for(var i = 1; i < ascExpenses.len(); i++) {
                    expect(ascExpenses[i].amount).toBeLTE(ascExpenses[i + 1].amount);
                }

                // The first record should be the smallest amount (0.01)
                expect(ascExpenses[1].amount).toBe(0.01);

                // Test descending sort - split across multiple pages
                setup();
                var descPage = get(
                    route   = '/api/v1/expenses',
                    headers = {'x-auth-token': jwt},
                    params  = {
                        startDate: dateAdd('d', -30, now()),
                        endDate  : now(),
                        page     : 1,
                        records  : 10,
                        search   : 'Sort Test',
                        orderCol : 'amount',
                        orderDir : 'desc'
                    }
                );

                var descResponse = descPage.getResponse();

                // Verify JSON response
                expenseHelper.validateApiResponse(
                    response        = descResponse,
                    totalSum        = rollingTotalSum,
                    filteredSum     = mockSum,
                    recordsReturned = 10, // amounts.len() > 10
                    totalRecords    = totalRecords,
                    filteredRecords = amounts.len(),
                    pageSize        = 10,
                    page            = 1
                );

                // Verify each record is >= the next (descending order)
                var descExpenses = descResponse.getData().expenses;
                for(var i = 1; i < descExpenses.len(); i++) {
                    expect(descExpenses[i].amount).toBeGTE(descExpenses[i + 1].amount);
                }

                // The first record should be the largest amount (999999.99)
                expect(descExpenses[1].amount).toBe(999999.99);

                // Verify page 2 continues the descending sort correctly
                setup();
                var descPage2 = get(
                    route   = '/api/v1/expenses',
                    headers = {'x-auth-token': jwt},
                    params  = {
                        startDate: dateAdd('d', -30, now()),
                        endDate  : now(),
                        page     : 2,
                        records  : 10,
                        search   : 'Sort Test',
                        orderCol : 'amount',
                        orderDir : 'desc'
                    }
                );

                var descResponse2 = descPage2.getResponse();

                expenseHelper.validateApiResponse(
                    response        = descResponse2,
                    totalSum        = rollingTotalSum,
                    filteredSum     = mockSum,
                    recordsReturned = amounts.len() - 10, // remaining records after page 1
                    totalRecords    = totalRecords,
                    filteredRecords = amounts.len(),
                    pageSize        = 10,
                    page            = 2
                );

                // Verify the first record of page 2 is less than the last record of page 1
                var descExpenses2 = descResponse2.getData().expenses;
                expect(descExpenses2[1].amount).toBeLT(descExpenses[descExpenses.len()].amount);

                // Verify page 2 is also internally sorted descending
                for(var i = 1; i < descExpenses2.len(); i++) {
                    expect(descExpenses2[i].amount).toBeGTE(descExpenses2[i + 1].amount);
                }
            });

            it('Returns an empty result set when page outside the number of records for user', () => {
                var pageSize = 10;

                var event = get(
                    route   = '/api/v1/expenses',
                    headers = {'x-auth-token': jwt},
                    params  = {
                        startDate: dateAdd('d', -30, now()),
                        endDate  : now(),
                        page     : 100, // page far out of the last expense saved
                        records  : pageSize,
                        search   : '',
                        orderCol : '', // no ordering
                        orderDir : ''
                    }
                );

                // Verify JSON response
                expenseHelper.validateApiResponse(
                    response        = event.getResponse(),
                    totalSum        = rollingTotalSum,
                    filteredSum     = rollingTotalSum, // we aren't filtering here, so the filteredSum == totalSum
                    recordsReturned = 0,
                    totalRecords    = totalRecords,
                    filteredRecords = totalRecords, // no filtering so totalRecords=filteredRecords
                    pageSize        = pageSize,
                    page            = 100
                );

                // Get another page ordering by amount (calls arraySlice)
                event = get(
                    route   = '/api/v1/expenses',
                    headers = {'x-auth-token': jwt},
                    params  = {
                        startDate: dateAdd('d', -30, now()),
                        endDate  : now(),
                        page     : 100, // page far out of the last expense saved
                        records  : pageSize,
                        search   : '',
                        orderCol : 'amount',
                        orderDir : 'asc'
                    }
                );

                // Verify JSON response
                expenseHelper.validateApiResponse(
                    response        = event.getResponse(),
                    totalSum        = rollingTotalSum,
                    filteredSum     = rollingTotalSum,
                    recordsReturned = 0,
                    totalRecords    = totalRecords,
                    filteredRecords = totalRecords,
                    pageSize        = pageSize,
                    page            = 100
                );
            });
        });
    }

}
