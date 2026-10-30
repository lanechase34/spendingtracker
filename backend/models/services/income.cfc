component singleton accessors="true" {

    property name="cacheStorage"    inject="cachebox:coldboxStorage";
    property name="maxThreads"      inject="coldbox:setting:maxThreads";
    property name="q"               inject="provider:QueryBuilder@qb";
    property name="securityService" inject="services.security";

    /**
     * Formats to the first of the month
     * All monthlyTakeHomes are logged on the first of the month
     */
    public date function formatIncomeDate(required date date) {
        return createDate(year(date), month(date), 1);
    }

    /**
     * Clear every cached income result for the user, along with widgets built from income
     */
    private void function clearIncomeCache(required numeric userid) {
        cacheStorage.clearByKeySnippet(keySnippet = 'userid=#userid#|income');
        cacheStorage.clearByKeySnippet(keySnippet = 'userid=#userid#|widget');
        return;
    }

    /**
     * Get every pay and extra income row for the full months spanning the dates
     * Pay rows are always dated the first of the month, extra rows can fall on any day
     *
     * @return query of type ('pay' | 'extra'), date, amount (encrypted)
     */
    private query function getIncomeRows(
        required date startDate,
        required date endDate,
        required numeric userid
    ) {
        var formattedStartDate = formatIncomeDate(startDate);
        var formattedEndDate   = formatIncomeDate(endDate);

        return queryExecute(
            '
            SELECT
                ''pay'' AS type,
                date,
                pay AS amount
            FROM income
            WHERE userid = :userid
            AND date BETWEEN :startDate AND :endDate

            UNION ALL

            SELECT
                ''extra'' AS type,
                date,
                amount
            FROM income_extra
            WHERE userid = :userid
            AND date >= :startDate
            AND date < :endDateExclusive
        ',
            {
                userid          : {value: userid, cfsqltype: 'numeric'},
                startDate       : {value: formattedStartDate, cfsqltype: 'date'},
                endDate         : {value: formattedEndDate, cfsqltype: 'date'},
                endDateExclusive: {value: dateAdd('m', 1, formattedEndDate), cfsqltype: 'date'}
            }
        );
    }

    /**
     * Get the total income and extra pay amounts between the dates
     */
    public struct function getTotal(
        required date startDate,
        required date endDate,
        required numeric userid
    ) {
        var formattedStartDate = formatIncomeDate(startDate);
        var formattedEndDate   = formatIncomeDate(endDate);

        var cacheKey = 'userid=#userid#|income.getTotal|startDate=#formattedStartDate#|endDate=#formattedEndDate#';
        var total    = cacheStorage.get(cacheKey);
        if(isNull(total)) {
            var result = getIncomeRows(
                startDate = formattedStartDate,
                endDate   = formattedEndDate,
                userid    = userid
            );

            // Decrypt and sum the amounts
            var totals = {pay: 0, extra: 0};
            result.each((row) => {
                totals[row.type] += securityService.decryptValue(row.amount, 'numeric');
            });

            total = {pay: securityService.intToFloat(totals.pay), extra: securityService.intToFloat(totals.extra)};

            cacheStorage.set(cacheKey, total);
        }

        return total;
    }

    /**
     * Grab list of users that have entered a salary & monthly take home
     * that have not received an income record for this month and enter one for them
     */
    public void function payMonthly(date month = createDate(year(now()), month(now()), 1)) {
        var currMonth = arguments.month;

        var users = q
            .from('users')
            .leftJoin('income', (q1) => {
                q1.on('users.id', '=', 'income.userid')
                    .where(
                        'income.date',
                        '=',
                        {value: currMonth, cfsqltype: 'date'}
                    );
            })
            .whereNull('income.id')
            .andWhere(
                'users.verified',
                '=',
                {value: true, cfsqltype: 'boolean'}
            )
            .select([
                'users.id as userid',
                'users.monthlytakehome as monthlyTakeHome'
            ])
            .get();

        users.each(
            (row) => {
                // Decrypt the monthlytakehome
                var toPayMonthly = securityService.intToFloat(
                    securityService.decryptValue(row.monthlyTakeHome, 'numeric')
                );

                pay(
                    date   = currMonth,
                    userid = row.userid,
                    pay    = toPayMonthly
                );
            },
            true,
            maxThreads
        );

        return;
    }

    /**
     * Pay a user's monthlyTakeHome for the given month
     */
    public void function pay(
        required date date,
        required numeric userid,
        required numeric pay
    ) {
        q.from('income')
            .insert({
                date  : {value: formatIncomeDate(date), cfsqltype: 'date'},
                userid: {value: userid, cfsqltype: 'numeric'},
                pay   : {value: securityService.encryptValue(pay), cfsqltype: 'varchar'}
            });
        return;
    }

    /**
     * Updates the income record for the supplied month
     * If no record exists, create one
     */
    public void function upsert(
        required date date,
        required numeric userid,
        required numeric pay
    ) {
        queryExecute(
            '
            INSERT INTO income (date, userid, pay)
            VALUES (:date, :userid, :pay)
            ON CONFLICT (userid, date)
            DO UPDATE SET
                pay = excluded.pay
        ',
            {
                date  : {value: formatIncomeDate(date), cfsqltype: 'date'},
                userid: {value: userid, cfsqltype: 'numeric'},
                pay   : {value: securityService.encryptValue(pay), cfsqltype: 'varchar'}
            }
        );

        clearIncomeCache(userid);
        return;
    }

    /**
     * Get monthly income totals (pay + extra) bucketed by year-month
     *
     * @return struct keyed by 'yyyy-mm' => {pay: numeric, extra: numeric}
     */
    public struct function getMonthlyTotals(
        required date startDate,
        required date endDate,
        required numeric userid
    ) {
        var formattedStartDate = formatIncomeDate(startDate);
        var formattedEndDate   = formatIncomeDate(endDate);

        var cacheKey = 'userid=#userid#|income.getMonthlyTotals|startDate=#formattedStartDate#|endDate=#formattedEndDate#';
        var totals   = cacheStorage.get(cacheKey);
        if(isNull(totals)) {
            var result = getIncomeRows(
                startDate = formattedStartDate,
                endDate   = formattedEndDate,
                userid    = userid
            );

            totals = result
                .reduce((acc, row) => {
                    var bucket = dateFormat(row.date, 'yyyy-mm');
                    if(!acc.keyExists(bucket)) {
                        acc[bucket] = {pay: 0, extra: 0};
                    }
                    acc[bucket][row.type] += securityService.decryptValue(row.amount, 'numeric');
                    return acc;
                }, {})
                .map((bucket, bucketTotals) => {
                    return {
                        pay  : securityService.intToFloat(bucketTotals.pay),
                        extra: securityService.intToFloat(bucketTotals.extra)
                    };
                });

            cacheStorage.set(cacheKey, totals);
        }

        return totals;
    }

    /**
     * Get the individual extra income entries for the full months spanning the dates
     *
     * @return array of {id, date, amount, description} ordered newest first
     */
    public array function getExtra(
        required date startDate,
        required date endDate,
        required numeric userid
    ) {
        var formattedStartDate = formatIncomeDate(startDate);
        var formattedEndDate   = formatIncomeDate(endDate);

        var cacheKey = 'userid=#userid#|income.getExtra|startDate=#formattedStartDate#|endDate=#formattedEndDate#';
        var extras   = cacheStorage.get(cacheKey);
        if(isNull(extras)) {
            var result = q
                .from('income_extra')
                .select(['id', 'date', 'amount', 'description'])
                .where(
                    'userid',
                    '=',
                    {value: userid, cfsqltype: 'numeric'}
                )
                .andWhere(
                    'date',
                    '>=',
                    {value: formattedStartDate, cfsqltype: 'date'}
                )
                .andWhere(
                    'date',
                    '<',
                    {value: dateAdd('m', 1, formattedEndDate), cfsqltype: 'date'}
                )
                .orderBy('date', 'desc')
                .orderBy('id', 'desc')
                .get();

            extras = result.reduce((acc, row) => {
                acc.append({
                    id         : row.id,
                    date       : dateFormat(row.date, 'yyyy-mm-dd'),
                    amount     : securityService.intToFloat(securityService.decryptValue(row.amount, 'numeric')),
                    description: row.description
                });
                return acc;
            }, []);

            cacheStorage.set(cacheKey, extras);
        }

        return extras;
    }

    /**
     * Save a new extra income entry
     *
     * @return the new entry's id (pk)
     */
    public numeric function saveExtra(
        required date date,
        required numeric amount,
        required string description,
        required numeric userid
    ) {
        var qResult = q
            .from('income_extra')
            .returning('id')
            .insert({
                date       : {value: date, cfsqltype: 'date'},
                amount     : {value: securityService.encryptValue(amount), cfsqltype: 'varchar'},
                description: {value: description, cfsqltype: 'varchar'},
                userid     : {value: userid, cfsqltype: 'numeric'}
            });

        clearIncomeCache(userid);
        return val(qResult.result.id);
    }

    /**
     * Delete an extra income entry by the supplied id (pk)
     */
    public boolean function deleteExtra(required numeric id, required numeric userid) {
        var qResult = q
            .from('income_extra')
            .where('id', '=', {value: id, cfsqltype: 'numeric'})
            .andWhere(
                'userid',
                '=',
                {value: userid, cfsqltype: 'numeric'}
            )
            .delete();

        var success = qResult.result.recordCount == 1;

        if(success) {
            clearIncomeCache(userid);
        }

        return success;
    }

}
