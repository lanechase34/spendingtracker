component extends="../base" {

    function run(qb, mockdata) {
        var securityService = getSecurityService();
        var data            = [];

        // Builds a single income_extra row
        var extraRow = (date, amount, description, userid) => {
            return {
                'date'       : {value: dateFormat(date, 'short'), cfsqltype: 'date'},
                'amount'     : {value: securityService.encryptValue(numberFormat(amount, '0.00')), cfsqltype: 'varchar'},
                'description': description,
                'userid'     : userid
            };
        };

        // Random day in the month of @date, never past today
        var randomDayInMonth = (date) => {
            var firstOfMonth = createDate(year(date), month(date), 1);
            var day          = dateAdd(
                'd',
                randRange(0, daysInMonth(firstOfMonth) - 1),
                firstOfMonth
            );
            return dateCompare(day, now(), 'd') > 0 ? now() : day;
        };

        /**
         * Insert real looking data for test1
         * The last 12 months of side income, with a few one-off yearly events
         */
        var recurring = [
            {
                description: 'Freelance web project',
                min        : 250,
                max        : 1200,
                chance     : 50
            },
            {
                description: 'Tutoring',
                min        : 60,
                max        : 240,
                chance     : 60
            },
            {
                description: 'Sold item on Marketplace',
                min        : 15,
                max        : 300,
                chance     : 35
            },
            {
                description: 'Credit card cashback',
                min        : 10,
                max        : 45,
                chance     : 80
            },
            {
                description: 'Savings account interest',
                min        : 5,
                max        : 25,
                chance     : 100
            },
            {
                description: 'Venmo from friend',
                min        : 20,
                max        : 150,
                chance     : 30
            }
        ];

        for(var i = 0; i < 12; i++) {
            var monthDate = dateAdd('m', -i, now());

            recurring.each((source) => {
                if(randRange(1, 100) > source.chance) return;
                data.append(
                    extraRow(
                        randomDayInMonth(monthDate),
                        randRange(source.min, source.max) + (randRange(0, 99) / 100),
                        source.description,
                        1
                    )
                );
            });
        }

        // One-off yearly events
        data.append(
            extraRow(
                randomDayInMonth(dateAdd('m', -2, now())),
                2500,
                'Annual performance bonus',
                1
            )
        );
        data.append(
            extraRow(
                randomDayInMonth(dateAdd('m', -6, now())),
                1342.17,
                'Federal tax refund',
                1
            )
        );
        data.append(
            extraRow(
                randomDayInMonth(dateAdd('m', -6, now())),
                211.50,
                'State tax refund',
                1
            )
        );
        data.append(
            extraRow(
                randomDayInMonth(dateAdd('m', -9, now())),
                100,
                'Birthday gift',
                1
            )
        );

        /**
         * Insert mock data for mock users
         */
        var amount = 200;
        for(var i = 1; i <= amount; i++) {
            data.append(
                extraRow(
                    dateAdd('d', randRange(-180, 180), now()),
                    randRange(1, 500) + rand(),
                    '#i#th extra income',
                    randRange(3, 6)
                )
            );
        }

        qb.table('income_extra').insert(data);
    }

}
