component extends="coldbox.system.testing.BaseTestCase" {

    this.loadColdBox   = true;
    this.unloadColdBox = false;

    property name="cbauth"     inject="authenticationService@cbauth";
    property name="uploadPath" inject="coldbox:setting:uploadPath";

    function beforeAll() {
        /**
         * Re-wire everything
         */
        super.beforeAll();
        stubRoutingCgi();
        application.wirebox.autowire(this);

        /**
         * Check if this test has helper functions
         */
        var metadata = this.getMetaData();
        var testName = listToArray(metadata.fullname, ".");
        if(testname.len() == 5 && fileExists("tests/resources/#testname[4]#Helper.cfc")) {
            variables["#testname[4]#Helper"] = getInstance("tests.resources.#testname[4]#Helper");
        }
        if(testname.len() == 4) {
            var helper = replaceNoCase(testname[4], "test", "");
            if(fileExists("tests/resources/#helper#Helper.cfc")) {
                variables["#helper#Helper"] = getInstance("tests.resources.#helper#Helper");
            }
        }

        /**
         * Mock a temp dir to use
         */
        tempDir = "#uploadPath#/tests/#createUUID()#";
        directoryCreate(tempDir);
        variables._originalUploadPath = uploadPath;
        application.cbController.setSetting("uploadPath", "#uploadPath#/tests/");

        /**
         * Log out any lingering user
         */
        cbauth.logout();

        /**
         * Make sure rate limiter is turned off
         */
        var rateLimiter                   = application.cbController.getInterceptorService().getInterceptor("rateLimiterInterceptor");
        variables._originalUseRateLimiter = rateLimiter.getPropertyMixin("useRateLimiter", "variables");
        rateLimiter.injectPropertyMixin(propertyName = "useRateLimiter", propertyValue = false);
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
        var rateLimiter = application.cbController.getInterceptorService().getInterceptor("rateLimiterInterceptor");
        rateLimiter.injectPropertyMixin(
            propertyName  = "useRateLimiter",
            propertyValue = variables._originalUseRateLimiter
        );

        /**
         * Restore the upload dir
         */
        application.cbController.setSetting("uploadPath", "#uploadPath#");
    }

    /**
     * Stand in for MockBox on the routing service's getCGIElement - the CGI values every test request is routed by
     *
     * - BaseTestCase.execute() mocks getCGIElement afresh on every get()/post()/..., through MockBox: each $() writes,
     *   includes and deletes a generated stub file, and each call hashes its arguments - the request context's whole
     *   metadata serialized. Together that was about two thirds of a test request's time
     * - execute() only uses the $("getCGIElement").$args(element, event).$results(value) chain, and the routing service
     *   only asks for path_info, script_name and server_name - so the stand-in keeps the last value set for each
     * - Marking the service as already mocked (its mockbox key) makes prepareMock() hand it back as it is
     * - Re-check execute() and RoutingService's getCGIElement calls on every ColdBox / TestBox upgrade
     */
    private void function stubRoutingCgi() {
        var routingService = getController().getRoutingService();
        var state          = {values: {}, element: ""};

        new coldbox.system.core.dynamic.MixerUtil().start(routingService);
        routingService.mockbox = true;
        routingService.injectMixin("$", (method) => {
            if(method != "getCGIElement") {
                throw(
                    type    = "baseTest.UnsupportedMock",
                    message = "stubRoutingCgi() only stands in for getCGIElement, not #method#"
                );
            }
            return routingService;
        });
        routingService.injectMixin("$args", (element) => {
            state.element = element;
            return routingService;
        });
        routingService.injectMixin("$results", (value) => {
            state.values[state.element] = value;
            return routingService;
        });
        routingService.injectMixin("getCGIElement", (cgiElement, event) => state.values[cgiElement] ?: "");
    }

    /**
     * Fetch img blob and return absolute path of img
     */
    public string function fetchAndWriteImg(required string imgUrl, required string extension) {
        setup();

        /**
         * Fetch image blob
         */
        cfhttp(
            url     = imgUrl,
            result  = "local.imgResult",
            method  = "GET",
            timeout = 15
        );

        var path    = "#tempDir#/#createUUID()#.#extension#";
        var fetched = left(imgResult?.statusCode ?: "", 3) == "200"
        && findNoCase("image/", imgResult?.mimeType ?: "") == 1;

        /**
         * HEIC is not supported by CF's imageNew(), so write raw bytes
         * directly to disk and let ImageMagick handle decoding later.
         * There is no local fallback for HEIC - it needs the real file
         */
        if(lCase(extension) == "heic") {
            if(!fetched) {
                throw(
                    message = "Could not fetch HEIC test image from #imgUrl# (#imgResult?.statusCode ?: "no response"#)",
                    type    = "TestSetup.ImageFetchFailed"
                );
            }
            fileWrite(path, imgResult.filecontent);
            return path;
        }

        /**
         * CF make image object and write to disk
         * If the image host is down, generate one locally so the suite doesn't depend on a third party site
         */
        var img = fetched ? imageNew(imgResult.filecontent) : imageNew("", 200, 200, "rgb", "##3366cc");
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
    public void function waitFor(
        required any condition,
        numeric timeout  = 5,
        numeric interval = 100,
        string message   = "Condition was not met within #timeout# seconds"
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
