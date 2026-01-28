component {

    function run(qb, mockdata) {
        qb.table('category')
            .insert([
                {
                    'name'  : 'user 1 cat',
                    'color' : 'cc52c4',
                    'userid': 1
                },
                {
                    'name'  : 'user 2 cat',
                    'color' : '52afcc',
                    'userid': 2
                }
            ]);
    }

}
