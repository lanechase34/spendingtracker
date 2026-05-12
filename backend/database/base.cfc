component {

    /**
     * Base helper functions for migrations, seeders
     */

    this.relativepath = '../';

    // Get the securityService component
    function getSecurityService() {
        var securityService = createObject('component', '#this.relativePath#models/services/security');
        securityService.setEncryptionKey(getEncrpytionKey());
        return securityService;
    }

    // Get the encryption key from the .env
    function getEncrpytionKey() {
        var envArr = listToArray(
            fileRead('#this.relativePath#.env'),
            createObject('java', 'java.lang.System').getProperty('line.separator')
        );
        return listToArray(
            envArr.filter((item) => {
                return listToArray(item, '=')[1] == 'ENCRYPTIONKEY'
            })[1],
            '='
        )[2];
    }

    // Get the colorService component
    function getColorService() {
        return createObject('component', '#this.relativePath#models/services/color');
    }

    // Create a trigger for the updated column for the supplied @tableName
    function createUpdateTrigger(required string tableName) {
        queryExecute('
            CREATE OR REPLACE TRIGGER trg_#tableName#_updated
                BEFORE UPDATE ON #tableName#
                FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp()
        ');
    }

    function dropUpdateTrigger(required string tableName) {
        queryExecute('DROP TRIGGER IF EXISTS trg_#tableName#_updated ON #tableName#');
    }

    // Stub
    function run() {
    }

}
