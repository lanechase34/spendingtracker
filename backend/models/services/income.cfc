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
            var result = queryExecute(
                '
                SELECT 
                    pay,
                    extra
                FROM income
                WHERE userid = :userid
                AND date BETWEEN :startDate AND :endDate
            ',
                {
                    userid   : {value: userid, cfsqltype: 'numeric'},
                    startDate: {value: formattedStartDate, cfsqltype: 'date'},
                    endDate  : {value: formattedEndDate, cfsqltype: 'date'}
                }
            );

            // Decrypt and sum the amounts
            var totalPay   = 0;
            var totalExtra = 0;

            result.each((row) => {
                totalPay += securityService.decryptValue(row.pay, 'numeric');
                totalExtra += securityService.decryptValue(row.extra, 'numeric');
            });

            total = {pay: securityService.intToFloat(totalPay), extra: securityService.intToFloat(totalExtra)};

            cacheStorage.set(cacheKey, total);
        }

        return total;
    }

    /**
     * Grab list of users that have entered a salary & monthly take home
     * that have not received an income record for this month and enter one for them
     */
    public void function payMonthly(date month) {
        var currMonth = arguments.keyExists('month') && !isNull(month) ? month : createDate(
            year(now()),
            month(now()),
            1
        );

        var users = q
            .from('users')
            .leftJoin('income', (q1) => {
                q1.on('users.id', '=', 'income.userid')
                    .where(
                        'income.date',
                        '=',
                        {value: currMonth, cfsqltype: 'date'}
                    )
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
        required numeric pay,
        numeric extra = 0
    ) {
        q.from('income')
            .insert({
                date  : {value: formatIncomeDate(date), cfsqltype: 'date'},
                userid: {value: userid, cfsqltype: 'numeric'},
                pay   : {value: securityService.encryptValue(pay), cfsqltype: 'varchar'},
                extra : {value: securityService.encryptValue(extra), cfsqltype: 'varchar'}
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
        required numeric pay,
        required numeric extra
    ) {
        queryExecute(
            '
            INSERT INTO income (date, userid, pay, extra)
            VALUES (:date, :userid, :pay, :extra)
            ON CONFLICT (userid, date)
            DO UPDATE SET
                pay = excluded.pay,
                extra = excluded.extra
        ',
            {
                date  : {value: formatIncomeDate(date), cfsqltype: 'date'},
                userid: {value: userid, cfsqltype: 'numeric'},
                pay   : {value: securityService.encryptValue(pay), cfsqltype: 'varchar'},
                extra : {value: securityService.encryptValue(extra), cfsqltype: 'varchar'}
            }
        );

        cacheStorage.clearByKeySnippet(keySnippet = 'userid=#userid#|income');
        return;
    }

}
