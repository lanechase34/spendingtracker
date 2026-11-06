component {

    // Track when a user's password last changed - tokens issued before this are rejected
    function up(schema, qb) {
        schema.alter('users', (table) => {
            table.addColumn(table.timestampTz('password_changed_at').nullable());
        });
    }

    function down(schema, qb) {
        schema.alter('users', (table) => {
            table.dropColumn('password_changed_at');
        });
    }

}
