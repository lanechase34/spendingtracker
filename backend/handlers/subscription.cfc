component extends="base" secured="User,Admin" {

    this.allowedMethods = {
        view  : 'GET',
        save  : 'POST',
        remove: 'DELETE',
        toggle: 'PATCH'
    };

    property name="categoryService"     inject="services.category";
    property name="expenseService"      inject="services.expense";
    property name="imageService"        inject="services.image";
    property name="subscriptionService" inject="services.subscription";

    /**
     * Paginated view for subscriptions
     *
     * @rc.page     page num
     * @rc.records  total records to return
     * @rc.search   (optional) search param
     * @rc.orderCol (optional) which col to order
     * @rc.orderDir (optional) order direction
     * @rc.interval (optional) filter for subscription's interval
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
     * Saves a new subscription 
     *
     * @rc.date        subscription starting date
     * @rc.amount      dollar amount
     * @rc.description description
     * @rc.interval    interval which this subscription will charge
     * @rc.categoryid  (required if category empty) the pk of category record
     * @rc.category    (required if categoryid empty) the name for a new category
     * @rc.receipt     (optional) image upload
     * @prc.receipt    (transformed from rc.receipt) valid receipt name or empty string
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
     * @rc.id pk of subscription
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
     * @rc.id     pk of subscription
     * @rc.active t/f
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
