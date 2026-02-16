component singleton accessors="true" {

    property name="async"        inject="asyncManager@coldbox";
    property name="cacheStorage" inject="cachebox:coldboxStorage";
    property name="maxThreads"   inject="coldbox:setting:maxThreads";
    property name="q"            inject="provider:QueryBuilder@qb";

    /**
     * Insert a new audit
     */
    public void function audit(
        required string ip,
        required string urlpath,
        required string method,
        required string agent,
        required string detail,
        numeric statuscode = -1,
        numeric userid     = -1,
        numeric delta      = -1
    ) {
        var data = {
            ip        : {value: ip, cfsqltype: 'varchar'},
            urlpath   : {value: urlpath, cfsqltype: 'varchar'},
            method    : {value: method, cfsqltype: 'varchar'},
            agent     : {value: agent, cfsqltype: 'varchar'},
            detail    : {value: detail, cfsqltype: 'varchar'},
            statuscode: {value: statuscode, cfsqltype: 'numeric'},
            delta     : {value: delta, cfsqltype: 'numeric'}
        };

        if(userid > 0) {
            data.userid = {value: userid, cfsqltype: 'numeric'};
        }

        q.from('audit').insert(data);
        return;
    }

    /**
     * Returns pagination data struct and
     * records for the current page
     */
    public struct function paginate(
        required date startDate,
        required date endDate,
        required numeric userid,
        required numeric page,
        required numeric records,
        required string search   = '',
        required string orderCol = '',
        required string orderDir = ''
    ) {
        /**
         * Base query
         */
        var base = q
            .from('audit')
            .leftJoin('users', 'audit.userid', '=', 'users.id')
            .whereBetween(
                'audit.created',
                {value: startDate, cfsqltype: 'date'},
                {value: endDate, cfsqltype: 'date'}
            )
            .andWhere((q1) => {
                q1.whereLike(q.raw('lower(audit.urlpath)'), {value: '%#lCase(search)#%', cfsqltype: 'varchar'})
                    .orWhereLike(q.raw('lower(audit.method)'), {value: '%#lCase(search)#%', cfsqltype: 'varchar'})
                    .orWhereLike(q.raw('lower(audit.agent)'), {value: '%#lCase(search)#%', cfsqltype: 'varchar'})
                    .orWhereLike(q.raw('lower(audit.detail)'), {value: '%#lCase(search)#%', cfsqltype: 'varchar'})
                    .orWhereLike(q.raw('lower(audit.ip)'), {value: '%#lCase(search)#%', cfsqltype: 'varchar'})
                    .orWhereLike(q.raw('lower(users.email)'), {value: '%#lCase(search)#%', cfsqltype: 'varchar'})
                    .when(
                        condition = isDate(search),
                        onTrue    = (q2) => {
                            q2.orWhere(
                                'audit.created',
                                '=',
                                {value: search, cfsqltype: 'date'}
                            );
                        },
                        withoutScoping = true
                    )
                    .when(
                        condition = isNumeric(search),
                        onTrue    = (q2) => {
                            q2.orWhere(
                                'audit.statuscode',
                                '=',
                                {value: search, cfsqltype: 'numeric'}
                            );
                        },
                        withoutScoping = true
                    );
            });

        /**
         * Total info
         */
        var offset          = (page - 1) * records;
        var filteredRecords = base.count('audit.id');

        var asyncTotal = async.newFuture(() => {
            return getTotalRecords(startDate = startDate, endDate = endDate);
        });

        var asyncData = async.newFuture(() => {
            return base
                .when(
                    orderCol.len() && orderDir.len(),
                    (q1) => {
                        q1.orderBy(orderCol, orderDir);
                    },
                    (q1) => {
                        q1.orderBy('audit.created', 'desc');
                    }
                )
                .limit(records)
                .offset(offset)
                .select([
                    'audit.id',
                    'audit.created',
                    'audit.ip',
                    'audit.urlpath',
                    'audit.method',
                    'audit.agent',
                    'audit.detail',
                    'audit.statuscode',
                    'audit.delta',
                    'users.email'
                ])
                .get()
                // lucee? pulls 'date' column back as 'timestamp' -> format to remove any timestamp identifier
                .each(
                    (value) => {
                        value.created = dateTimeFormat(value.created, 'yyyy-mm-dd HH:mm:ss');
                    },
                    true,
                    maxThreads
                );
        });

        var results = async
            .newFuture()
            .all(asyncTotal, asyncData)
            .get();
        var totalRecords = results[1];
        var data         = results[2];

        return {
            pagination: {
                totalRecords   : totalRecords,
                filteredRecords: filteredRecords,
                offset         : offset,
                page           : parseNumber(page)
            },
            results: {audits: data}
        };
    }

    /**
     * Get the total count of records of audits in the date range
     */
    private numeric function getTotalRecords(required date startDate, required date endDate) {
        var cacheKey = 'audit.getTotalRecords|startDate=#startDate#|endDate=#endDate#';
        var total    = cacheStorage.get(cacheKey);
        if(isNull(total)) {
            var base = queryExecute(
                '
                select count(id) as count
                from audit
                where created between :startDate and :endDate
                ',
                {startDate: {value: startDate, cfsqltype: 'date'}, endDate: {value: endDate, cfsqltype: 'date'}}
            );

            total = base.count;
            cacheStorage.set(cacheKey, total);
        }

        return total;
    }

}
