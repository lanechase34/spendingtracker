component {

    // Add TOTP columns to user
    function up(schema, qb) {
        schema.alter('users', (table) => {
            table.addColumn(table.string('totp_secret', 256).nullable());
            table.addColumn(table.boolean('totp_enabled').default(false));
            table.addColumn(table.jsonb('totp_recovery_codes').nullable());
        });
    }

    function down(schema, qb) {
        schema.alter('users', (table) => {
            table.dropColumn('totp_secret');
            table.dropColumn('totp_enabled');
            table.dropColumn('totp_recovery_codes');
        });
    }

}
