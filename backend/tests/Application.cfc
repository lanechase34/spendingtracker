component {

    this.name = 'SpendingTracker_Testing';

    this.mappings['/tests'] = getDirectoryFromPath(getCurrentTemplatePath());
    rootPath                = reReplaceNoCase(this.mappings['/tests'], 'tests(\\|/)', '');

    this.mappings['/root']         = rootPath;
    this.mappings['/coldbox']      = rootPath & 'coldbox';
    this.mappings['/interceptors'] = rootPath & 'interceptors';
    this.mappings['/testbox']      = rootPath & 'modules/testbox';
    this.mappings['/models']       = rootPath & 'models';
    this.mappings['/services']     = rootPath & '/services';

    this.datasource = 'spendingtracker';

    public boolean function onRequestStart(targetPage) {
        setting requestTimeout="9999";

        request.coldBoxVirtualApp = new coldbox.system.testing.VirtualApp(appMapping = '/root');
        request.coldBoxVirtualApp.startup(true);
        return true;
    }

    public void function onRequestEnd(targetPage) {
        request.coldBoxVirtualApp.shutdown();
    }

}
