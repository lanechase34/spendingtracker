component extends="coldbox.system.testing.BaseTestCase" {

    function init() {
        cacheStorage    = getInstance('cachebox:coldboxStorage');
        q               = getInstance('provider:QueryBuilder@qb');
        securityService = getInstance('services.security');
    }

    /**
     * Inserts multiple mock expense data
     * Returns the ids and sum(amount) for the records mocked
     */
    struct function mock(
        required numeric userid,
        required numeric count,
        required date date,
        required string description,
        required numeric categoryid,
        string receipt = ''
    ) {
        var result = {sum: 0, ids: []};

        for(var i = 1; i <= count; i++) {
            var amount = round(randRange(1, 100) + (randRange(1, 99) / 100), 2);

            var curr = q
                .from('expense')
                .returning('id')
                .insert({
                    date       : {value: date, cfsqltype: 'date'},
                    amount     : {value: securityService.encryptValue(amount), cfsqltype: 'varchar'},
                    description: {value: description, cfsqltype: 'varchar'},
                    categoryid : {value: categoryid, cfsqltype: 'numeric'},
                    receipt    : {value: receipt, cfsqltype: 'varchar'},
                    userid     : {value: userid, cfsqltype: 'numeric'}
                })
                .result
                .id;

            result.ids.append(curr);
            result.sum += amount;
        }

        cacheStorage.clearByKeySnippet(keySnippet = 'userid=#userid#|expense');
        cacheStorage.clearByKeySnippet(keySnippet = 'userid=#userid#|widget');
        return result;
    }

    /**
     * Count number of expenses records attached to user
     */
    numeric function count(required numeric userid) {
        return q
            .from('expense')
            .where('userid', '=', userid)
            .count();
    }

    // Validates Response returned from get(/expenses)
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
        expect(paginateResponse.totalRecords).toBe(totalRecords);

        expect(paginateResponse).toHaveKey('filteredRecords');
        expect(paginateResponse.filteredRecords).toBe(filteredRecords);

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
        expect(dataResponse).toHaveKey('expenses');
        expect(dataResponse.expenses).toBeArray();
        expect(dataResponse.expenses.len()).toBe(recordsReturned);

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
