component extends="coldbox.system.testing.BaseTestCase" {

    function init() {
        cacheStorage    = getInstance('cachebox:coldboxStorage');
        q               = getInstance('provider:QueryBuilder@qb');
        securityService = getInstance('services.security');
    }

    /**
     * Create mock of subscription data
     */
    struct function mock(
        required date date,
        required string interval,
        required numeric userid,
        string receipt     = '',
        string description = createUUID()
    ) {
        return {
            date       : date,
            amount     : round(randRange(500, 1000) + (randRange(1, 99) / 100), 2),
            description: description,
            interval   : interval,
            categoryid : randRange(1, 20),
            receipt    : receipt,
            userid     : userid
        };
    }

    struct function mockMany(
        required date date,
        required string interval,
        required numeric userid,
        string receipt     = '',
        string description = createUUID(),
        numeric categoryid = 1,
        boolean active     = true,
        numeric count      = 1
    ) {
        var result = {sum: 0, ids: []};

        for(var i = 1; i <= count; i++) {
            var amount = round(randRange(1, 100) + (randRange(1, 99) / 100), 2);

            var curr = q
                .from('subscription')
                .returning('id')
                .insert({
                    next_charge_date: {value: date, cfsqltype: 'date'},
                    amount          : {value: securityService.encryptValue(amount), cfsqltype: 'varchar'},
                    description     : {value: description, cfsqltype: 'varchar'},
                    interval        : {value: interval, cfsqltype: 'varchar'},
                    active          : {value: active, cfsqltype: 'boolean'},
                    categoryid      : {value: categoryid, cfsqltype: 'numeric'},
                    receipt         : {value: receipt, cfsqltype: 'varchar'},
                    userid          : {value: userid, cfsqltype: 'numeric'}
                })
                .result
                .id;

            result.ids.append(curr);
            result.sum += amount;
        }

        cacheStorage.clearByKeySnippet(keySnippet = 'userid=#userid#|subscription');
        return result;
    }

    /**
     * Bypass front-end and insert subscription record straight to database
     * This avoids firing automatic expense inserts if the subscription was due
     */
    numeric function insert(required struct data, boolean active = true) {
        var userid = data.userid;
        var before = count(userid = userid);

        var insertData = {
            next_charge_date: {value: data.date, cfsqltype: 'date'},
            amount          : {value: securityService.encryptValue(data.amount), cfsqltype: 'varchar'},
            description     : {value: data.description, cfsqltype: 'varchar'},
            interval        : {value: data.interval, cfsqltype: 'varchar'},
            active          : {value: active, cfsqltype: 'boolean'},
            categoryid      : {value: data.categoryid, cfsqltype: 'numeric'},
            receipt         : {value: data.receipt, cfsqltype: 'varchar'},
            userid          : {value: data.userid, cfsqltype: 'numeric'}
        };

        var newSubscription = q
            .from('subscription')
            .returning('id')
            .insert(insertData);

        expect(newSubscription).toHaveKey('result');
        expect(newSubscription.result.id).toBeGT(0);
        expect(count(userid)).toBe(before + 1);
        return newSubscription.result.id
    }

    /**
     * Count number of susbcription records associated with user
     */
    numeric function count(required numeric userid) {
        return q
            .from('subscription')
            .where(
                'subscription.userid',
                '=',
                {value: userid, cfsqltype: 'numeric'}
            )
            .count('id');
    }

    /**
     * Makes fresh slate of the subscriptions table
     */
    void function fresh() {
        q.from('expense')
            .whereNotNull('subscriptionid')
            .delete();
        q.from('subscription').delete();
        return;
    }

    /**
     * Verify an expense was made/not made
     */
    void function verifyExpense(required struct data, required boolean exists = true) {
        var check = q
            .from('expense')
            .where('expense.userid', '=', data.userid)
            .andWhere('expense.description', '=', data.description)
            .andWhere(
                'expense.amount',
                '=',
                {value: securityService.encryptValue(data.amount), cfsqltype: 'varchar'}
            )
            .andWhere(
                'expense.categoryid',
                '=',
                {value: data.categoryid, cfsqltype: 'numeric'}
            )
            .get();

        expect(check).toBeArray();
        if(exists) {
            var count;
            if(data.interval == 'Y') {
                count = dateDiff('yyyy', data.date, now()) + 1;
            }
            else {
                count = dateDiff('m', data.date, now()) + 1;
            }

            expect(check.len()).toBe(
                count,
                'Records mismatch. Expected #count# records but only received #check.len()# records in db'
            );
            check.each((expense) => {
                expect(expense).toBeStruct();
                expect(expense).toHaveKey('id');
                expect(expense.id).toBeGT(0);
                expect(expense).toHaveKey('subscriptionid');

                // Verify the encrypted amount
                expect(securityService.intToFloat(securityService.decryptValue(expense.amount, 'numeric'))).toBe(
                    data.amount
                )
            });
        }
        else {
            expect(check.len()).toBe(0, 'Records created when they should not have');
        }

        return;
    }

    /**
     * Verify a subscription was made/not made
     */
    void function verifySubscription(required struct data, required boolean exists = true) {
        var check = q
            .from('subscription')
            .where('subscription.userid', '=', data.userid)
            // .andWhere(
            //     'subscription.next_charge_date',
            //     '=',
            //     {value: data.date, cfsqltype: 'date'}
            // )
            .andWhere(
                'subscription.description',
                '=',
                data.description
            )
            .andWhere(
                'subscription.amount',
                '=',
                {value: securityService.encryptValue(data.amount), cfsqltype: 'varchar'}
            )
            .andWhere('subscription.interval', '=', data.interval)
            .andWhere(
                'subscription.categoryid',
                '=',
                {value: data.categoryid, cfsqltype: 'numeric'}
            )
            .first();

        expect(check).toBeStruct();
        if(exists) {
            expect(check).toHaveKey('id');
            expect(check.id).toBeGT(0);
        }
        else {
            expect(check.count()).toBe(0);
        }

        return;
    }

    struct function load(required numeric subscriptionid) {
        return q
            .from('subscription')
            .where(
                'id',
                '=',
                {value: subscriptionid, cfsqltype: 'numeric'}
            )
            .first();
    }

    struct function getFromDescription(required string description) {
        return q
            .from('subscription')
            .where(
                'description',
                '=',
                {value: description, cfsqltype: 'varchar'}
            )
            .first();
    }

    array function getExpenses(required numeric subscriptionid) {
        return q
            .from('expense')
            .where(
                'subscriptionid',
                '=',
                {value: subscriptionid, cfsqltype: 'numeric'}
            )
            .select('id')
            .get();
    }

    // Create a subscriptionService component where the charge() function
    // will throw an error on the first charge attempt
    component function createBrokenChargeMock() {
        // Create a real instance with a mocked broken expense service
        var subscriptionServiceObj  = new models.services.subscription();
        var mockSubscriptionService = prepareMock(object = subscriptionServiceObj);

        // Manually wire up all dependencies
        mockSubscriptionService.setQ(getInstance('provider:QueryBuilder@qb'));
        mockSubscriptionService.setSecurityService(getInstance('services.security'));
        mockSubscriptionService.setAuditService(getInstance('services.audit'));
        mockSubscriptionService.setCacheStorage(getInstance('cachebox:coldboxStorage'));
        mockSubscriptionService.setAsync(getInstance('asyncManager@coldbox'));
        mockSubscriptionService.setMaxThreads(0);

        // Wire in the mock broken expense service
        var mockExpenseService = createObject('component', 'tests.resources.brokenExpenseService');
        mockSubscriptionService.setExpenseService(mockExpenseService);

        return mockSubscriptionService;
    }

    numeric function countSubscriptionAudits() {
        return queryExecute('
            SELECT COUNT(id) AS count
            FROM audit
            WHERE urlpath LIKE ''%subscriptionService.%''
        ').count;
    }

    // Validates Response returned from get(/subscriptions)
    void function validateApiResponse(
        required any response,
        // data response
        required numeric totalSum,
        required numeric filteredSum,
        required numeric recordsReturned,
        // pagination response
        required numeric totalRecords,
        required numeric filteredRecords,
        required numeric pageSize,
        required numeric page
    ) {
        expect(response.getFormat()).toBe('json');
        expect(response.getStatusCode()).toBe(200);
        expect(response.getError()).toBeFalse();

        var data = response.getData();
        validateData(
            dataResponse    = data,
            totalSum        = totalSum,
            filteredSum     = filteredSum,
            recordsReturned = recordsReturned
        );

        var pagination = response.getPagination();
        validatePaginate(
            paginateResponse = pagination,
            totalRecords     = totalRecords,
            filteredRecords  = filteredRecords,
            pageSize         = pageSize,
            page             = page
        );
    }

    /**
     * The api response contains a pagination struct with the following keys
     * totalRecords
     * filteredRecords
     * page
     * offset
     *
     * Validates this is a legitimate response from api
     *
     * @result The api pagination response
     */
    void function validatePaginate(
        required struct paginateResponse,
        required numeric totalRecords,
        required numeric filteredRecords,
        required numeric pageSize,
        required numeric page
    ) {
        expect(paginateResponse).toHaveKey('totalRecords');
        expect(paginateResponse.totalRecords).toBe(
            totalRecords,
            'Total records mismatch. Expected: #totalRecords#, Got: #paginateResponse.totalRecords#'
        );

        expect(paginateResponse).toHaveKey('filteredRecords');
        expect(paginateResponse.filteredRecords).toBe(
            filteredRecords,
            'Filtered records mismatch. Expected: #filteredRecords#, Got: #paginateResponse.filteredRecords#'
        );

        expect(paginateResponse).toHaveKey('offset');
        expect(paginateResponse.offset).toBe(pageSize * (page - 1));

        expect(paginateResponse).toHaveKey('page');
        expect(paginateResponse.page).toBe(page);
    }

    /**
     * The api response contains a data struct with the following keys
     * totalSum
     * filteredSum
     * expense[] array of expense records
     *
     * Validates this is a legitimate response from api
     *
     * @result the api data response
     */
    void function validateData(
        required struct dataResponse,
        required numeric totalSum,
        required numeric filteredSum,
        required numeric recordsReturned
    ) {
        expect(dataResponse).toHaveKey('subscriptions');
        expect(dataResponse.subscriptions).toBeArray();
        expect(dataResponse.subscriptions.len()).toBe(
            recordsReturned,
            'Records returned mismatch. Expected: #recordsReturned#, Got: #dataResponse.subscriptions.len()#'
        );

        expect(dataResponse).toHaveKey('totalSum');
        expect(dataResponse.totalSum).toBe(
            totalSum,
            'Total sum mismatch. Expected: #totalSum#, Got: #dataResponse.totalSum#'
        );

        expect(dataResponse).toHaveKey('filteredSum');
        expect(dataResponse.filteredSum).toBe(
            filteredSum,
            'Filtered sum mismatch. Expected: #filteredSum#, Got: #dataResponse.filteredSum#'
        );
    }

}
