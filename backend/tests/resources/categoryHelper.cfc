component extends="coldbox.system.testing.BaseTestCase" {

    function init() {
        cacheStorage = getInstance('cachebox:coldboxStorage');
        q            = getInstance('provider:QueryBuilder@qb');
    }

    /**
     * Inserts mock category records directly for a given user
     * Returns an array of the inserted category names
     */
    array function mock(
        required numeric userid,
        required numeric count,
        string namePrefix = 'TestCategory'
    ) {
        var names = [];

        for(var i = 1; i <= count; i++) {
            var name = '#namePrefix#_#left(createUUID().replace('-', '', 'all'), 8)#';
            q.from('category')
                .insert({
                    name  : {value: name, cfsqltype: 'varchar'},
                    color : {value: 'AABBCC', cfsqltype: 'varchar'},
                    userid: {value: userid, cfsqltype: 'numeric'}
                });
            names.append(name);
        }

        cacheStorage.clearByKeySnippet(keySnippet = 'userid=#userid#|category');
        return names;
    }

    /**
     * Count categories where userid IS NULL (system-level categories)
     */
    numeric function countSystem() {
        return q
            .from('category')
            .whereNull('userid')
            .count();
    }

    /**
     * Count categories owned by a specific user (excludes system categories)
     */
    numeric function count(required numeric userid) {
        return q
            .from('category')
            .where(
                'userid',
                '=',
                {value: userid, cfsqltype: 'numeric'}
            )
            .count();
    }

    /**
     * Validates the full API response from GET /categories.
     */
    void function validateApiResponse(
        required any response,
        required numeric recordsReturned,
        required numeric totalRecords,
        required numeric pageSize,
        required numeric page
    ) {
        expect(response.getFormat()).toBe('json');
        expect(response.getStatusCode()).toBe(200);
        expect(response.getError()).toBeFalse();

        validateData(dataResponse = response.getData(), recordsReturned = recordsReturned);

        validatePaginate(
            paginateResponse = response.getPagination(),
            totalRecords     = totalRecords,
            pageSize         = pageSize,
            page             = page
        );
    }

    /**
     * Validates the data array returned in the response.
     * Each element should have at minimum an id and name key.
     */
    void function validateData(required array dataResponse, required numeric recordsReturned) {
        expect(dataResponse).toBeArray();
        expect(dataResponse.len()).toBe(
            recordsReturned,
            'Records returned mismatch. Expected: #recordsReturned#, Got: #dataResponse.len()#'
        );

        if(dataResponse.len() > 0) {
            expect(dataResponse[1]).toHaveKey('id');
            expect(dataResponse[1]).toHaveKey('name');
        }
    }

    /**
     * Validates the QB-native pagination struct from getPagination().
     * QB paginate keys: totalRecords, offset, page, maxRows, totalPages.
     */
    void function validatePaginate(
        required struct paginateResponse,
        required numeric totalRecords,
        required numeric pageSize,
        required numeric page
    ) {
        expect(paginateResponse).toHaveKey('totalRecords');
        expect(paginateResponse.totalRecords).toBe(
            totalRecords,
            'Total records mismatch. Expected: #totalRecords#, Got: #paginateResponse.totalRecords#'
        );

        expect(paginateResponse).toHaveKey('offset');
        expect(paginateResponse.offset).toBe(
            pageSize * (page - 1),
            'Offset mismatch. Expected: #pageSize * (page - 1)#, Got: #paginateResponse.offset#'
        );

        expect(paginateResponse).toHaveKey('page');
        expect(paginateResponse.page).toBe(page);
    }

}
