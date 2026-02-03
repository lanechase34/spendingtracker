component {

    /**
	 * Configure the ColdBox App For Production 
	 * https://coldbox.ortusbooks.com/getting-started/configuration
	 */
    function configure() {
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
            appName                 : 'SpendingTracker',
            eventName               : 'event',
            // Development Settings
            reinitPassword          : getSystemSetting('REINITKEY'),
            reinitKey               : 'fwreinit',
            handlersIndexAutoReload : false,
            // Implicit Events
            defaultEvent            : 'echo.healthcheck',
            requestStartHandler     : '',
            requestEndHandler       : '',
            applicationStartHandler : '',
            applicationEndHandler   : '',
            sessionStartHandler     : '',
            sessionEndHandler       : '',
            missingTemplateHandler  : 'echo.missingTemplate',
            // Extension Points
            applicationHelper       : '',
            viewsHelper             : '',
            modulesExternalLocation : [],
            viewsExternalLocation   : '',
            layoutsExternalLocation : '',
            handlersExternalLocation: '',
            requestContextDecorator : '',
            controllerDecorator     : '',
            // Error/Exception Handling
            invalidHTTPMethodHandler: 'echo.invalidHTTPMethod',
            exceptionHandler        : 'echo.onException',
            invalidEventHandler     : 'echo.invalidEvent',
            customErrorTemplate     : '/views/error.cfm',
            // Application Aspects
            handlerCaching          : true,
            eventCaching            : true,
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
            audit: {
                urlpathLength       : 500,
                methodLength        : 10,
                agentLength         : 250,
                detailLength        : 500,
                slowRequestThreshold: 1000, // ms
                maxSlowRequests     : 25
            },
            authTokenTTL: 360, // 60 minutes in seconds
            basePath    : replace(expandPath('/'), '\', '/', 'all'),
            concurrency : {
                activeRequests: 0,
                maxRequests   : 0,
                slowRequests  : []
            },
            contactEmail  : 'spendingtracker@chaselane.dev',
            dateMask      : 'mm-dd-yyyy',
            debugging     : false,
            encryptionKey : getSystemSetting('ENCRYPTIONKEY'),
            fromEmail     : 'spendingtracker@chaselane.dev',
            gcTime        : 0,
            healthCheck   : true,
            imageExtension: '.webp',
            imageMagick   : getSystemSetting('IMAGEMAGICK'),
            impersonation : false,
            jwt_secret    : getSystemSetting('JWT_SECRET'),
            logQueries    : false,
            logRequests   : true,
            maxThreads    : 50,
            rateLimits    : {
                /**
                 * limit - num of request allowed per window
                 * window - time in seconds
                 * key - valid options, ip, email, ip+email
                 */
                'auth.login': {
                    limit : 10,
                    window: 300,
                    key   : 'ip+email'
                },
                'auth.register'              : {limit: 3, window: 1800, key: 'ip'},
                'auth.verify'                : {limit: 5, window: 600, key: 'email'},
                'auth.resendverificationcode': {limit: 3, window: 600, key: 'email'}
            },
            receiptUploads      : ['expense.save', 'subscription.save'], // endpoints that allow receipt uploads
            refreshTokenTTL     : 2592000, // 30 days in seconds
            slowRequest         : 1000, // 1000ms
            testEmailPath       : '#getDirectoryFromPath(getCurrentTemplatePath())#/../../../stuploads/_testemails',
            uploadPath          : '#getDirectoryFromPath(getCurrentTemplatePath())#/../../../stuploads',
            useRateLimiter      : true,
            verificationCooldown: 10, // only send a verification code every 10 minutes
            verificationLifespan: 60, // verification codes last 60 minutes
            version             : '1.0.2',
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
            appenders: {coldboxTracer: {class: 'coldbox.system.logging.appenders.ConsoleAppender'}},
            // Root Logger
            root     : {levelmax: 'INFO', appenders: '*'},
            // Implicit Level Categories
            info     : ['coldbox.system']
        };

        /**
		 * --------------------------------------------------------------------------
		 * Layout Settings
		 * --------------------------------------------------------------------------
		 */
        layoutSettings = {defaultLayout: '', defaultView: ''};

        /**
		 * --------------------------------------------------------------------------
		 * Custom Interception Points
		 * --------------------------------------------------------------------------
		 */
        interceptorSettings = {customInterceptionPoints: ['onIdentifier']};

        /**
		 * --------------------------------------------------------------------------
		 * Application Interceptors
		 * --------------------------------------------------------------------------
		 * Remember that the order of declaration is the order they will be registered and fired
		 */
        interceptors = [
            {
                class     : 'interceptors.appLifeCycle',
                name      : 'appLifeCycleInterceptor',
                properties: {}
            },
            {
                class     : 'interceptors.exception',
                name      : 'exceptionInterceptor',
                properties: {}
            },
            {
                class     : 'interceptors.mail',
                name      : 'mailInterceptor',
                properties: {}
            },
            {
                class     : 'interceptors.apiResponse',
                name      : 'apiResponseInterceptor',
                properties: {}
            },
            {
                class     : 'interceptors.requestAudit',
                name      : 'requestAuditInterceptor',
                properties: {}
            },
            {
                class     : 'interceptors.ratelimiter',
                name      : 'rateLimiterInterceptor',
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
            scope       : 'cache',
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
            handlersLocation: 'handlers',
            viewsLocation   : 'views',
            layoutsLocation : '',
            modelsLocation  : 'models',
            eventAction     : ''
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
        coldbox.reinitPassword          = '';
        coldbox.debugMode               = true;

        /**
         * Begin dev flags, use your .env to change these
         */
        settings.impersonation  = getSystemSetting('IMPERSONATION', true);
        settings.debugging      = getSystemSetting('DEBUGGING', true);
        settings.useRateLimiter = getSystemSetting('USERATELIMITER', false);
        settings.logQueries     = getSystemSetting('LOGQUERIES', true);
        settings.logRequests    = getSystemSetting('LOGREQUESTS', true);
    }

    /**
     * Test environment
     */
    function test() {
        settings.impersonation  = true;
        settings.useRateLimiter = false;
    }

}
