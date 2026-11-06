component {

    /**
	 * Configure the ColdBox App For Production 
	 * https://coldbox.ortusbooks.com/getting-started/configuration
	 */
    function configure() {
        var logPath = getPageContext().getServletContext().getRealPath("/WEB-INF/");

        /**
		 * --------------------------------------------------------------------------
		 * ColdBox Directives
		 * --------------------------------------------------------------------------
		 * Here you can configure ColdBox for operation. Remember tha these directives below
		 * are for PRODUCTION. If you want different settings for other environments make sure
		 * you create the appropriate functions and define the environment in your .env or
		 * in the `environments` struct.
		 */
        coldbox = {
            // Application Setup
            appName                 : "SpendingTracker",
            eventName               : "event",
            // Development Settings
            reinitPassword          : len(getSystemSetting("REINITKEY", "")) ? getSystemSetting("REINITKEY") : "disabled_#generateSecretKey("AES", 256)##generateSecretKey("AES", 256)#",
            reinitKey               : "fwreinit",
            handlersIndexAutoReload : false,
            implicitViews           : true,
            // Implicit Events
            defaultEvent            : "echo.healthcheck",
            requestStartHandler     : "",
            requestEndHandler       : "",
            applicationStartHandler : "",
            applicationEndHandler   : "",
            sessionStartHandler     : "",
            sessionEndHandler       : "",
            missingTemplateHandler  : "echo.missingTemplate",
            // Extension Points
            applicationHelper       : "",
            viewsHelper             : "",
            modulesExternalLocation : [],
            viewsExternalLocation   : "",
            layoutsExternalLocation : "",
            handlersExternalLocation: "",
            requestContextDecorator : "",
            controllerDecorator     : "",
            // Error/Exception Handling
            invalidHTTPMethodHandler: "echo.invalidHTTPMethod",
            exceptionHandler        : "echo.onException",
            invalidEventHandler     : "echo.invalidEvent",
            customErrorTemplate     : "/views/error.cfm",
            // Application Aspects
            handlerCaching          : true,
            eventCaching            : false,
            viewCaching             : true,
            // Will automatically do a mapDirectory() on your `models` for you.
            autoMapModels           : true,
            // Auto converts a json body payload into the RC
            jsonPayloadToRC         : true
        };

        /**
		 * --------------------------------------------------------------------------
		 * Custom Settings
		 * --------------------------------------------------------------------------
		 */
        settings = {
            appName: "SpendingTracker",
            audit  : {
                urlpathLength       : 500,
                methodLength        : 10,
                agentLength         : 250,
                detailLength        : 500,
                slowRequestThreshold: 1000, // ms
                maxSlowRequests     : 25
            },
            authTokenTTL: 1800, // 30 minutes in seconds (for cookie), matches jwt.expiration
            basePath    : replace(expandPath("/"), "\", "/", "all"),
            concurrency : {
                activeRequests: 0,
                maxRequests   : 0,
                slowRequests  : []
            },
            contactEmail   : "spendingtracker@chaselane.dev",
            dateMask       : "mm-dd-yyyy",
            debugging      : false,
            encryptionKey  : getSystemSetting("ENCRYPTIONKEY"),
            fromEmail      : "spendingtracker@chaselane.dev",
            guestOnlyRoutes: [
                "auth.login",
                "auth.register",
                "auth.verify",
                "auth.resendverificationcode"
            ],
            healthCheck    : true,
            imageExtension : ".webp",
            imageMagickPath: getSystemSetting("IMAGEMAGICKPATH"),
            impersonation  : false,
            jwt_secret     : getSystemSetting("JWT_SECRET"),
            logPath        : logPath,
            logQueries     : false,
            logRequests    : true,
            maxThreads     : createObject("java", "java.lang.Runtime").getRuntime().availableProcessors(),
            metrics        : {
                slowQueryThreshold: 250, // ms
                maxSlowQueries    : 25,
                sqlLength         : 1000,
                diagnosticsTTL    : 30 // seconds the diagnostics snapshot is cached for
            },
            port: getSystemSetting("HTTP_PORT"),
            /**
             * Per event rate limits, every rule for the event is counted - any one exceeded blocks the request
             *
             * by              : ordered list of fields the rule is scoped by
             *                   ip   - the request ip
             *                   user - the authenticated user's id (rule skipped if not authenticated)
             *                   anything else is read from rc (rule skipped if missing)
             * limit           : hits allowed per window
             * window          : window length in minutes
             * resetOnSuccess  : clear the counter when the request succeeds (2xx), optional
             * refundOnFailure : don't count the hit when the request fails (>= 400), optional
             */
            rateLimits: {
                "auth.login": [
                    {by: "ip", limit: 20, window: 15},
                    {
                        by            : "ip,email",
                        limit         : 10,
                        window        : 5,
                        resetOnSuccess: true
                    },
                    // Credential stuffing against one account from many ips
                    {by: "email", limit: 20, window: 15}
                ],
                "auth.register": [
                    {by: "ip", limit: 3, window: 30},
                    // Each attempt emails the address - stop flooding one inbox from many ips
                    {by: "email", limit: 3, window: 60}
                ],
                "auth.verify": [
                    {by: "ip", limit: 10, window: 10},
                    // Guessing one account's code from many ips
                    {by: "email", limit: 5, window: 10},
                    {by: "email", limit: 20, window: 1440}
                ],
                "auth.resendverificationcode": [
                    {by: "ip", limit: 5, window: 10},
                    {by: "email", limit: 3, window: 10}
                ],
                "auth.verify2fa": [
                    {by: "ip", limit: 5, window: 10},
                    // Brute forcing one account's code from many ips
                    {by: "user", limit: 10, window: 10}
                ],
                "expense.export": [
                    {
                        by             : "user",
                        limit          : 1,
                        window         : 1,
                        refundOnFailure: true
                    }
                ],
                "expense.exportreceipts": [
                    {
                        by             : "user",
                        limit          : 1,
                        window         : 3,
                        refundOnFailure: true
                    }
                ],
                // Changing the password checks the current one - limit guessing it with a stolen session
                "user.updateprofile": [{by: "user", limit: 20, window: 10}],
                "user.setup2fa"     : [{by: "user", limit: 5, window: 60}],
                "user.confirm2fa"   : [{by: "user", limit: 5, window: 10}],
                "user.disable2fa"   : [{by: "user", limit: 3, window: 10}]
            },
            receiptUploads      : ["expense.save", "subscription.save"], // endpoints that allow receipt uploads
            recoveryCodeCount   : 8, // number of recovery codes to provide for TOTP
            refreshTokenTTL     : 2592000, // 30 days in seconds
            testEmailPath       : "#getDirectoryFromPath(getCurrentTemplatePath())#/../../../stuploads/_testemails",
            uploadPath          : "#getDirectoryFromPath(getCurrentTemplatePath())#/../../../stuploads",
            useRateLimiter      : true,
            verificationCooldown: 10, // only send a verification code every 10 minutes
            verificationLifespan: 60, // verification codes last 60 minutes
            version             : "1.0.3",
            warmedUp            : false
        };

        /**
		 * --------------------------------------------------------------------------
		 * Module Loading Directives
		 * --------------------------------------------------------------------------
		 */
        modules = {
            // An array of modules names to load, empty means all of them
            include: [],
            // An array of modules names to NOT load, empty means none
            exclude: []
        };

        /**
		 * --------------------------------------------------------------------------
		 * Application Logging (https://logbox.ortusbooks.com)
		 * --------------------------------------------------------------------------
		 * By Default we log to the console, but you can add many appenders or destinations to log to.
		 * You can also choose the logging level of the root logger, or even the actual appender.
		 */
        logBox = {
            // Define Appenders
            // Asynchronous rolling file logger
            appenders: {
                appLog: {
                    class     : "coldbox.system.logging.appenders.RollingFileAppender",
                    properties: {
                        filePath       : "#logPath#/../logs",
                        filename       : "app",
                        autoExpand     : false,
                        fileMaxSize    : 10000,
                        fileMaxArchives: 10,
                        async          : true
                    }
                }
            },
            // Root Logger
            root: {
                levelMin : "FATAL",
                levelMax : "WARN",
                appenders: "appLog"
            },
            categories: {
                "coldbox.system": {
                    levelMin : "FATAL",
                    levelMax : "INFO",
                    appenders: "appLog"
                },
                "WebSocket": {
                    levelMin : "FATAL",
                    levelMax : "WARN",
                    appenders: "appLog"
                },
                "Email": {
                    levelMin : "FATAL",
                    levelMax : "WARN",
                    appenders: "appLog"
                },
                "Admin": {
                    levelMin : "FATAL",
                    levelMax : "WARN",
                    appenders: "appLog"
                },
                "Image": {
                    levelMin : "FATAL",
                    levelMax : "WARN",
                    appenders: "appLog"
                }
            }
        };

        /**
		 * --------------------------------------------------------------------------
		 * Layout Settings
		 * --------------------------------------------------------------------------
		 */
        layoutSettings = {defaultLayout: "", defaultView: ""};

        /**
		 * --------------------------------------------------------------------------
		 * Custom Interception Points
		 * --------------------------------------------------------------------------
		 */
        interceptorSettings = {customInterceptionPoints: ["onIdentifier"]};

        /**
		 * --------------------------------------------------------------------------
		 * Application Interceptors
		 * --------------------------------------------------------------------------
		 * Remember that the order of declaration is the order they will be registered and fired
		 */
        interceptors = [
            {
                class     : "interceptors.appLifeCycle",
                name      : "appLifeCycleInterceptor",
                properties: {}
            },
            {
                class     : "interceptors.exception",
                name      : "exceptionInterceptor",
                properties: {}
            },
            {
                class     : "interceptors.mail",
                name      : "mailInterceptor",
                properties: {}
            },
            {
                class     : "interceptors.apiResponse",
                name      : "apiResponseInterceptor",
                properties: {}
            },
            {
                class     : "interceptors.requestAudit",
                name      : "requestAuditInterceptor",
                properties: {}
            },
            {
                class     : "interceptors.guestOnly",
                name      : "guestOnlyInterceptor",
                properties: {}
            },
            {
                class     : "interceptors.ratelimiter",
                name      : "rateLimiterInterceptor",
                properties: {}
            },
            {
                class     : "interceptors.tokenRevocation",
                name      : "tokenRevocationInterceptor",
                properties: {}
            }
        ];

        /**
		 * --------------------------------------------------------------------------
		 * Module Settings
		 * --------------------------------------------------------------------------
		 * Each module has it's own configuration structures, so make sure you follow
		 * the module's instructions on settings.
		 *
		 * Each key is the name of the module:
		 *
		 * myModule = {
		 *
		 * }
		 */
        moduleSettings = {};

        /**
		 * --------------------------------------------------------------------------
		 * Flash Scope Settings
		 * --------------------------------------------------------------------------
		 * The available scopes are : session, client, cluster, ColdBoxCache, or a full instantiation CFC path
		 */
        flash = {
            scope       : "cache",
            properties  : {}, // constructor properties for the flash scope implementation
            inflateToRC : true, // automatically inflate flash data into the RC scope
            inflateToPRC: false, // automatically inflate flash data into the PRC scope
            autoPurge   : true, // automatically purge flash data for you
            autoSave    : true // automatically save flash scopes at end of a request and on relocations.
        };

        /**
		 * --------------------------------------------------------------------------
		 * App Conventions
		 * --------------------------------------------------------------------------
		 */
        conventions = {
            handlersLocation: "handlers",
            viewsLocation   : "views",
            layoutsLocation : "",
            modelsLocation  : "models",
            eventAction     : ""
        };
    }

    /**
	 * Development environment
	 */
    function development() {
        coldbox.handlersIndexAutoReload = true;
        coldbox.handlerCaching          = false;
        coldbox.eventCaching            = false;
        coldbox.viewCaching             = false;
        coldbox.reinitPassword          = "";
        coldbox.debugMode               = true;

        settings.appName = "SpendingTracker (DEV)";

        /**
         * Begin dev flags, use your .env to change these
         */
        settings.impersonation  = getSystemSetting("IMPERSONATION", true);
        settings.debugging      = getSystemSetting("DEBUGGING", true);
        settings.useRateLimiter = getSystemSetting("USERATELIMITER", false);
        settings.logQueries     = getSystemSetting("LOGQUERIES", true);
        settings.logRequests    = getSystemSetting("LOGREQUESTS", true);

        // Lower bcrypt workfactor for faster performance
        moduleSettings = {bcrypt: {workFactor: 4}};

        logBox.root.levelmax = "DEBUG";
    }

    /**
     * Test environment
     */
    function test() {
        settings.impersonation  = true;
        settings.useRateLimiter = false;
        settings.appName        = "SpendingTracker (TEST)";

        moduleSettings = {bcrypt: {workFactor: 4}};
    }

}
