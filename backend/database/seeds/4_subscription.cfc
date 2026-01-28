component extends="base" {

    function run(qb, mockdata) {
        var securityService = getSecurityService();

        var data = [
            {
                'next_charge_date': {value: dateFormat(createDate(2026, 1, 1), 'short'), cfsqltype: 'date'},
                'amount'          : {value: securityService.encryptValue(20.99), cfsqltype: 'varchar'},
                'description'     : 'Gym Membership',
                'receipt'         : '',
                'categoryid'      : 13,
                'userid'          : 2,
                'interval'        : 'M'
            },
            {
                'next_charge_date': {value: dateFormat(createDate(2026, 1, 1), 'short'), cfsqltype: 'date'},
                'amount'          : {value: securityService.encryptValue(300), cfsqltype: 'varchar'},
                'description'     : 'Car Insurance',
                'receipt'         : '',
                'categoryid'      : 3,
                'userid'          : 2,
                'interval'        : 'M'
            },
            {
                'next_charge_date': {value: dateFormat(createDate(2026, 1, 1), 'short'), cfsqltype: 'date'},
                'amount'          : {value: securityService.encryptValue(1000), cfsqltype: 'varchar'},
                'description'     : 'Rent',
                'receipt'         : '',
                'categoryid'      : 24,
                'userid'          : 2,
                'interval'        : 'M'
            },
            {
                'next_charge_date': {value: dateFormat(createDate(2026, 1, 1), 'short'), cfsqltype: 'date'},
                'amount'          : {value: securityService.encryptValue(16), cfsqltype: 'varchar'},
                'description'     : 'Spotify',
                'receipt'         : '',
                'categoryid'      : 1,
                'userid'          : 2,
                'interval'        : 'M'
            }
        ];

        // Insert real looking data for test2

        /**
         * Mock subscription data
         */
        var amount = 5000;
        for(var i = 1; i <= amount; i++) {
            data.append({
                'next_charge_date': {
                    value    : dateFormat(dateAdd('m', randRange(-24, -1), now()), 'short'),
                    cfsqltype: 'date'
                },
                'amount': {
                    value    : securityService.encryptValue(round(randRange(1, 100) + (randRange(1, 99) / 100), 2)),
                    cfsqltype: 'varchar'
                },
                'description': '#i#th subscription',
                'receipt'    : '',
                'categoryid' : randRange(1, 24),
                'userid'     : randRange(3, 6),
                'interval'   : randRange(1, 2) == 1 ? 'Y' : 'M'
            });
        }

        qb.table('subscription').insert(data);
    }

}
