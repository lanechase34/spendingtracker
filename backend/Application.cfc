component {

    this.name = 'SpendingTracker';

    COLDBOX_APP_ROOT_PATH = getDirectoryFromPath(getCurrentTemplatePath());
    COLDBOX_APP_MAPPING   = '';
    COLDBOX_WEB_MAPPING   = '';
    COLDBOX_CONFIG_FILE   = '';
    COLDBOX_APP_KEY       = '';
    COLDBOX_FAIL_FAST     = true;

    this.mappings['/']             = COLDBOX_APP_ROOT_PATH;
    this.mappings['/coldbox']      = COLDBOX_APP_ROOT_PATH & 'coldbox';
    this.mappings['/includes']     = COLDBOX_APP_ROOT_PATH & 'includes';
    this.mappings['/interceptors'] = COLDBOX_APP_ROOT_PATH & 'interceptors';
    this.mappings['/models']       = COLDBOX_APP_ROOT_PATH & 'models';
    this.mappings['/services']     = this.mappings['/models'] & '/services';

    this.datasource = 'spendingtracker';

    public boolean function onApplicationStart() {
        setting requestTimeout ="300";
        application.cbBootstrap= new coldbox.system.Bootstrap(
            COLDBOX_CONFIG_FILE,
            COLDBOX_APP_ROOT_PATH,
            COLDBOX_APP_KEY,
            COLDBOX_APP_MAPPING,
            COLDBOX_FAIL_FAST,
            COLDBOX_WEB_MAPPING
        )
        application.cbBootstrap.loadColdbox()
        return true
    }

    public void function onApplicationEnd(struct appScope) {
        arguments.appScope.cbBootstrap.onApplicationEnd(arguments.appScope)
    }

    public boolean function onRequestStart(string targetPage) {
        return application.cbBootstrap.onRequestStart(arguments.targetPage)
    }

    public boolean function onMissingTemplate(template) {
        return application.cbBootstrap.onMissingTemplate(argumentCollection = arguments);
    }

    function onError(struct exception, string eventName) {
        writeOutput('Oops. Please try again later.');
    }

}
