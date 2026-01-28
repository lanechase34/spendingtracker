component {

    function up(schema, qb) {
        schema.create('users', (table) => {
            // Base
            table.increments('id');
            table.timestampTz('created').withCurrent();
            table.timestampTz('updated').withCurrent();

            // Cols
            table.string('email', 255).unique();
            table.string('password', 256);
            table.timestampTz('lastlogin').nullable();
            table.smallInteger('security_level', 2).default(0);
            table.boolean('verified').default(false);
            table.string('verificationcode', 256).nullable();
            table.timestamp('verificationsentdate').nullable();
            table.string('resetcode', 256).nullable();
            table.timestamp('resetsentdate').nullable();
            table.jsonb('settings').default('''{}''');

            table.decimal(name = 'salary', length = 7, precision = 0);
            table.decimal(
                name      = 'monthlytakehome',
                length    = 6,
                precision = 2
            );
        });

        schema.create('expense', (table) => {
            // Base
            table.increments('id');
            table.timestampTz('created').withCurrent();
            table.timestampTz('updated').withCurrent();

            // Cols
            table.date('date');
            table.decimal(name = 'amount', length = 10, precision = 2);
            table.string('description', 500);
            table.string('receipt', 128).nullable();

            // FK
            table.unsignedInteger('userid');
            table.unsignedInteger('categoryid');
            table.unsignedInteger('subscriptionid').nullable();

            // Index
            table.index('id');
            table.index('date');
        });

        schema.create('subscription', (table) => {
            // Base
            table.increments('id');
            table.timestampTz('created').withCurrent();
            table.timestampTz('updated').withCurrent();

            // Cols
            table.date('next_charge_date');
            table.decimal(name = 'amount', length = 10, precision = 2);
            table.string('description', 500);
            table.string('receipt', 128).nullable();
            table.string('interval', 1); // Y (yearly), M (monthly), W (weekly)
            table.boolean('active').default(true);

            // FK
            table.unsignedInteger('userid');
            table.unsignedInteger('categoryid');

            // Index
            table.index('next_charge_date');
        });

        schema.create('category', (table) => {
            // Base
            table.increments('id');
            table.timestampTz('created').withCurrent();
            table.timestampTz('updated').withCurrent();

            // Cols
            table.string('name', 30);
            table.string('color', 6);

            // FK
            table.unsignedInteger('userid').nullable();

            // Index
            table.index('name');

            // Unique
            table.unique(['name', 'userid']);
        });

        schema.create('income', (table) => {
            // Base
            table.increments('id');
            table.timestampTz('created').withCurrent();
            table.timestampTz('updated').withCurrent();

            // Cols
            table.date('date');
            table.decimal(name = 'pay', length = 7, precision = 2);
            table.decimal(name = 'extra', length = 7, precision = 2);

            // FK
            table.unsignedInteger('userid').nullable();

            // Constraints
            table.unique(['userid', 'date']);
        });

        schema.create('audit', (table) => {
            // Base
            table.increments('id');
            table.timestampTz('created').withCurrent();
            table.timestampTz('updated').withCurrent();

            // Cols
            table.string('ip', 100);
            table.string('urlpath', 500);
            table.string('method', 10);
            table.string('agent', 250);
            table.string('detail', 500);
            table.decimal(name = 'statuscode', length = 3, precision = 0);
            table.integer('delta');

            // FK
            table.unsignedInteger('userid').nullable();

            // Index
            table.index('id');
            table.index('created');
        });

        schema.create('bug', (table) => {
            // Base
            table.increments('id');
            table.timestampTz('created').withCurrent();
            table.timestampTz('updated').withCurrent();

            // Cols
            table.string('ip', 100);
            table.string('urlpath', 500);
            table.string('method', 10);
            table.string('agent', 250);
            table.string('detail', 500);
            table.text('stack');

            // FK
            table.unsignedInteger('userid').nullable();

            // Index
            table.index('id');
            table.index('created');
        });

        // FK Constraints
        schema.alter('expense', (table) => {
            table.addConstraint(
                table
                    .foreignKey('userid')
                    .references('id')
                    .onTable('users')
            );
            table.addConstraint(
                table
                    .foreignKey('categoryid')
                    .references('id')
                    .onTable('category')
            );
            table.addConstraint(
                table
                    .foreignKey('subscriptionid')
                    .references('id')
                    .onTable('subscription')
                    .onDelete('SET NULL')
            );
        });

        schema.alter('subscription', (table) => {
            table.addConstraint(
                table
                    .foreignKey('userid')
                    .references('id')
                    .onTable('users')
            );
            table.addConstraint(
                table
                    .foreignKey('categoryid')
                    .references('id')
                    .onTable('category')
            );
        });

        schema.alter('category', (table) => {
            table.addConstraint(
                table
                    .foreignKey('userid')
                    .references('id')
                    .onTable('users')
            );
        });

        schema.alter('income', (table) => {
            table.addConstraint(
                table
                    .foreignKey('userid')
                    .references('id')
                    .onTable('users')
            );
        });

        schema.alter('audit', (table) => {
            table.addConstraint(
                table
                    .foreignKey('userid')
                    .references('id')
                    .onTable('users')
            );
        });

        schema.alter('bug', (table) => {
            table.addConstraint(
                table
                    .foreignKey('userid')
                    .references('id')
                    .onTable('users')
            );
        });
    }

    function down(schema, qb) {
        schema.drop('audit');
        schema.drop('bug');
        schema.drop('income');
        schema.drop('category');
        schema.drop('subscription');
        schema.drop('expense');
        schema.drop('users');
    }

}
