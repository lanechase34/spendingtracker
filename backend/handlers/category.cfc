component extends="base" hint="Category Endpoints" secured="User,Admin" {

    this.allowedMethods = {view: 'GET'};

    property name="categoryService" inject="services.category";

    /**
     * Paginated list of categories
     *
     * @summary       List Categories
     * @tags          Category
     * @security      ApiKeyAuth
     * @hint          Returns a paginated list of categories, optionally filtered by search.
     * @param-page    { "in": "query", "required": true,  "schema": { "type": "integer", "minimum": 1,   "example": 1  } }
     * @param-records { "in": "query", "required": true,  "schema": { "type": "integer", "minimum": 10,  "maximum": 100, "example": 25 } }
     * @param-search  { "in": "query", "required": false, "schema": { "type": "string",  "maxLength": 50, "example": "electronics" } }
     * @response-200  { "description": "Paginated category results" }
     * @response-400  ~errors/400.json
     * @response-401  ~errors/401.json
     */
    function view(event, rc, prc) {
        prc.data = categoryService.paginate(
            page    = rc.page,
            records = rc.records,
            search  = rc?.search ?: '',
            userid  = prc.userid
        );

        event
            .getResponse()
            .setDataWithPagination(
                data          = prc.data,
                resultsKey    = 'results',
                paginationKey = 'pagination'
            )
            .setStatusCode(200);
    }

}
