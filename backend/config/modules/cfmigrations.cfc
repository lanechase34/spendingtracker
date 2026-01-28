component {

    function configure() {
        return {
            managers: {
                default: {
                    manager            : 'cfmigrations.models.QBMigrationManager', // The manager handling and executing the migration files
                    migrationsDirectory: '/database/migrations', // The directory containing the migration files
                    seedsDirectory     : '/database/seeds', // The directory containing any seeds, if applicable
                    seedEnvironments   : 'development', // A comma-delimited list of environments which are allowed to run seeds
                    properties         : {defaultGrammar: getSystemSetting('DB_GRAMMAR')}
                }
            }
        }
    }

}
