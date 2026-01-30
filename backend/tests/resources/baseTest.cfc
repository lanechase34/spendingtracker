component extends="coldbox.system.testing.BaseTestCase" {

    property name="cbauth"     inject="authenticationService@cbauth";
    property name="uploadPath" inject="coldbox:setting:uploadPath";

    function beforeAll() {
        /**
         * Clear application and re-wire everything
         */
        application.delete('cbController');
        application.delete('wirebox')
        application.delete('socketBox');
        application.delete('SocketBoxConfig');
        application.delete('STOMPBroker');
        super.beforeAll();
        application.wirebox.autowire(this);

        /**
         * Check if this test has helper functions
         */
        var metadata = this.getMetaData();
        var testName = listToArray(metadata.fullname, '.');
        if(testname.len() == 5 && fileExists('tests/resources/#testname[4]#Helper.cfc')) {
            variables['#testname[4]#Helper'] = getInstance('tests.resources.#testname[4]#Helper');
        }

        /**
         * Mock a temp dir to use
         */
        tempDir = '#uploadPath#/#createUUID()#';
        directoryCreate(tempDir);

        /**
         * Log out any lingering user
         */
        cbauth.logout();
    }

    function afterAll() {
        super.afterAll();

        /**
         * Delete temp dir
         */
        directoryDelete(tempDir, true);
    }

    /**
     * Fetch img blob and return absolute path of img
     */
    string function fetchAndWriteImg(required string imgUrl, required string extension) {
        /**
         * Fetch image blob
         */
        cfhttp(
            url    = imgUrl,
            result = "imgResult",
            method = "GET"
        );

        /**
         * CF make image object and write to disk
         */
        var img  = imageNew(imgResult.filecontent);
        var path = '#tempDir#/#createUUID()#.#extension#';
        img.write(path);
        return path;
    }

}
