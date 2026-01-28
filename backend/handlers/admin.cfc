component extends="base" secured="Admin" {

    this.allowedMethods = {
        viewAudits: 'GET',
        viewBugs  : 'GET',
        metrics   : 'GET',
        cacheData : 'GET',
        taskData  : 'GET'
    };

    property name="adminService" inject="services.admin";
    property name="auditService" inject="services.audit";
    property name="bugService"   inject="services.bug";

    /**
     * Paginated view for audits
     *
     * @rc.startDate get records in range from start - end
     * @rc.endDate   end                                     
     * @rc.page      page num
     * @rc.records   total records to return
     * @rc.search    (optional) search param
     * @rc.orderCol  (optional) which col to order
     * @rc.orderDir  (optional) order direction
     */
    function viewAudits(event, rc, prc) {
        prc.data = auditService.paginate(
            startDate = rc.startDate,
            endDate   = rc.endDate,
            userid    = prc.userid,
            page      = rc.page,
            records   = rc.records,
            search    = rc?.search ?: '',
            orderCol  = rc?.orderCol ?: '',
            orderDir  = rc?.orderDir ?: ''
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

    /**
     * Paginated view for bugs
     *
     * @rc.startDate get records in range from start - end
     * @rc.endDate   end                                     
     * @rc.page      page num
     * @rc.records   total records to return
     * @rc.search    (optional) search param
     * @rc.orderCol  (optional) which col to order
     * @rc.orderDir  (optional) order direction
     */
    function viewBugs(event, rc, prc) {
        prc.data = bugService.paginate(
            startDate = rc.startDate,
            endDate   = rc.endDate,
            userid    = prc.userid,
            page      = rc.page,
            records   = rc.records,
            search    = rc?.search ?: '',
            orderCol  = rc?.orderCol ?: '',
            orderDir  = rc?.orderDir ?: ''
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

    /**
     * Get server metrics
     */
    function metrics(event, rc, prc) {
        prc.data = adminService.getMetrics();

        event
            .getResponse()
            .setData(prc.data)
            .setStatusCode(200);
    }

    /**
     * Get current cache state
     */
    function cacheData(event, rc, prc) {
        prc.data = adminService.getCacheData();

        event
            .getResponse()
            .setData(prc.data)
            .setStatusCode(200);
    }

    /**
     * Get current task data
     */
    function taskData(event, rc, prc) {
        prc.data = adminService.getTaskData();

        event
            .getResponse()
            .setData(prc.data)
            .setStatusCode(200);
    }

}
