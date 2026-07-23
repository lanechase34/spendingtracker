component extends="base" hint="Subscription Endpoints" secured="User,Admin" {

    this.allowedMethods = {
        view  : 'GET',
        save  : 'POST',
        remove: 'DELETE',
        toggle: 'PATCH'
    };

    property name="categoryService"     inject="services.category";
    property name="expenseService"      inject="services.expense";
    property name="subscriptionService" inject="services.subscription";

    /**
     * Paginated view for subscriptions
     *
     * @summary        List Subscriptions
     * @tags           Subscription
     * @security       ApiKeyAuth
     * @hint           Returns a paginated list of subscriptions, optionally filtered by search, ordering, and billing interval.
     * @param-page     { "in": "query", "required": true,  "schema": { "type": "integer", "minimum": 1, "example": 1 } }
     * @param-records  { "in": "query", "required": true,  "schema": { "type": "integer", "minimum": 10, "maximum": 100, "example": 25 } }
     * @param-search   { "in": "query", "required": false, "schema": { "type": "string", "maxLength": 50 } }
     * @param-orderCol { "in": "query", "required": false, "schema": { "type": "string", "enum": ["nextchargedate","amount","description","category"] } }
     * @param-orderDir { "in": "query", "required": false, "schema": { "type": "string", "enum": ["asc","desc"] } }
     * @param-interval { "in": "query", "required": false, "schema": { "type": "string", "enum": ["Y","M",""] }, "description": "Filter by billing interval. Y = Yearly, M = Monthly, blank = all." }
     * @response-200   { "description": "Paginated subscription results." }
     * @response-400   ~errors/400.json
     * @response-401   ~errors/401.json
     */
    function view(event, rc, prc) {
        prc.data = subscriptionService.paginate(
            userid   = prc.userid,
            page     = rc.page,
            records  = rc.records,
            search   = rc?.search ?: '',
            orderCol = rc?.orderCol ?: '',
            orderDir = rc?.orderDir ?: '',
            interval = rc?.interval ?: ''
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
     * Save a new subscription
     *
     * @summary      Save Subscription
     * @tags         Subscription
     * @security     [ { "ApiKeyAuth": [], "CSRFToken": [] } ]
     * @hint         Creates a new subscription record. Interval must be Y (Yearly) or M (Monthly). Provide either categoryid for an existing category or category name to create a new one. Optionally attach a receipt image.
     * @requestBody  ~subscription/save/requestBody.json
     * @response-200 { "description": "Subscription saved successfully." }
     * @response-400 ~errors/400.json
     * @response-401 ~errors/401.json
     */
    function save(event, rc, prc) {
        // Create category if needed
        prc.categoryid = (rc.keyExists('categoryid') && isNumeric(rc.categoryid))
         ? parseNumber(rc.categoryid)
         : categoryService.save(name = ucFirst(rc.category), userid = prc.userid);

        subscriptionService.save(
            nextChargeDate = rc.date,
            amount         = rc.amount,
            description    = rc.description,
            interval       = rc.interval,
            categoryid     = prc.categoryid,
            receipt        = prc.receipt,
            userid         = prc.userid
        );

        event
            .getResponse()
            .setMessages(['Successfully saved subscription.'])
            .setStatusCode(200);
    }

    /**
     * Delete a subscription
     *
     * @summary      Delete Subscription
     * @tags         Subscription
     * @security     [ { "ApiKeyAuth": [], "CSRFToken": [] } ]
     * @hint         Permanently deletes a subscription record by its ID.
     * @param-id     { "in": "path", "required": true, "schema": { "type": "integer", "minimum": 1, "example": 7 } }
     * @response-200 { "description": "Subscription deleted successfully." }
     * @response-401 ~errors/401.json
     * @response-404 { "description": "Subscription not found." }
     */
    function remove(event, rc, prc) {
        prc.success = subscriptionService.delete(id = rc.id, userid = prc.userid);
        if(prc.success) {
            event
                .getResponse()
                .setMessages(['Successfully deleted subscription.'])
                .setStatusCode(200);
        }
        else {
            event
                .getResponse()
                .setErrorMessage('Not found.')
                .setStatusCode(404);
        }
    }

    /**
     * Toggle a subscription's active status
     *
     * @summary      Toggle Subscription
     * @tags         Subscription
     * @security     [ { "ApiKeyAuth": [], "CSRFToken": [] } ]
     * @hint         Activates or deactivates a subscription. Returns the next scheduled charge date when activating.
     * @requestBody  ~subscription/toggle/requestBody.json
     * @response-200 { "description": "Subscription toggled successfully. Returns nextDate when activating." }
     * @response-400 ~errors/400.json
     * @response-401 ~errors/401.json
     * @response-404 { "description": "Subscription not found." }
     */
    function toggle(event, rc, prc) {
        prc.result = subscriptionService.toggle(
            id     = rc.id,
            active = booleanFormat(rc.active),
            userid = prc.userid
        );

        if(!prc.result.error) {
            event
                .getResponse()
                .setData({nextDate: prc.result.nextDate})
                .setMessages(['Successfully #rc.active ? 'activated' : 'inactivated'# subscription.'])
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
