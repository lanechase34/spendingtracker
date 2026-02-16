component {

    function configure() {
        setFullRewrites(true);

        // Healthcheck
        route('/healthcheck').to('echo.healthCheck');

        // Unauthorized
        route('/unauthorized').to('echo.unauthorized');

        // Warmup
        route('/warmup').to('echo.warmup');

        // API V1
        group({pattern: '/api/v1'}, () => {
            // Expense
            route('/expenses/import').withAction({POST: 'import'}).toHandler('expense');
            route('/expenses/export').withAction({POST: 'export'}).toHandler('expense');
            route('/expenses/bulk').withAction({POST: 'bulkSave'}).toHandler('expense');
            route('/expenses/:id-numeric/receipt').withAction({GET: 'receipt'}).toHandler('expense');
            route('/expenses/:id-numeric').withAction({DELETE: 'remove'}).toHandler('expense');
            route('/expenses/').withAction({GET: 'view', POST: 'save'}).toHandler('expense');
            route('/receipts/export').withAction({POST: 'exportReceipts'}).toHandler('expense');

            // Subscription
            route('/subscriptions/:id-numeric')
                .withAction({PATCH: 'toggle', DELETE: 'remove'})
                .toHandler('subscription');
            route('/subscriptions/').withAction({GET: 'view', POST: 'save'}).toHandler('subscription');

            // Category
            route('/categories/').withAction({GET: 'view'}).toHandler('category');

            // Widget
            route('/widgets/stackedBarChart').withAction({GET: 'stackedBarChart'}).toHandler('widget');
            route('/widgets/donutChart').withAction({GET: 'donutChart'}).toHandler('widget');
            route('/widgets/lineChart').withAction({GET: 'lineChart'}).toHandler('widget');

            // Income
            route('/income/').withAction({GET: 'view', PUT: 'save'}).toHandler('income');

            // Authentication
            route('/login').withAction({POST: 'login'}).toHandler('auth');
            route('/register').withAction({POST: 'register'}).toHandler('auth');
            route('/verify').withAction({POST: 'verify'}).toHandler('auth');
            route('/resendverificationcode').withAction({GET: 'resendVerificationCode'}).toHandler('auth');

            // Get CSRF Token
            route('/csrf').withAction({GET: 'generateCSRF'}).toHandler('auth');

            // These endpoints will receive refresh token cookie
            route('/security/logout').withAction({POST: 'logout'}).toHandler('auth');
            route('/security/refreshtoken').withAction({POST: 'refreshToken'}).toHandler('cbsecurity:jwt');

            // User
            route('/me').withAction({GET: 'getProfile', PATCH: 'updateProfile'}).toHandler('user');
            route('/users').withAction({GET: 'view'}).toHandler('user');

            // Admin
            route('/admin/audits').withAction({GET: 'viewAudits'}).toHandler('admin');
            route('/admin/bugs').withAction({GET: 'viewBugs'}).toHandler('admin');
            route('/admin/metrics').withAction({GET: 'metrics'}).toHandler('admin');
            route('/admin/cachedata').withAction({GET: 'cacheData'}).toHandler('admin');
            route('/admin/taskdata').withAction({GET: 'taskData'}).toHandler('admin');

            // Generics
            route('/healthcheck').to('echo.healthCheck');
            route('/unauthorized').to('echo.unauthorized');
            route('/status').to('echo.status');
            route('{wildcard}').to('echo.healthCheck');
        });

        route('{wildcard}').to('echo.healthCheck');
    }

}
