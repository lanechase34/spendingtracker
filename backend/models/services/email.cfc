component singleton accessors="true" hint="Service layer for sending email" {

    property name="contactEmail"         inject="coldbox:setting:contactEmail";
    property name="fromEmail"            inject="coldbox:setting:fromEmail";
    property name="mailService"          inject="MailService@cbmailservices";
    property name="verificationLifespan" inject="coldbox:setting:verificationLifespan";

    /**
     * Verify successful connection to the mail server - same functionality as admin page
     */
    public boolean function verifyConnection() {
        var env = new coldbox.system.core.delegates.Env();

        try {
            admin action = 'verifyMailServer'
            type         = 'server'
            password     = '#env.getEnv('CFCONFIG_ADMINPASSWORD')#'
            hostname     = '#env.getEnv('EMAIL_SERVER')#'
            port         = '#env.getEnv('EMAIL_PORT')#'
            mailusername = '#env.getEnv('EMAIL_USERNAME')#'
            mailpassword = '#env.getEnv('EMAIL_PASSWORD')#';

            return true;
        }
        catch(any e) {
        }
        return false;
    }

    /**
     * Send a verification to a new user's email
     *
     * @to                   user's email
     * @code                 the code
     * @expires              when the code expires
     * @verificationLifespan code life span in minutes
     */
    public void function sendVerificationEmail(
        required string to,
        required string code,
        required date expires,
        required numeric verificationLifespan
    ) {
        mailService
            .newMail(
                to     : to,
                from   : fromEmail,
                subject: 'SpendingTracker Verification',
                type   : 'html'
            )
            .setView(
                view: 'email/verification',
                args: {
                    to                  : to,
                    code                : code,
                    expires             : expires,
                    verificationLifeSpan: verificationLifeSpan
                }
            )
            .send();
    }

    /**
     * Send a bug
     *
     * @bugInfo requestAudit struct with bug info
     */
    public void function sendBug(required struct bugInfo) {
        mailService
            .newMail(
                to     : contactEmail,
                from   : fromEmail,
                subject: 'BUG Found',
                type   : 'html'
            )
            .setView(view: 'email/bug', args: {bugInfo: bugInfo})
            .queue();
    }

    /**
     * Send a test email
     */
    public void function sendTestEmail() {
        mailService
            .newMail(
                to     : contactEmail,
                from   : fromEmail,
                subject: 'Sending a test email!'
            )
            .setBody('
                Sending an email from the testing server! #now()# #createUUID()#
            ')
            .send();
    }

}
