component extends="coldbox.system.Interceptor" hint="Interceptor for mail events" {

    property name="async"      inject="asyncManager@coldbox";
    property name="bugService" inject="services.bug";

    /**
     * Interceptor point before mail is sent
     */
    function preMailSend(event, data, buffer, rc, prc) {
        // Change the subject and mailer if we are on development
        if(getSetting('environment') == 'development') {
            data.mail.setMailer('devFiles');
            data.mail.setSubject('[TESTING]  #data.mail.getSubject()#');
        }
    }

    /**
     * Interceptor point after mail is sent
     */
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
