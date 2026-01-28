component {

    function configure() {
        return {
            defaultProtocol: 'default',
            mailers        : {
                default : {class: 'CFMail'},
                devFiles: {class: 'File', properties: {filePath: controller.getSetting('testEmailPath')}}
            },
            defaults    : {from: controller.getSetting('fromEmail'), type: 'text/html'},
            runQueueTask: true
        }
    }

}
