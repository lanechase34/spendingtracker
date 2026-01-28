component extends="coldbox.system.testing.BaseTestCase" {

    property name="cbauth" inject="authenticationService@cbauth";

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
         * Log out any lingering user
         */
        cbauth.logout();
    }

    function afterAll() {
        super.afterAll();
    }

}
