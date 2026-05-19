component extends="coldbox.system.testing.BaseTestCase" {

    function init() {
        cacheStorage    = getInstance('cachebox:coldboxStorage');
        incomeService   = getInstance('services.income');
        q               = getInstance('provider:QueryBuilder@qb');
        securityService = getInstance('services.security');
    }

    /**
     * Inserts multiple mock income records
     *
     * Income records are stored at the first of the month (see income.formatIncomeDate),
     * so all `count` records inserted for the same date will land in the same month bucket.
     *
     * Returns the ids and the totals for the records mocked
     *
     *              (>= 0) and `pay` was not explicitly set, this value is used for pay.
     *
     * @userid      The user the income belongs to
     * @count       How many income rows to insert
     * @date        Any date in the target month - will be normalized to the first of the month
     * @description Unused in the income table; accepted for parity with expenseHelper
     * @pay         Pay amount per row. If -1, a random amount is generated
     * @extra       Extra pay amount per row. Defaults to 0
     * @amount      Convenience alias for `pay` to mirror expenseHelper.mock(). If provided
     */
    struct function mock(
        required numeric userid,
        required date date,
        string description = '',
        numeric pay        = -1,
        numeric extra      = 0,
        numeric amount     = -1
    ) {
        var result = {
            sum     : 0, // total pay + extra inserted
            paySum  : 0,
            extraSum: 0,
            ids     : []
        };

        // Allow `amount` as an alias for `pay` so callers can use the same shape
        // they use with expenseHelper.mock()
        var resolvedPay = pay;
        if(resolvedPay < 0 && amount >= 0) {
            resolvedPay = amount;
        }

        var incomeDate = incomeService.formatIncomeDate(date);

        var payAmount   = resolvedPay < 0 ? round(randRange(1000, 5000) + (randRange(1, 99) / 100), 2) : resolvedPay;
        var extraAmount = extra;

        var curr = q
            .from('income')
            .returning('id')
            .insert({
                date  : {value: incomeDate, cfsqltype: 'date'},
                userid: {value: userid, cfsqltype: 'numeric'},
                pay   : {value: securityService.encryptValue(payAmount), cfsqltype: 'varchar'},
                extra : {value: securityService.encryptValue(extraAmount), cfsqltype: 'varchar'}
            })
            .result
            .id;

        result.ids.append(curr);
        result.paySum += payAmount;
        result.extraSum += extraAmount;
        result.sum += (payAmount + extraAmount);

        cacheStorage.clearByKeySnippet(keySnippet = 'userid=#userid#|income');
        cacheStorage.clearByKeySnippet(keySnippet = 'userid=#userid#|widget');
        return result;
    }

}
