component extends="base" {

    function run(qb, mockdata) {
        var securityService = getSecurityService();

        var data = [
            {
                'date'       : {value: dateFormat(now(), 'short'), cfsqltype: 'date'},
                'amount'     : {value: securityService.encryptValue(100), cfsqltype: 'varchar'},
                'description': '100 encrypted',
                'receipt'    : '',
                'categoryid' : randRange(1, 24),
                'userid'     : 1
            },
            {
                'date'  : {value: dateFormat(now(), 'short'), cfsqltype: 'date'},
                'amount': {
                    value    : securityService.encryptValue(numberFormat(202 + rand(), '0.00')),
                    cfsqltype: 'varchar'
                },
                'description': '202 + rand() encrypted',
                'receipt'    : '',
                'categoryid' : randRange(1, 24),
                'userid'     : 1
            }
        ];

        // Insert real looking data for test2
        var firstDayOfMonth = createDate(year(now()), month(now()), 1);
        var daysInMonth     = daysInMonth(now());

        for(var i = 1; i <= 30; i++) {
            data.append({
                'date': {
                    value    : dateFormat(dateAdd('d', randRange(0, daysInMonth), firstDayOfMonth), 'short'),
                    cfsqltype: 'date'
                },
                'amount': {
                    value    : securityService.encryptValue(round(randRange(1, 100) + (randRange(1, 99) / 100), 2)),
                    cfsqltype: 'varchar'
                },
                'description': '#i#th expense',
                'receipt'    : '',
                'categoryid' : randRange(1, 10),
                'userid'     : 2
            });
        }

        /**
         * Insert mock data for mock users
         */
        var amount = 10000;
        for(var i = 1; i <= amount; i++) {
            data.append({
                'date'  : {value: dateFormat(dateAdd('d', randRange(-180, 180), now()), 'short'), cfsqltype: 'date'},
                'amount': {
                    value    : securityService.encryptValue(numberFormat(randRange(1, 100) + rand(), '0.00')),
                    cfsqltype: 'varchar'
                },
                'description': '#i#th expense',
                'receipt'    : '',
                'categoryid' : randRange(1, 24),
                'userid'     : randRange(3, 6)
            });
        }

        qb.table('expense').insert(data);
    }

}
