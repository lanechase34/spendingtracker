component {

    /**
     * Base helper functions for seeders
     */

    this.relativepath = '../../';

    function getSecurityService() {
        var securityService = createObject('component', '#this.relativePath#models/services/security');
        securityService.setEncryptionKey(getEncrpytionKey());
        return securityService;
    }

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

    function getColorService() {
        return createObject('component', '#this.relativePath#models/services/color');
    }

    // Stub
    function run() {
    }

}
