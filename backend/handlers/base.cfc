component extends="coldbox.system.RestHandler" {

    property name="imageService" inject="services.image";

    property name="receiptUploads" inject="coldbox:setting:receiptUploads";

    /**
     * Base component for all REST API Endpoints
     * Extends the coldbox RestHandler and overrides the following methods
     *
     * aroundHandler() -> Execute around ANY action, this adds validation BEFORE calling the event, if any validation error, raise exception
     * onAnyOtherException() -> Give generic error
     * onValidationException() -> Use prc.validation (set to results of validate()) to return nice validation message
     * onError() -> Wrapper for any generic errors in rest handlers, gives generic error
     */


    /**
	 * Our Rest handler adds a nice around handler that will be active for all handlers
	 * that leverage it.  So it can add uniformity, exception handling, tracking and more.
     *
     * Perform validation on incoming inputs
     * Use validation constraint equal to the current event ie user.login
	 *
	 * @event          The request context
	 * @rc             The rc reference
	 * @prc            The prc reference
	 * @targetAction   The action UDF to execute
	 * @eventArguments The original event arguments
	 */
    function aroundHandler(event, rc, prc, targetAction, eventArguments) {
        try {
            // start a resource timer
            var stime = getTickCount();
            // prepare our response object
            arguments.event.getResponse();
            // prepare argument execution
            var actionArgs = {
                'event': arguments.event,
                'rc'   : arguments.rc,
                'prc'  : arguments.prc
            };
            structAppend(actionArgs, arguments.eventArguments);
            // Incoming Format Detection
            if(!isNull(arguments.rc.format)) {
                arguments.prc.response.setFormat(arguments.rc.format);
            }

            /**
             * Validation based on the current event (handler.action)
             */
            prc.currEvent  = lCase(event.getCurrentEvent());
            prc.validation = validate(target = rc, constraints = prc.currEvent);

            /**
             * If any error(s), throw error and this will be caught in base.onValidationException
             */
            if(prc.validation.hasErrors()) {
                throw(type = 'ValidationException', message = '#prc.currEvent# | #now()#');
            }

            /**
             * Receipt validation
             *
             * Attempts to upload incoming file, verifying identify, and transform to webp
             * If successful, returns receipt path, empty string is an error
             */
            if(receiptUploads.contains(prc.currEvent)) {
                prc.receipt = '';

                // User attempting to upload receipt
                if(rc.keyExists('receipt') && rc.receipt.len()) {
                    prc.receipt = imageService.validateUpload(formField = 'receipt', uploadDirectory = prc.userDir);
                    if(!prc.receipt.len()) {
                        // Validation failed
                        throw(type = 'ReceiptValidationError', message = '#prc.currEvent# | #now()#');
                    }
                }
            }

            // Execute action
            var actionResults = arguments.targetAction(argumentCollection = actionArgs);
        }
        // Auth Issues
        catch("InvalidCredentials" e) {
            arguments.exception = e;
            this.onAuthenticationFailure(argumentCollection = arguments);
        }
        // Auth Issues
        catch("NotAuthorized" e) {
            arguments.exception = e;
            this.onAuthorizationFailure(argumentCollection = arguments);
        }
        // Token Decoding Issues
        catch("TokenInvalidException" e) {
            arguments.exception = e;
            this.onAuthenticationFailure(argumentCollection = arguments);
        }
        // Validation Exceptions
        catch("ValidationException" e) {
            arguments.exception = e;
            this.onValidationException(argumentCollection = arguments);
        }
        // Receipt Validation Exception
        catch("ReceiptValidationError" e) {
            arguments.exception = e;
            this.onReceiptValidationException(argumentCollection = arguments);
        }
        // Entity Not Found Exceptions
        catch("EntityNotFound" e) {
            arguments.exception = e;
            this.onEntityNotFoundException(argumentCollection = arguments);
        }
        // Permission Exceptions
        catch("PermissionDenied" e) {
            arguments.exception = e;
            this.onAuthorizationFailure(argumentCollection = arguments);
        }
        // Record Not Found
        catch("RecordNotFound" e) {
            arguments.exception = e;
            this.onEntityNotFoundException(argumentCollection = arguments);
        }
        // Global Catch
        catch(Any e) {
            arguments.exception = e;
            this.onAnyOtherException(argumentCollection = arguments);
        }

        // Development additions
        if(inDebugMode()) {
            arguments.prc.response
                .addHeader('x-current-route', arguments.event.getCurrentRoute())
                .addHeader('x-current-routed-url', arguments.event.getCurrentRoutedURL())
                .addHeader('x-current-routed-namespace', arguments.event.getCurrentRoutedNamespace())
                .addHeader('x-current-event', arguments.event.getCurrentEvent());
        }

        // end timer
        arguments.prc.response.setResponseTime(getTickCount() - stime);

        // Did the controllers set a view to be rendered? If not use renderdata, else just delegate to view.
        if(
            isNull(local.actionResults)
            AND
            !arguments.event.getCurrentView().len()
            AND
            arguments.event.getRenderData().isEmpty()
        ) {
            // Get response data according to error flag
            var responseData = (
                arguments.prc.response.getError() ? arguments.prc.response.getDataPacket(reset = this.resetDataOnError) : arguments.prc.response.getDataPacket()
            );

            // Magical renderings
            event.renderData(
                type         = arguments.prc.response.getFormat(),
                data         = responseData,
                contentType  = arguments.prc.response.getContentType(),
                statusCode   = arguments.prc.response.getStatusCode(),
                location     = arguments.prc.response.getLocation(),
                isBinary     = arguments.prc.response.getBinary(),
                jsonCallback = arguments.prc.response.getJsonCallback()
            );
        }

        // Global Response Headers
        arguments.prc.response.addHeader('x-response-time', arguments.prc.response.getResponseTime());

        // Output the response headers
        for(var thisHeader in arguments.prc.response.getHeaders()) {
            arguments.event.setHTTPHeader(name = thisHeader.name, value = thisHeader.value);
        }

        // If results detected, just return them, controllers requesting to return results
        if(!isNull(local.actionResults)) {
            return local.actionResults;
        }
    }

    /**
	 * Action for 'any' exceptions, ie when not caught by previous catch statements
     * announces the 'onException' event for interceptors to pick up
     * Modifies the API response to only include generic information - no exception specifics
	 *
	 * @event          The request context
	 * @rc             The rc reference
	 * @prc            The prc reference
	 * @eventArguments The original event arguments
	 * @exception      The thrown exception
	 */
    function onAnyOtherException(event, rc, prc, eventArguments, exception = {}) {
        // Param due to inconsistencies with safe navigation operators in all CFML engines
        param arguments.exception.type = '';

        // Handle a convention of on{type}Exception() in your base handler
        if(
            len(arguments.exception.type) && structKeyExists(this, 'on#arguments.exception.type#Exception') && isCustomFunction(
                this['on#arguments.exception.type#Exception']
            )
        ) {
            this['on#arguments.exception.type#Exception'](argumentCollection = arguments);
            return;
        }

        // Log Exception
        log.error(
            'Error calling #arguments.event.getCurrentEvent()#: #arguments.exception.message# #arguments.exception.detail#',
            {'_stacktrace': arguments.exception.stacktrace, 'httpData': getHTTPRequestData(false)}
        );

        // Announce exception
        announce('onException', {'exception': arguments.exception});

        // Setup General Error Response
        arguments.prc.response
            .setError(true)
            .setData(
                inDebugMode() ? {
                    'environment': {
                        'currentRoute'    : arguments.event.getCurrentRoute(),
                        'currentRoutedUrl': arguments.event.getCurrentRoutedUrl(),
                        'currentEvent'    : arguments.event.getCurrentEvent(),
                        'timestamp'       : getIsoTime()
                    },
                    'exception': {
                        'stack'       : arguments.exception.tagContext.map((item) => item.template & ':' & item.line),
                        'type'        : arguments.exception.type,
                        'detail'      : arguments.exception.detail,
                        'extendedInfo': arguments.exception.extendedInfo
                    }
                } : {}
            )
            .addMessage('An exception ocurred please try again.')
            .setStatusCode(arguments.event.STATUS.INTERNAL_ERROR);
    }

    /**
	 * Action that can be used when validation exceptions ocur.  Can be called manually or automatically
	 * via thrown exceptions in the around handler
	 *
	 * @event          The request context
	 * @rc             The rc reference
	 * @prc            The prc reference
	 * @eventArguments The original event arguments
	 * @exception      The thrown exception
	 */
    function onValidationException(event, rc, prc, eventArguments, exception = {}) {
        // Param Exceptions, just in case
        param name="arguments.exception.message"      default="";
        param name="arguments.exception.extendedInfo" default="";

        var validationResult = prc?.validation?.getAllErrors() ?: '';

        // Announce exception
        announce('onValidationException', {exception: arguments.exception, validationResult: validationResult});

        // Log it
        log.warn('onValidationException of (#event.getCurrentEvent()#)', arguments.exception?.extendedInfo ?: '');

        // Setup response
        arguments.event
            .getResponse()
            .setErrorMessage('Invalid Parameters. #prc.validation.getAllErrors().toList('; ')#')
            .setStatusCode(400);

        // Render Error Out
        arguments.event.renderData(
            type        = arguments.prc.response.getFormat(),
            data        = arguments.prc.response.getDataPacket(reset = this.resetDataOnError),
            contentType = arguments.prc.response.getContentType(),
            statusCode  = arguments.prc.response.getStatusCode(),
            location    = arguments.prc.response.getLocation(),
            isBinary    = arguments.prc.response.getBinary()
        );
    }

    /**
	 * Validation error raised by invalid receipt upload
	 *
	 * @event          The request context
	 * @rc             The rc reference
	 * @prc            The prc reference
	 * @eventArguments The original event arguments
	 * @exception      The thrown exception
	 */
    function onReceiptValidationException(event, rc, prc, eventArguments, exception = {}) {
        // Param Exceptions, just in case
        param name="arguments.exception.message"      default="";
        param name="arguments.exception.extendedInfo" default="";

        // Announce exception
        announce('onValidationException', {exception: arguments.exception, validationResult: {}});

        // Log it
        log.warn('onValidationException of (#event.getCurrentEvent()#)', arguments.exception?.extendedInfo ?: '');

        // Setup response
        arguments.event
            .getResponse()
            .setErrorMessage('Invalid Receipt upload.')
            .setStatusCode(415);

        // Render Error Out
        arguments.event.renderData(
            type        = arguments.prc.response.getFormat(),
            data        = arguments.prc.response.getDataPacket(reset = this.resetDataOnError),
            contentType = arguments.prc.response.getContentType(),
            statusCode  = arguments.prc.response.getStatusCode(),
            location    = arguments.prc.response.getLocation(),
            isBinary    = arguments.prc.response.getBinary()
        );
    }

    /**
	 * Implicit action that detects exceptions on your handlers and processes them
	 *
	 * @event          The request context
	 * @rc             The rc reference
	 * @prc            The prc reference
	 * @faultAction    The action that blew up
	 * @exception      The thrown exception
	 * @eventArguments The original event arguments
	 */
    function onError(
        event,
        rc,
        prc,
        faultAction    = '',
        exception      = {},
        eventArguments = {}
    ) {
        // Try to discover exception, if not, hard error
        if(!isNull(arguments.prc.exception) && (isNull(arguments.exception) || structIsEmpty(arguments.exception))) {
            arguments.exception = arguments.prc.exception.getExceptionStruct();
        }

        // Log Locally
        log.error(
            'Error in base handler (#arguments.faultAction#): #arguments.exception.message# #arguments.exception.detail#',
            {'_stacktrace': arguments.exception.stacktrace, 'httpData': getHTTPRequestData(false)}
        );

        // Announce exception
        announce('onException', {'exception': arguments.exception});

        // Setup General Error Response
        arguments.event
            .getResponse()
            .setError(true)
            .setData({})
            .addMessage('An exception ocurred please try again.')
            .setStatusCode(arguments.event.STATUS.INTERNAL_ERROR);

        // Development additions Great for Testing
        if(inDebugMode()) {
            prc.response
                .setData(structKeyExists(arguments.exception, 'tagContext') ? arguments.exception.tagContext : {})
                .addMessage('Detail: #arguments.exception.detail#')
                .addMessage('StackTrace: #arguments.exception.stacktrace#');
        }

        // Render Error Out
        event.renderData(
            type        = prc.response.getFormat(),
            data        = prc.response.getDataPacket(reset = this.resetDataOnError),
            contentType = prc.response.getContentType(),
            statusCode  = prc.response.getStatusCode(),
            location    = prc.response.getLocation(),
            isBinary    = prc.response.getBinary()
        );
    }

}
