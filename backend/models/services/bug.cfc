component singleton accessors="true" {

    property name="async"        inject="asyncManager@coldbox";
    property name="cacheStorage" inject="cachebox:coldboxStorage";
    property name="maxThreads"   inject="coldbox:setting:maxThreads";
    property name="q"            inject="provider:QueryBuilder@qb";

    /**
     * Log a new bug
     */
    public void function log(
        required string ip,
        required string urlpath,
        required string method,
        required string agent,
        required string detail,
        required struct stack,
        numeric userid = -1
    ) {
        var jsonStack = serializeJSON(stack);

        var data = {
            ip     : {value: ip, cfsqltype: 'varchar'},
            urlpath: {value: urlpath, cfsqltype: 'varchar'},
            method : {value: method, cfsqltype: 'varchar'},
            agent  : {value: agent, cfsqltype: 'varchar'},
            detail : {value: detail, cfsqltype: 'varchar'},
            stack  : {value: jsonStack, cfsqltype: 'varchar'}
        };

        if(userid > 0) {
            data.userid = {value: userid, cfsqltype: 'numeric'};
        }

        q.from('bug').insert(data);
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
            .from('bug')
            .leftJoin('users', 'bug.userid', '=', 'users.id')
            .whereBetween(
                'bug.created',
                {value: startDate, cfsqltype: 'date'},
                {value: endDate, cfsqltype: 'date'}
            )
            .andWhere((q1) => {
                q1.whereLike(q.raw('lower(bug.urlpath)'), {value: '%#lCase(search)#%', cfsqltype: 'varchar'})
                    .orWhereLike(q.raw('lower(bug.method)'), {value: '%#lCase(search)#%', cfsqltype: 'varchar'})
                    .orWhereLike(q.raw('lower(bug.agent)'), {value: '%#lCase(search)#%', cfsqltype: 'varchar'})
                    .orWhereLike(q.raw('lower(bug.detail)'), {value: '%#lCase(search)#%', cfsqltype: 'varchar'})
                    .orWhereLike(q.raw('lower(bug.ip)'), {value: '%#lCase(search)#%', cfsqltype: 'varchar'})
                    .orWhereLike(q.raw('lower(users.email)'), {value: '%#lCase(search)#%', cfsqltype: 'varchar'})
                    .when(
                        condition = isDate(search),
                        onTrue    = (q2) => {
                            q2.orWhere(
                                'bug.created',
                                '=',
                                {value: search, cfsqltype: 'date'}
                            );
                        },
                        withoutScoping = true
                    );
            });

        /**
         * Total info
         */
        var offset          = (page - 1) * records;
        var filteredRecords = base.count('bug.id');

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
                        q1.orderBy('bug.created', 'desc');
                    }
                )
                .limit(records)
                .offset(offset)
                .select([
                    'bug.id',
                    'bug.created',
                    'bug.ip',
                    'bug.urlpath',
                    'bug.method',
                    'bug.agent',
                    'bug.detail',
                    'bug.stack',
                    'users.email'
                ])
                .get()
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
            results: {bugs: data}
        };
    }

    /**
     * Get the total count of records of bugs in the date range
     */
    private numeric function getTotalRecords(required date startDate, required date endDate) {
        var cacheKey = 'bug.getTotalRecords|startDate=#startDate#|endDate=#endDate#';
        var total    = cacheStorage.get(cacheKey);
        if(isNull(total)) {
            var base = queryExecute(
                '
                select count(id) as count
                from bug
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
