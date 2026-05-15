component extends="tests.resources.baseTest" {

    function beforeAll() {
        super.beforeAll();

        categoryService = getInstance('services.category');
        cacheStorage    = getInstance('cachebox:coldboxStorage');
        mockUser        = getInstance('tests.resources.mockuser');

        user = mockUser.make();
        jwt  = mockUser.login(user);

        /**
         * System categories (userid IS NULL) are always visible to every user.
         * Track the count up front so each test can derive the expected totalRecords
         * without querying the DB on every assertion.
         */
        systemCategoryCount = categoryHelper.countSystem();
        totalRecords        = systemCategoryCount;
    }

    function afterAll() {
        super.afterAll();

        mockUser.logout(user, jwt);
        mockUser.delete(user);
    }

    function run() {
        describe('GET /categories', () => {
            beforeEach(() => {
                setup();
            });

            it('Can return paginated pages with the correct counts', () => {
                var n = randRange(10, 19);
                totalRecords += n;

                categoryHelper.mock(userid = user.getId(), count = n);

                // Verify page 1
                var pageSize = 10;
                var event    = get(
                    route   = '/api/v1/categories',
                    headers = {'x-auth-token': jwt},
                    params  = {page: 1, records: pageSize}
                );

                categoryHelper.validateApiResponse(
                    response        = event.getResponse(),
                    recordsReturned = pageSize,
                    totalRecords    = totalRecords,
                    pageSize        = pageSize,
                    page            = 1
                );

                // Verify page 2 returns the next slice
                setup();
                event = get(
                    route   = '/api/v1/categories',
                    headers = {'x-auth-token': jwt},
                    params  = {page: 2, records: pageSize}
                );

                categoryHelper.validateApiResponse(
                    response        = event.getResponse(),
                    recordsReturned = pageSize,
                    totalRecords    = totalRecords,
                    pageSize        = pageSize,
                    page            = 2
                );
            });

            it('Only returns system categories and categories owned by the requesting user', () => {
                // Create a second user and add categories exclusively for them
                var user2      = mockUser.make();
                var user2Count = randRange(5, 9);
                categoryHelper.mock(userid = user2.getId(), count = user2Count);

                // user1 must not see user2's categories - totalRecords is unchanged
                var pageSize = 10;
                var event    = get(
                    route   = '/api/v1/categories',
                    headers = {'x-auth-token': jwt},
                    params  = {page: 1, records: pageSize}
                );

                categoryHelper.validateApiResponse(
                    response        = event.getResponse(),
                    recordsReturned = min(totalRecords, pageSize),
                    totalRecords    = totalRecords,
                    pageSize        = pageSize,
                    page            = 1
                );

                mockUser.delete(user2);
            });

            it('Caches results for requests without a search term', () => {
                var pageSize = 10;
                var cacheKey = 'userid=#user.getId()#|category.paginate|page=1|records=#pageSize#';

                // Ensure cache is empty before the call
                cacheStorage.clearByKeySnippet(keySnippet = 'userid=#user.getId()#|category');
                expect(isNull(cacheStorage.get(cacheKey))).toBeTrue('Cache should be empty before first request');

                // First call - should populate the cache
                get(
                    route   = '/api/v1/categories',
                    headers = {'x-auth-token': jwt},
                    params  = {page: 1, records: pageSize}
                );

                expect(isNull(cacheStorage.get(cacheKey))).toBeFalse('Cache should be populated after a non-search request');

                // Second call with identical params - hits the cache and returns the same response
                setup();
                var event = get(
                    route   = '/api/v1/categories',
                    headers = {'x-auth-token': jwt},
                    params  = {page: 1, records: pageSize}
                );

                categoryHelper.validateApiResponse(
                    response        = event.getResponse(),
                    recordsReturned = min(totalRecords, pageSize),
                    totalRecords    = totalRecords,
                    pageSize        = pageSize,
                    page            = 1
                );
            });

            it('Does not cache results when a search term is provided', () => {
                var pageSize = 10;
                var cacheKey = 'userid=#user.getId()#|category.paginate|page=1|records=#pageSize#';

                // Clear cache then issue a search request
                cacheStorage.clearByKeySnippet(keySnippet = 'userid=#user.getId()#|category');

                get(
                    route   = '/api/v1/categories',
                    headers = {'x-auth-token': jwt},
                    params  = {
                        page   : 1,
                        records: pageSize,
                        search : 'food'
                    }
                );

                // The standard (non-search) cache key must still be absent
                expect(isNull(cacheStorage.get(cacheKey))).toBeTrue('Search requests must not populate the non-search cache key');
            });

            it('Can filter results by search term', () => {
                // Use a UUID-derived prefix that cannot collide with system or pre-existing categories
                var searchPrefix  = 'ZZCat_#left(createUUID().replace('-', '', 'all'), 8)#';
                var uniqueRecords = randRange(5, 9);
                totalRecords += uniqueRecords;

                categoryHelper.mock(
                    userid     = user.getId(),
                    count      = uniqueRecords,
                    namePrefix = searchPrefix
                );

                var pageSize = 10;
                var event    = get(
                    route   = '/api/v1/categories',
                    headers = {'x-auth-token': jwt},
                    params  = {
                        page   : 1,
                        records: pageSize,
                        search : searchPrefix
                    }
                );

                // QB paginate totalRecords reflects the filtered count when search is active
                categoryHelper.validateApiResponse(
                    response        = event.getResponse(),
                    recordsReturned = uniqueRecords,
                    totalRecords    = uniqueRecords,
                    pageSize        = pageSize,
                    page            = 1
                );

                // Verify a non-search request still shows the full un-filtered total
                setup();
                event = get(
                    route   = '/api/v1/categories',
                    headers = {'x-auth-token': jwt},
                    params  = {page: 1, records: pageSize}
                );

                categoryHelper.validateApiResponse(
                    response        = event.getResponse(),
                    recordsReturned = min(pageSize, max(totalRecords, uniqueRecords)),
                    totalRecords    = totalRecords,
                    pageSize        = pageSize,
                    page            = 1
                );
            });
        });
    }

}
