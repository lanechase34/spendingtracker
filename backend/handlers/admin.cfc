component extends="base" hint="Admin Endpoints" secured="Admin" {

    this.allowedMethods = {
        viewAudits: 'GET',
        viewBugs  : 'GET',
        metrics   : 'GET',
        cacheData : 'GET',
        taskData  : 'GET',
        viewLogs  : 'GET',
        readLog   : 'GET'
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

    /**
     * List all available log files with metadata
     */
    function viewLogs(event, rc, prc) {
        prc.data = adminService.getLogs();

        event
            .getResponse()
            .setData(prc.data.deleteColumn('directory'))
            .setStatusCode(200);
    }

    /**
     * Read the tail of a specific log file
     *
     * @rc.filename filename of the log file
     * @rc.lines    number of lines to tail (default 200, max 2000)
     * @rc.search   (optional) filter lines containing this string
     */
    function readLog(event, rc, prc) {
        prc.data = adminService.readLog(
            filename = rc.filename,
            lines    = val(rc?.lines ?: 200),
            search   = rc?.search ?: ''
        );

        event
            .getResponse()
            .setData(prc.data)
            .setStatusCode(200);
    }

}
