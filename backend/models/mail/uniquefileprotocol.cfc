/**
 * Append uuid to each sent mail file to distinguish files during parallel sends
 */
component extends="cbmailservices.models.protocols.FileProtocol" {

    struct function send(required cbmailservices.models.Mail payload) {
        var rtnStruct = {'error': true, 'messages': []};
        var filePath  = getProperty('filePath') & '/mail.#dateFormat(now(), 'MM-dd-yyyy')#.#timeFormat(now(), 'HH-mm-ss-L')#.#createUUID()#.html';

        try {
            fileWrite(filePath, getMailContent(payload), 'UTF-8');
            rtnStruct.error = false;
        }
        catch(any e) {
            rtnStruct.messages.append('Error sending mail. #e.message# : #e.detail# : #e.stackTrace#');
        }

        return rtnStruct;
    }

}
