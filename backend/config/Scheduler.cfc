component {

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

        setTimezone('UTC');

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
                getInstance('services.subscription').charge();
            })
            .onFailure((task, exception) => {
                task.overviewStruct.detail = 'Task Error (Callback)';
                task.overviewStruct.stack  = exception;
                getInstance('services.bug').log(argumentCollection = task.overviewStruct);
            })
            .onSuccess((task, results) => {
                task.overviewStruct.detail = 'Task Success (Callback)';
                task.overviewStruct.delta  = getTickCount() - task.overviewStruct.startTick;
                getInstance('services.audit').audit(argumentCollection = task.overviewStruct);
            })
            .everyDayAt('05:00');

        task('payMonthly')
            .before((task) => {
                task.overviewStruct.urlpath = 'payMonthly';
            })
            .call(() => {
                getInstance('services.income').payMonthly();
            })
            .onFailure((task, exception) => {
                task.overviewStruct.detail = 'Task Error (Callback)';
                task.overviewStruct.stack  = exception;
                getInstance('services.bug').log(argumentCollection = task.overviewStruct);
            })
            .onSuccess((task, results) => {
                task.overviewStruct.detail = 'Task Success (Callback)';
                task.overviewStruct.delta  = getTickCount() - task.overviewStruct.startTick;
                getInstance('services.audit').audit(argumentCollection = task.overviewStruct);
            })
            .everyDayAt('07:00');

        task('metricsSubscription')
            .before((task) => {
                task.overviewStruct.urlpath = 'metricsSubscription';
            })
            .call(() => {
                var ws           = new WebSocket();
                var adminService = getInstance('services.admin');

                /**
                 * Check if there are any current subscribers to the 'metrics' subscription
                 */
                var subscriptions = ws.getSubscriptions();
                if((subscriptions?.metrics?.count() ?: 0) > 0) {
                    /**
                     * Post metrics response message to topic/metrics
                     */
                    var metrics = adminService.getMetrics();
                    ws.send('topic/metrics', {data: metrics, error: false});
                }

                /**
                 * Reset active request count
                 */
                adminService.resetActiveRequests();
            })
            .onFailure((task, exception) => {
                task.overviewStruct.detail = 'Task Error (Callback)';
                task.overviewStruct.stack  = exception;
                getInstance('services.bug').log(argumentCollection = task.overviewStruct);
            })
            .every(5, 'seconds');
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
