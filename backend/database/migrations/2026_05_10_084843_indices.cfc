component {

    function up(schema, qb) {
        // Remove unnecessary indices and add more optimal ones based on query calls

        schema.alter('expense', (table) => {
            table.dropIndex(table.index('id')); // redundant PK already has idx

            // Standalone date index is superseeded by the composite (userid, date)
            table.dropIndex(table.index('date'));
        });

        schema.alter('expense', (table) => {
            // Primary query pattern: WHERE userid = ? AND date BETWEEN ? AND ?
            // A single composite scan replaces separate userid + date lookups
            table.addIndex(['userid', 'date']);

            // // JOIN expense.categoryid = category.id
            table.addIndex('categoryid');
        });

        schema.alter('subscription', (table) => {
            // Subscriptions are queried per-user (active charges, listing)
            table.addIndex('userid');

            // JOIN subscription.categoryid = category.id
            table.addIndex('categoryid');
        });

        schema.alter('audit', (table) => {
            table.dropIndex(table.index('id')); // redundant PK already has idx
        });

        schema.alter('bug', (table) => {
            table.dropIndex(table.index('id')); // redundant PK already has idx
        });
    }

    function down(schema, qb) {
        schema.alter('expense', (table) => {
            table.dropIndex(table.index(['userid', 'date']));
            table.dropIndex(table.index('categoryid'));
        });

        schema.alter('expense', (table) => {
            table.addConstraint(table.index('id'));
            table.addConstraint(table.index('date'));
        });

        schema.alter('subscription', (table) => {
            table.dropIndex(table.index('userid'));
            table.dropIndex(table.index('categoryid'));
        });

        schema.alter('audit', (table) => {
            table.addConstraint(table.index('id'));
        });

        schema.alter('bug', (table) => {
            table.addConstraint(table.index('id'));
        });
    }

}
