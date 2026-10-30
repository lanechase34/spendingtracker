component extends="base" hint="Income Endpoints" secured="User,Admin" {

    this.allowedMethods = {
        view       : 'GET',
        save       : 'PUT',
        viewExtra  : 'GET',
        saveExtra  : 'POST',
        removeExtra: 'DELETE'
    };

    property name="incomeService" inject="services.income";

    /**
     * View income between a date range
     *
     * @summary         View Income
     * @tags            Income
     * @security        ApiKeyAuth
     * @hint            Returns pay and extra income totals for the authenticated user across the full months spanning the given start and end dates.
     * @param-startDate { "in": "query", "required": true, "schema": { "type": "string", "format": "date", "example": "2025-01-01" } }
     * @param-endDate   { "in": "query", "required": true, "schema": { "type": "string", "format": "date", "example": "2025-12-31" } }
     * @response-200    { "description": "Income totals for the given date range. Returns { pay, extra }." }
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
     * @hint         Creates or updates the monthly pay record for the given month.
     * @requestBody  ~income/save/requestBody.json
     * @response-200 { "description": "Income saved successfully." }
     * @response-400 ~errors/400.json
     * @response-401 ~errors/401.json
     */
    function save(event, rc, prc) {
        incomeService.upsert(
            date   = rc.date,
            userid = prc.userid,
            pay    = rc.pay
        );

        event
            .getResponse()
            .setMessages(['Successfully saved income.'])
            .setStatusCode(200);
    }

    /**
     * View extra income entries between a date range
     *
     * @summary         List Extra Income
     * @tags            Income
     * @security        ApiKeyAuth
     * @hint            Returns each extra income entry for the authenticated user across the full months spanning the given start and end dates, newest first.
     * @param-startDate { "in": "query", "required": true, "schema": { "type": "string", "format": "date", "example": "2025-01-01" } }
     * @param-endDate   { "in": "query", "required": true, "schema": { "type": "string", "format": "date", "example": "2025-01-31" } }
     * @response-200    { "description": "Extra income entries. Returns an array of { id, date, amount, description }." }
     * @response-400    ~errors/400.json
     * @response-401    ~errors/401.json
     */
    function viewExtra(event, rc, prc) {
        prc.data = incomeService.getExtra(
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
     * Save a new extra income entry
     *
     * @summary      Save Extra Income
     * @tags         Income
     * @security     [ { "ApiKeyAuth": [], "CSRFToken": [] } ]
     * @hint         Creates a new extra income entry on the given date. A month can have any number of entries.
     * @requestBody  ~income/saveExtra/requestBody.json
     * @response-200 { "description": "Extra income saved successfully. Returns the new entry's id." }
     * @response-400 ~errors/400.json
     * @response-401 ~errors/401.json
     */
    function saveExtra(event, rc, prc) {
        prc.id = incomeService.saveExtra(
            date        = rc.date,
            amount      = rc.amount,
            description = rc.description,
            userid      = prc.userid
        );

        event
            .getResponse()
            .setData({id: prc.id})
            .setMessages(['Successfully saved extra income.'])
            .setStatusCode(200);
    }

    /**
     * Delete an extra income entry
     *
     * @summary      Delete Extra Income
     * @tags         Income
     * @security     [ { "ApiKeyAuth": [], "CSRFToken": [] } ]
     * @hint         Permanently deletes an extra income entry by its ID.
     * @param-id     { "in": "path", "required": true, "schema": { "type": "integer", "minimum": 1, "example": 12 } }
     * @response-200 { "description": "Extra income deleted successfully." }
     * @response-401 ~errors/401.json
     * @response-404 { "description": "Extra income not found." }
     */
    function removeExtra(event, rc, prc) {
        prc.success = incomeService.deleteExtra(id = rc.id, userid = prc.userid);
        if(prc.success) {
            event
                .getResponse()
                .setMessages(['Successfully deleted extra income.'])
                .setStatusCode(200);
        }
        else {
            event
                .getResponse()
                .setErrorMessage('Not found.')
                .setStatusCode(404);
        }
    }

}
