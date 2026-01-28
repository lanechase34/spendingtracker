component singleton accessors="true" {

    property name="cacheStorage" inject="cachebox:coldboxStorage";
    property name="colorService" inject="services.color";
    property name="q"            inject="provider:QueryBuilder@qb";

    /**
     * Saves a category
     * Optional color, auto generates if not provided
     */
    public numeric function save(
        required string name,
        required numeric userid,
        string color = colorService.generateColor()
    ) {
        var newCategory = queryExecute(
            '
            with inserted_row as (
                insert into category (name, color, userid) values (:name, :color, :userid)
                on conflict (name, userid) do nothing
                returning id
            )
            select id from inserted_row
            union all
            select id from category 
                where name = :name and userid = :userid
                and not exists (select 1 from inserted_row)
            ',
            {
                name  : {value: name, cfsqltype: 'varchar'},
                color : {value: color, cfsqltype: 'varchar'},
                userid: {value: userid, cfsqltype: 'numeric'}
            }
        );

        cacheStorage.clearByKeySnippet(keySnippet = 'userid=#userid#|category');
        return newCategory.id;
    }

    /**
     * Return category based on its name
     */
    public struct function getFromName(required string name) {
        return q
            .from('category')
            .where('name', '=', ucFirst(name))
            .first();
    }

    /**
     * Return category based on its id (pk)
     */
    public struct function getFromId(required numeric id) {
        return q
            .from('category')
            .where('id', '=', {value: id, cfsqltype: 'numeric'})
            .first();
    }

    /**
     * Returns pagination data struct and
     * records for the current page
     */
    public struct function paginate(
        required numeric page,
        required numeric records,
        required string search = '',
        required numeric userid
    ) {
        var useCache = !search.len();
        var cacheKey = 'userid=#userid#|category.paginate|page=#page#|records=#records#';

        if(useCache) {
            data = cacheStorage.get(cacheKey);
            if(!isNull(data)) return data;
        }

        var data = q
            .from('category')
            .where((q1) => {
                q1.whereNull('userid')
                    .orWhere(
                        'userid',
                        '=',
                        {value: userid, cfsqltype: 'numeric'}
                    )
            })
            .when(
                condition = search.len(),
                onTrue    = (q1) => {
                    q1.whereLike(q.raw('lower(category.name)'), '%#lCase(search)#%');
                }
            )
            .select(['category.id', 'category.name'])
            .paginate(page = page, maxRows = records);

        if(useCache) {
            cacheStorage.set(cacheKey, data);
        }

        return data;
    }

}
