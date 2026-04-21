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
        tempDir = '#uploadPath#/tests/#createUUID()#';
        directoryCreate(tempDir);
        application.cbController.setSetting('uploadPath', '#uploadPath#/tests/');

        /**
         * Log out any lingering user
         */
        cbauth.logout();

        /**
         * Make sure rate limiter is turned off
         */
        var rateLimiter                   = application.cbController.getInterceptorService().getInterceptor('rateLimiterInterceptor');
        variables._originalUseRateLimiter = rateLimiter.getPropertyMixin('useRateLimiter', 'variables');
        rateLimiter.injectPropertyMixin(propertyName = 'useRateLimiter', propertyValue = false);
    }

    function afterAll() {
        super.afterAll();

        /**
         * Delete temp dir
         */
        directoryDelete(tempDir, true);

        /**
         * Restore rate limiter setting
         */
        var rateLimiter = application.cbController.getInterceptorService().getInterceptor('rateLimiterInterceptor');
        rateLimiter.injectPropertyMixin(
            propertyName  = 'useRateLimiter',
            propertyValue = variables._originalUseRateLimiter
        );
    }

    /**
     * Fetch img blob and return absolute path of img
     */
    private string function fetchAndWriteImg(required string imgUrl, required string extension) {
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

    /**
     * Polls a condition closure until it returns true or the timeout is reached.
     * Useful for testing async operations where results may not be immediately available.
     *
     * @condition A closure that returns true when the expected state is reached
     * @timeout   Maximum seconds to wait before failing (default 5)
     * @interval  Milliseconds to wait between polls (default 100)
     * @message   Failure message if timeout is reached
     */
    private void function waitFor(
        required any condition,
        numeric timeout  = 5,
        numeric interval = 100,
        string message   = 'Condition was not met within #timeout# seconds'
    ) {
        var start   = getTickCount();
        var elapsed = 0;

        while(elapsed < (timeout * 1000)) {
            if(condition()) return;
            sleep(interval);
            elapsed = getTickCount() - start;
        }

        fail(message);
    }

}
