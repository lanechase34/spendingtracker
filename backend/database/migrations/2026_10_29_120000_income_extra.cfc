component extends="../base" {

    /**
     * Move 'extra' income out of the single per-month income column into its own table
     * so a user can log multiple extra income entries (amount + description) on any date in a month
     *
     * income       -> one row per user per month, holds the scheduled monthly pay only
     * income_extra -> many rows per user, each an individual extra income entry
     */
    function up(schema, qb) {
        schema.create('income_extra', (table) => {
            // Base
            table.increments('id');
            table.timestampTz('created').withCurrent();
            table.timestampTz('updated').withCurrent();

            // Cols
            table.date('date');
            table.string('amount', 1024); // encrypted
            table.string('description', 500);

            // FK
            table.unsignedInteger('userid');
        });

        schema.alter('income_extra', (table) => {
            table.addConstraint(
                table
                    .foreignKey('userid')
                    .references('id')
                    .onTable('users')
            );

            // Primary query pattern: WHERE userid = ? AND date >= ? AND date < ?
            table.addIndex(['userid', 'date']);
        });

        createUpdateTrigger('income_extra');

        // Carry over existing non-zero extra amounts, dated on the first of their month
        var securityService = getSecurityService();
        var incomeRows      = queryExecute('SELECT userid, date, extra FROM income WHERE extra IS NOT NULL');

        incomeRows.each((row) => {
            if(securityService.decryptValue(row.extra, 'numeric') <= 0) return;

            queryExecute(
                '
                INSERT INTO income_extra (date, amount, description, userid)
                VALUES (:date, :amount, :description, :userid)
            ',
                {
                    date       : {value: row.date, cfsqltype: 'date'},
                    amount     : {value: row.extra, cfsqltype: 'varchar'}, // already encrypted with the same key
                    description: {value: 'Extra income', cfsqltype: 'varchar'},
                    userid     : {value: row.userid, cfsqltype: 'numeric'}
                }
            );
        });

        schema.alter('income', (table) => {
            table.dropColumn('extra');
        });
    }

    function down(schema, qb) {
        var securityService = getSecurityService();

        schema.alter('income', (table) => {
            table.addColumn(table.string('extra', 1024).nullable());
        });

        // Roll extra entries back up into a single total per user per month (cents)
        var extraRows = queryExecute('SELECT userid, date, amount FROM income_extra');
        var totals    = extraRows.reduce((acc, row) => {
            var key = '#row.userid#|#dateFormat(row.date, 'yyyy-mm')#';
            if(!acc.keyExists(key)) {
                acc[key] = {
                    userid: row.userid,
                    date  : createDate(year(row.date), month(row.date), 1),
                    cents : 0
                };
            }
            acc[key].cents += securityService.decryptValue(row.amount, 'numeric');
            return acc;
        }, {});

        totals.each((key, total) => {
            // Insert a $0 pay row if the month has extras but no pay record so no data is lost
            queryExecute(
                '
                INSERT INTO income (date, userid, pay, extra)
                VALUES (:date, :userid, :pay, :extra)
                ON CONFLICT (userid, date)
                DO UPDATE SET extra = excluded.extra
            ',
                {
                    date  : {value: total.date, cfsqltype: 'date'},
                    userid: {value: total.userid, cfsqltype: 'numeric'},
                    pay   : {value: securityService.encryptValue(0), cfsqltype: 'varchar'},
                    extra : {
                        value    : securityService.encryptValue(securityService.intToFloat(total.cents)),
                        cfsqltype: 'varchar'
                    }
                }
            );
        });

        queryExecute(
            'UPDATE income SET extra = :zero WHERE extra IS NULL',
            {zero: {value: securityService.encryptValue(0), cfsqltype: 'varchar'}}
        );

        dropUpdateTrigger('income_extra');
        schema.drop('income_extra');
    }

}
