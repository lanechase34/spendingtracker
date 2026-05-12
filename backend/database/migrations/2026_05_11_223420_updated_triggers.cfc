component extends="../base" {

    this.tables = [
        'users',
        'expense',
        'subscription',
        'category',
        'income',
        'audit',
        'bug'
    ];

    function up(schema, qb) {
        // Create a trigger to update the 'updated' column on each update
        queryExecute('
            CREATE OR REPLACE FUNCTION fn_set_updated_timestamp()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql
        ');

        this.tables.each((table) => {
            createUpdateTrigger(table);
        });
    }

    function down(schema, qb) {
        this.tables.each((table) => {
            dropUpdateTrigger(table);
        });

        queryExecute('DROP FUNCTION IF EXISTS fn_set_updated_timestamp');
    }

}
