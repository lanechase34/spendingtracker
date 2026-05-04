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
     * @summary         List Audits
     * @tags            Admin
     * @security        ApiKeyAuth
     * @hint            Returns a paginated list of audit records, optionally filtered by date range, search, and ordering.
     * @param-startDate { "in": "query", "required": true,  "schema": { "type": "string", "format": "date", "example": "2025-01-01" } }
     * @param-endDate   { "in": "query", "required": true,  "schema": { "type": "string", "format": "date", "example": "2025-12-31" } }
     * @param-page      { "in": "query", "required": true,  "schema": { "type": "integer", "minimum": 1, "example": 1 } }
     * @param-records   { "in": "query", "required": true,  "schema": { "type": "integer", "minimum": 10, "maximum": 100, "example": 25 } }
     * @param-search    { "in": "query", "required": false, "schema": { "type": "string", "maxLength": 50 } }
     * @param-orderCol  { "in": "query", "required": false, "schema": { "type": "string", "enum": ["created","ip","urlpath","method","agent","statuscode","delta","email"] } }
     * @param-orderDir  { "in": "query", "required": false, "schema": { "type": "string", "enum": ["asc","desc"] } }
     * @response-200    { "description": "Paginated audit results" }
     * @response-400    ~errors/400.json
     * @response-401    ~errors/401.json
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
     * @summary         List Bugs
     * @tags            Admin
     * @security        ApiKeyAuth
     * @hint            Returns a paginated list of bug records, optionally filtered by date range, search, and ordering.
     * @param-startDate { "in": "query", "required": true,  "schema": { "type": "string", "format": "date", "example": "2025-01-01" } }
     * @param-endDate   { "in": "query", "required": true,  "schema": { "type": "string", "format": "date", "example": "2025-12-31" } }
     * @param-page      { "in": "query", "required": true,  "schema": { "type": "integer", "minimum": 1, "example": 1 } }
     * @param-records   { "in": "query", "required": true,  "schema": { "type": "integer", "minimum": 10, "maximum": 100, "example": 25 } }
     * @param-search    { "in": "query", "required": false, "schema": { "type": "string", "maxLength": 50 } }
     * @param-orderCol  { "in": "query", "required": false, "schema": { "type": "string", "enum": ["created","ip","urlpath","method","agent","detail","email"] } }
     * @param-orderDir  { "in": "query", "required": false, "schema": { "type": "string", "enum": ["asc","desc"] } }
     * @response-200    { "description": "Paginated bug results" }
     * @response-400    ~errors/400.json
     * @response-401    ~errors/401.json
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
     *
     * @summary      Server Metrics
     * @tags         Admin
     * @security     ApiKeyAuth
     * @hint         Returns current server performance and resource metrics.
     * @response-200 { "description": "Server metrics data" }
     * @response-401 ~errors/401.json
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
     *
     * @summary      Cache Data
     * @tags         Admin
     * @security     ApiKeyAuth
     * @hint         Returns the current state of the application cache.
     * @response-200 { "description": "Cache state data" }
     * @response-401 ~errors/401.json
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
     *
     * @summary      Task Data
     * @tags         Admin
     * @security     ApiKeyAuth
     * @hint         Returns the current state of scheduled and running tasks.
     * @response-200 { "description": "Task state data" }
     * @response-401 ~errors/401.json
     */
    function taskData(event, rc, prc) {
        prc.data = adminService.getTaskData();

        event
            .getResponse()
            .setData(prc.data)
            .setStatusCode(200);
    }

    /**
     * List all available log files
     *
     * @summary      List Log Files
     * @tags         Admin
     * @security     ApiKeyAuth
     * @hint         Returns a list of all available log files with their metadata.
     * @response-200 { "description": "List of log files" }
     * @response-401 ~errors/401.json
     */
    function viewLogs(event, rc, prc) {
        prc.data = adminService.getLogs();

        event
            .getResponse()
            .setData(prc.data.deleteColumn('directory'))
            .setStatusCode(200);
    }

    /**
     * Read the tail of a log file
     *
     * @summary        Read Log File
     * @tags           Admin
     * @security       ApiKeyAuth
     * @hint           Returns the last N lines of a specific log file, optionally filtered by a search string.
     * @param-filename { "in": "path",  "required": true,  "schema": { "type": "string", "example": "coldbox.log" } }
     * @param-lines    { "in": "query", "required": false, "schema": { "type": "integer", "minimum": 1, "maximum": 2000, "example": 200 } }
     * @param-search   { "in": "query", "required": false, "schema": { "type": "string", "example": "ERROR" } }
     * @response-200   { "description": "Log file tail content" }
     * @response-400   ~errors/400.json
     * @response-401   ~errors/401.json
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
