component singleton accessors="true" {

    property name="async"           inject="asyncManager@coldbox";
    property name="cacheStorage"    inject="cachebox:coldboxStorage";
    property name="expenseService"  inject="services.expense";
    property name="maxThreads"      inject="coldbox:setting:maxThreads";
    property name="q"               inject="provider:QueryBuilder@qb";
    property name="securityService" inject="services.security";

    /**
     * Returns pagination data struct and
     * records for the current page
     */
    public struct function paginate(
        required numeric page,
        required numeric records,
        required numeric userid,
        required string search   = '',
        required string orderCol = '',
        required string orderDir = '',
        required string interval = ''
    ) {
        /**
         * Base Query
         */
        var base = q
            .from('subscription')
            .join(
                'category',
                'subscription.categoryid',
                '=',
                'category.id'
            )
            .where('subscription.userid', '=', userid)
            .andWhere((q1) => {
                q1.whereLike(
                        q.raw('lower(subscription.description)'),
                        {value: '%#lCase(search)#%', cfsqltype: 'varchar'}
                    )
                    .orWhereLike(q.raw('lower(category.name)'), {value: '%#lCase(search)#%', cfsqltype: 'varchar'})
            })
            .when(
                condition = interval.len(),
                onTrue    = (q1) => {
                    q1.andWhere('subscription.interval', '=', interval)
                }
            );

        /**
         * Calculated the filtered total subscription sum and the number of records
         */
        var filtered = base
            .select([
                'subscription.id',
                'subscription.active',
                'subscription.amount'
            ])
            .get();
        var filteredRecords = filtered.len();

        /**
         * Perform total info query and data pull query in parallel
         */
        var offset           = (page - 1) * records;
        var asyncFilteredSum = async.newFuture(() => {
            var curr = 0;
            filtered.each((record) => {
                if(!record.active) return;
                curr += securityService.decryptValue(record.amount, 'numeric');
            });
            return securityService.intToFloat(curr);
        });
        var asyncTotalInfo = async.newFuture(() => {
            return getTotalInfo(userid = userid)
        });
        var asyncData = async.newFuture(() => {
            return base
                .when(
                    orderCol.len() && orderDir.len(),
                    (q1) => {
                        q1.orderBy('subscription.active desc, #orderCol# #orderDir#');
                    },
                    (q1) => {
                        q1.orderBy('subscription.active desc, subscription.next_charge_date asc');
                    }
                )
                .limit(records)
                .offset(offset)
                .select([
                    'subscription.id',
                    'subscription.next_charge_date as nextChargeDate',
                    'subscription.amount',
                    'subscription.description',
                    'category.name as category',
                    'subscription.interval',
                    'subscription.active'
                ])
                .get()
                // lucee? pulls 'date' column back as 'timestamp' -> format to remove any timestamp identifier
                .each(
                    (value) => {
                        value.nextChargeDate = dateFormat(value.nextChargeDate, 'yyyy-mm-dd');
                        value.amount         = securityService.intToFloat(securityService.decryptValue(value.amount, 'numeric'));
                    },
                    true,
                    maxThreads
                );
        });

        var results = async
            .newFuture()
            .all(asyncFilteredSum, asyncTotalInfo, asyncData)
            .get();

        var filteredSum = results[1];
        var totalInfo   = results[2];
        var data        = results[3];

        // If sorting by amount, sort the decrypted data
        if(orderCol == 'subscription.amount' && orderDir.len()) {
            data.sort((a, b) => {
                if(a.active && !b.active) return 1;
                if(!a.active && b.active) return -1;
                return orderDir == 'asc' ? compare(a.amount, b.amount) : compare(b.amount, a.amount);
            });
        }

        return {
            pagination: {
                totalRecords   : totalInfo.count,
                filteredRecords: filteredRecords,
                offset         : offset,
                page           : parseNumber(page)
            },
            results: {
                subscriptions: data,
                totalSum     : totalInfo.amount,
                filteredSum  : filteredSum
            }
        };
    }

    /**
     * Get the total active subscription records and the sum of amount
     */
    private struct function getTotalInfo(required numeric userid) {
        var cacheKey = 'userid=#userid#|subscription.getTotalInfo';
        var total    = cacheStorage.get(cacheKey);
        if(isNull(total)) {
            var result = queryExecute(
                '
                select amount
                from subscription
                where userid = :userid
                and active = true
                ',
                {userid: {value: userid, cfsqltype: 'numeric'}}
            );

            // Decrypt and sum amounts
            var totalAmount = 0;
            result.each((row) => {
                totalAmount += securityService.decryptValue(row.amount, 'numeric');
            });

            total = {count: result.recordCount(), amount: securityService.intToFloat(totalAmount)};

            cacheStorage.set(cacheKey, total);
        }
        return total;
    }

    /**
     * Saves a subscription record
     * If the subscription nextChargeDate has passed for the current interval, 
     * 'charge' (create an expense) for each interval passed until now
     */
    public void function save(
        required date nextChargeDate,
        required numeric amount,
        required string description,
        required string interval,
        required numeric categoryid,
        required string receipt,
        required numeric userid
    ) {
        var data = {
            next_charge_date: {value: nextChargeDate, cfsqltype: 'date'},
            amount          : {value: securityService.encryptValue(amount), cfsqltype: 'varchar'},
            description     : {value: description, cfsqltype: 'varchar'},
            interval        : {value: interval, cfsqltype: 'varchar'},
            active          : {value: true, cfsqltype: 'boolean'},
            categoryid      : {value: categoryid, cfsqltype: 'numeric'},
            receipt         : receipt,
            userid          : {value: userid, cfsqltype: 'numeric'}
        };

        var newSubscription = q
            .from('subscription')
            .returning('id')
            .insert(data);

        // If the start date has passed for the current interval, charge for every month/year passed
        if(dateCompare(nextChargeDate, now(), 'd') <= 0) {
            var datePart = getDatePartFromInterval(interval);
            for(var i = 0; i <= dateDiff(datePart, nextChargeDate, now()); i++) {
                charge(subscriptionid = newSubscription.result.id);
            }
        }

        cacheStorage.clearByKeySnippet(keySnippet = 'userid=#userid#|subscription');
        return;
    }

    /**
     * Delete subscription by the supplied id (pk)
     */
    public boolean function delete(required numeric id, required numeric userid) {
        var qResult = q
            .from('subscription')
            .where('id', '=', {value: id, cfsqltype: 'numeric'})
            .andWhere(
                'userid',
                '=',
                {value: userid, cfsqltype: 'numeric'}
            )
            .delete();

        var success = qResult.result.recordCount == 1;

        if(success) {
            // Clear user subscription cache
            cacheStorage.clearByKeySnippet(keySnippet = 'userid=#userid#|subscription');
        }

        return success;
    }

    /**
     * Scheduled task nightly to go through subscriptions and 'charge'
     * aka add record to expense table if they are due for their interval
     */
    public void function charge(numeric subscriptionid = -1) {
        var charges = q
            .from('subscription')
            .where(
                'subscription.next_charge_date',
                '<=',
                {value: now(), cfsqltype: 'date'}
            )
            .when(
                condition = subscriptionid > 0,
                onTrue    = (q1) => {
                    q1.andWhere(
                        'subscription.id',
                        '=',
                        {value: subscriptionid, cfsqltype: 'numeric'}
                    )
                },
                withoutScoping = true
            )
            .select([
                'subscription.id',
                'subscription.next_charge_date',
                'subscription.amount',
                'subscription.description',
                'subscription.categoryid',
                'subscription.receipt',
                'subscription.interval',
                'subscription.userid'
            ])
            .get();

        charges.each(
            (row) => {
                var datePart        = getDatePartFromInterval(row.interval);
                var decryptedAmount = securityService.intToFloat(securityService.decryptValue(row.amount, 'numeric'));
                transaction {
                    try {
                        // Create new expense on next_charge_date
                        expenseService.save(
                            date           = row.next_charge_date,
                            amount         = decryptedAmount,
                            description    = row.description,
                            categoryid     = row.categoryid,
                            receipt        = row.receipt,
                            subscriptionid = row.id,
                            userid         = row.userid
                        );

                        // Update next charge date
                        q.from('subscription')
                            .where('id', '=', {value: row.id, cfsqltype: 'numeric'})
                            .update({next_charge_date: dateAdd(datePart, 1, row.next_charge_date)});
                    }
                    catch(any e) {
                        transactionRollback(e);
                        // audit here
                    }
                }
            },
            true,
            maxThreads
        );

        return;
    }

    /**
     * Return cf date part based on interval
     */
    private string function getDatePartFromInterval(required string interval) {
        if(interval == 'Y') return 'yyyy';
        if(interval == 'M') return 'm';
        return 'd';
    }

    /**
     * Toggles a subscription to active/inactive
     * returns struct {error: t/f, nextChargeDate: date of next charge if updated}
     */
    public struct function toggle(
        required numeric id,
        required boolean active,
        required numeric userid
    ) {
        var result = {error: true};

        var qResult = q
            .from('subscription')
            .returning(['next_charge_date'])
            .where('id', '=', {value: id, cfsqltype: 'numeric'})
            .andWhere(
                'userid',
                '=',
                {value: userid, cfsqltype: 'numeric'}
            )
            .update({active: {value: active, cfsqltype: 'boolean'}});

        var success = qResult.result.recordCount == 1;

        if(success) {
            result.error    = false;
            result.nextDate = dateTimeFormat(qResult.result.next_charge_date, 'iso8601');

            // Clear subscription cache
            cacheStorage.clearByKeySnippet(keySnippet = 'userid=#userid#|subscription');
        }

        return result;
    }

}
