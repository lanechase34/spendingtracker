component {

    property name="adminService"        inject="provider:services.admin";
    property name="auditService"        inject="provider:services.audit";
    property name="bugService"          inject="provider:services.bug";
    property name="incomeService"       inject="provider:services.income";
    property name="subscriptionService" inject="provider:services.subscription";

    /**
	 * Configure the ColdBox Scheduler
	 * https://coldbox.ortusbooks.com/digging-deeper/scheduled-tasks
	 */
    function configure() {
        /**
		 * --------------------------------------------------------------------------
		 * Configuration Methods 
		 * --------------------------------------------------------------------------
		 * From here you can set global configurations for the scheduler
		 * - setTimezone( ) : change the timezone for ALL tasks
		 * - setExecutor( executorObject ) : change the executor if needed
		 */

        /**
		 * --------------------------------------------------------------------------
		 * Register Scheduled Tasks
		 * --------------------------------------------------------------------------
		 * You register tasks with the task() method and get back a ColdBoxScheduledTask object
		 * that you can use to register your tasks configurations.
         * These do not need increased timeouts since they aren't normal CF threads
		 */

        task('chargeSubscriptions')
            .before((task) => {
                task.overviewStruct.urlpath = 'chargeSubscriptions';
            })
            .call(() => {
                subscriptionService.charge();
            })
            .onFailure((task, exception) => {
                callbackOnFailure(task, exception);
            })
            .onSuccess((task, results) => {
                callbackOnSuccess(task);
            })
            .everyDayAt('05:00');

        task('payMonthly')
            .before((task) => {
                task.overviewStruct.urlpath = 'payMonthly';
            })
            .call(() => {
                incomeService.payMonthly();
            })
            .onFailure((task, exception) => {
                callbackOnFailure(task, exception);
            })
            .onSuccess((task, results) => {
                callbackOnSuccess(task);
            })
            .everyDayAt('07:00');

        task('metricsSubscription')
            .before((task) => {
                task.overviewStruct.urlpath = 'metricsSubscription';
            })
            .call(() => {
                /**
                 * Check if there are any current subscribers to the 'metrics' subscription
                 */
                var subscriptions = application.ws.getSubscriptions();
                if((subscriptions?.metrics?.count() ?: 0) > 0) {
                    /**
                     * Post metrics response message to topic/metrics
                     */
                    var metrics = adminService.getMetrics();
                    application.ws.send('topic/metrics', {data: metrics, error: false});
                }

                /**
                 * Reset active request count
                 */
                adminService.resetActiveRequests();
            })
            .onFailure((task, exception) => {
                callbackOnFailure(task, exception);
            })
            .every(5, 'seconds');
    }

    function callbackOnFailure(required struct task, struct exception = {}) {
        task.overviewStruct.detail = 'Task Error (Callback)';
        task.overviewStruct.stack  = exception;
        bugService.log(argumentCollection = task.overviewStruct);
    }

    function callbackOnSuccess(required struct task) {
        task.overviewStruct.detail = 'Task Success (Callback)';
        task.overviewStruct.delta  = getTickCount() - task.overviewStruct.startTick;
        auditService.audit(argumentCollection = task.overviewStruct);
    }

    /**
	 * Called before the scheduler is going to be shutdown
	 */
    function onShutdown() {
    }

    /**
	 * Called after the scheduler has registered all schedules
	 */
    function onStartup() {
    }

    /**
	 * Called whenever ANY task fails
	 *
	 * @task      The task that got executed
	 * @exception The ColdFusion exception object
	 */
    function onAnyTaskError(required task, required exception) {
    }

    /**
	 * Called whenever ANY task succeeds
	 *
	 * @task   The task that got executed
	 * @result The result (if any) that the task produced
	 */
    function onAnyTaskSuccess(required task, result) {
    }

    /**
	 * Called before ANY task runs
     * Set up struct for audit/bug logging
	 *
	 * @task The task about to be executed
	 */
    function beforeAnyTask(required task) {
        task.overviewStruct = {
            ip       : 'localhost',
            urlpath  : '',
            method   : 'Task',
            agent    : 'Scheduled Task User',
            startTick: getTickCount()
        };
    }

    /**
	 * Called after ANY task runs
	 *
	 * @task   The task that got executed
	 * @result The result (if any) that the task produced
	 */
    function afterAnyTask(required task, result) {
    }

}
