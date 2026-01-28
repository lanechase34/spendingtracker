component {

    function up(schema, qb) {
        schema.alter('income', (table) => {
            table.modifyColumn('pay', table.string('pay', 1024));
            table.modifyColumn('extra', table.string('extra', 1024));
        });

        schema.alter('users', (table) => {
            table.modifyColumn('salary', table.string('salary', 1024));
            table.modifyColumn('monthlytakehome', table.string('monthlytakehome', 1024));
        });

        schema.alter('expense', (table) => {
            table.modifyColumn('amount', table.string('amount', 1024));
        });

        schema.alter('subscription', (table) => {
            table.modifyColumn('amount', table.string('amount', 1024));
        });
    }

    function down(schema, qb) {
    }

}
