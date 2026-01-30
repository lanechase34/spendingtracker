component extends="coldbox.system.testing.BaseTestCase" {

    function init() {
        q               = getInstance('provider:QueryBuilder@qb');
        securityService = getInstance('services.security');
    }

    /**
     * Create mock of subscription data
     */
    struct function mock(
        required date date,
        required string interval,
        required numeric userid,
        string receipt     = '',
        string description = createUUID()
    ) {
        return {
            date       : date,
            amount     : round(randRange(500, 1000) + (randRange(1, 99) / 100), 2),
            description: description,
            interval   : interval,
            categoryid : randRange(1, 20),
            receipt    : receipt,
            userid     : userid
        };
    }

    /**
     * Bypass front-end and insert subscription record straight to database
     * This avoids firing automatic expense inserts if the subscription was due
     */
    numeric function insert(required struct data, boolean active = true) {
        var userid = data.userid;
        var before = count(userid = userid);

        var insertData = {
            next_charge_date: {value: data.date, cfsqltype: 'date'},
            amount          : {value: securityService.encryptValue(data.amount), cfsqltype: 'varchar'},
            description     : {value: data.description, cfsqltype: 'varchar'},
            interval        : {value: data.interval, cfsqltype: 'varchar'},
            active          : {value: active, cfsqltype: 'boolean'},
            categoryid      : {value: data.categoryid, cfsqltype: 'numeric'},
            receipt         : {value: data.receipt, cfsqltype: 'varchar'},
            userid          : {value: data.userid, cfsqltype: 'numeric'}
        };

        var newSubscription = q
            .from('subscription')
            .returning('id')
            .insert(insertData);

        expect(newSubscription).toHaveKey('result');
        expect(newSubscription.result.id).toBeGT(0);
        expect(count(userid)).toBe(before + 1);
        return newSubscription.result.id
    }

    /**
     * Count number of susbcription records associated with user
     */
    numeric function count(required numeric userid) {
        return q
            .from('subscription')
            .where(
                'subscription.userid',
                '=',
                {value: userid, cfsqltype: 'numeric'}
            )
            .count('id');
    }

    /**
     * Makes fresh slate of the subscriptions table
     */
    void function fresh() {
        q.from('expense')
            .whereNotNull('subscriptionid')
            .delete();
        q.from('subscription').delete();
        return;
    }

    /**
     * Verify an expense was made/not made
     */
    void function verifyExpense(required struct data, required boolean exists = true) {
        var check = q
            .from('expense')
            .where('expense.userid', '=', data.userid)
            .andWhere('expense.description', '=', data.description)
            .andWhere(
                'expense.amount',
                '=',
                {value: securityService.encryptValue(data.amount), cfsqltype: 'varchar'}
            )
            .andWhere(
                'expense.categoryid',
                '=',
                {value: data.categoryid, cfsqltype: 'numeric'}
            )
            .get();

        expect(check).toBeArray();
        if(exists) {
            var count;
            if(data.interval == 'Y') {
                count = dateDiff('yyyy', data.date, now()) + 1;
            }
            else {
                count = dateDiff('m', data.date, now()) + 1;
            }

            expect(check.len()).toBe(
                count,
                'Records mismatch. Expected #count# records but only received #check.len()# records in db'
            );
            check.each((expense) => {
                expect(expense).toBeStruct();
                expect(expense).toHaveKey('id');
                expect(expense.id).toBeGT(0);
                expect(expense).toHaveKey('subscriptionid');

                // Verify the encrypted amount
                expect(securityService.intToFloat(securityService.decryptValue(expense.amount, 'numeric'))).toBe(
                    data.amount
                )
            });
        }
        else {
            expect(check.len()).toBe(0, 'Records created when they should not have');
        }

        return;
    }

    /**
     * Verify a subscription was made/not made
     */
    void function verifySubscription(required struct data, required boolean exists = true) {
        var check = q
            .from('subscription')
            .where('subscription.userid', '=', data.userid)
            // .andWhere(
            //     'subscription.next_charge_date',
            //     '=',
            //     {value: data.date, cfsqltype: 'date'}
            // )
            .andWhere(
                'subscription.description',
                '=',
                data.description
            )
            .andWhere(
                'subscription.amount',
                '=',
                {value: securityService.encryptValue(data.amount), cfsqltype: 'varchar'}
            )
            .andWhere('subscription.interval', '=', data.interval)
            .andWhere(
                'subscription.categoryid',
                '=',
                {value: data.categoryid, cfsqltype: 'numeric'}
            )
            .first();

        expect(check).toBeStruct();
        if(exists) {
            expect(check).toHaveKey('id');
            expect(check.id).toBeGT(0);
        }
        else {
            expect(check.count()).toBe(0);
        }

        return;
    }

    struct function load(required numeric subscriptionid) {
        return q
            .from('subscription')
            .where(
                'id',
                '=',
                {value: subscriptionid, cfsqltype: 'numeric'}
            )
            .first();
    }

    struct function getFromDescription(required string description) {
        return q
            .from('subscription')
            .where(
                'description',
                '=',
                {value: description, cfsqltype: 'varchar'}
            )
            .first();
    }

    array function getExpenses(required numeric subscriptionid) {
        return q
            .from('expense')
            .where(
                'subscriptionid',
                '=',
                {value: subscriptionid, cfsqltype: 'numeric'}
            )
            .select('id')
            .get();
    }

}
