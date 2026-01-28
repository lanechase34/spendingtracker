component extends="coldbox.system.Interceptor" {

    property name="async"      inject="asyncManager@coldbox";
    property name="bugService" inject="services.bug";

    function configure() {
    }

    function preMailSend(event, data, buffer, rc, prc) {
        // Change the subject and mailer if we are on development
        if(getSetting('environment') == 'development') {
            data.mail.setMailer('devFiles');
            data.mail.setSubject('[TESTING]  #data.mail.getSubject()#');
        }
    }

    function postMailSend(event, data, buffer, rc, prc) {
        if(data.result.error) {
            // Log bug
            prc.bugDetail = {
                ip     : '-1',
                urlpath: 'cbMailQueue',
                method : 'N/A',
                agent  : 'Scheduled Task',
                detail : 'Failed to send email',
                stack  : data.result
            };

            async.newFuture(() => {
                bugService.log(argumentCollection = prc.bugDetail);
            });
        }
    }

}
