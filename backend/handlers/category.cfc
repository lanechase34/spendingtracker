component extends="base" secured="User,Admin" {

    this.allowedMethods = {view: 'GET'};

    property name="categoryService" inject="services.category";

    /**
     * Paginated view for categories
     *
     * @rc.page    page num
     * @rc.records total records to return
     * @rc         (optional) search search param
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
            );
    }

}
