component extends="base" secured="User,Admin" hint="Income Endpoints" {

    this.allowedMethods = {view: 'GET', save: 'PUT'};

    property name="incomeService" inject="services.income";

    /**
     * View income between start and end dates
     *
     * @rc.startDate income in range from start - end
     * @rc.endDate   end
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
     * Save (upsert) income record for date (YYYY-MM)
     *
     * @rc.date  the YYYY-MM for income record
     * @rc.pay   numeric pay
     * @rc.extra numeric extra
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
