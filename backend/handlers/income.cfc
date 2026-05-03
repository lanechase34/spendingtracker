component extends="base" hint="Income Endpoints" secured="User,Admin" {

    this.allowedMethods = {view: 'GET', save: 'PUT'};

    property name="incomeService" inject="services.income";

    /**
     * View income between a date range
     *
     * @summary         View Income
     * @tags            Income
     * @security        ApiKeyAuth
     * @hint            Returns income totals for the authenticated user between the given start and end dates.
     * @param-startDate { "in": "query", "required": true, "schema": { "type": "string", "format": "date", "example": "2025-01-01" } }
     * @param-endDate   { "in": "query", "required": true, "schema": { "type": "string", "format": "date", "example": "2025-12-31" } }
     * @response-200    { "description": "Income totals for the given date range." }
     * @response-400    ~errors/400.json
     * @response-401    ~errors/401.json
     */
    function view(event, rc, prc) {
        prc.data = incomeService.getTotal(
            startDate = rc.startDate,
            endDate   = rc.endDate,
            userid    = prc.userid
        );

        event
            .getResponse()
            .setData(prc.data)
            .setStatusCode(200);
    }

    /**
     * Save (upsert) an income record
     *
     * @summary      Save Income
     * @tags         Income
     * @security     [ { "ApiKeyAuth": [], "CSRFToken": [] } ]
     * @hint         Creates or updates an income record for the given month.
     * @requestBody  ~income/save/requestBody.json
     * @response-200 { "description": "Income saved successfully." }
     * @response-400 ~errors/400.json
     * @response-401 ~errors/401.json
     */
    function save(event, rc, prc) {
        incomeService.upsert(
            date   = rc.date,
            userid = prc.userid,
            pay    = rc.pay,
            extra  = rc.extra
        );

        event
            .getResponse()
            .setMessages(['Successfully saved income.'])
            .setStatusCode(200);
    }

}
