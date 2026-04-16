component extends="modules.socketbox.models.WebSocketSTOMP" hint="WebSocket Endpoint for SocketBox" {

    /**
	 * Socket destination -> Allowed permission(s)
	 */
    this.validSockets = {'metrics': 'ADMIN'};

    // Initialize dependencies and store in app scope
    function initDeps() {
        application.wsLog            = application.wirebox.getInstance('logbox:logger:WebSocket');
        application.wsJwtService     = application.wirebox.getInstance('JwtService@cbsecurity');
        application.wsRequestService = application.wirebox.getInstance('coldbox:requestService');
        application.wsCache          = application.wirebox.getInstance('cachebox:wsStorage');
    }

    function configure() {
        return {
            debugMode    : false,
            heartBeatMS  : 10000,
            exchanges    : {topic: {bindings: {metrics: 'metrics'}}},
            subscriptions: {}
        };
    };

    /**
	 * Authenticate the incoming websocket connection using jwt
	 *
	 * @login JWT connection header
	 */
    boolean function authenticate(
        required string login,
        required string passcode,
        string host,
        required channel,
        required struct connectionMetadata
    ) {
        var jwt = arguments.login;

        /**
         * Check that we received a JWT
         */
        if(!jwt.len()) {
            return false;
        }

        /**
         * Attempt to decode the JWT
         */
        try {
            var valid = application.wsJwtService.parseToken(
                token          = jwt,
                storeInContext = true,
                authenticate   = true
            );

            /**
             * Store the decoded token in cache using the channel's hash code
             */
            var payload = application.wsRequestService.getContext().getPrivateValue('jwt_payload');

            application.wsCache.set(
                'ws_token_#channel.hashCode()#',
                {scope: payload.scope ?: '', sub: payload.sub ?: ''},
                30,
                1
            );
            return true;
        }
        // silence JWT errors
        catch(TokenNotFoundException e) {
        }
        catch(TokenInvalidException e) {
        }
        catch(TokenExpiredException e) {
        }
        catch(any e) {
            application.wsLog.error('WebSocket authentication failed unexpectedly: #e.message#', e.stackTrace);
        }

        return false;
    }

    /**
	 * Authorize the incoming websocket connection using jwt
     *
     * @login JWT 
	 */
    boolean function authorize(
        required string login,
        required string exchange,
        required string destination,
        required string access,
        required channel,
        required struct connectionMetadata
    ) {
        /**
         * Check this is a valid destination
         */
        if(!login.len() || !this.validSockets.keyExists(destination)) {
            return false;
        }

        /**
		 * We want the sessionID for this connection, so we'll get the details about this channel's connection
		 */
        var connectionDetails = getConnectionDetails(channel);
        var sessionID         = connectionDetails['sessionID'] ?: '';

        if(!sessionID.len()) {
            application.wsLog.warn('WebSocket authorization failed - no sessionID for destination: #arguments.destination#');
            return false;
        }

        try {
            /**
			 * Check the permissions associated with this user
			 */
            var decodedToken = application.wsCache.get('ws_token_#channel.hashCode()#');
            if(isNull(decodedToken)) {
                application.wsLog.warn('WebSocket authorization failed - token not in cache for channel #channel.hashCode()#');
                return false;
            }

            var hasScope = decodedToken.scope.listFindNoCase(this.validSockets[destination], ' ') > 0;

            if(!hasScope) {
                application.wsLog.warn(
                    'WebSocket authorization failed - insufficient scope for destination "#arguments.destination#". ' &
                    'Required: "#this.validSockets[destination]#", subject: "#decodedToken.sub#"'
                );
            }

            return hasScope;
        }
        catch(any e) {
            application.wsLog.error(
                'WebSocket authorization failed unexpectedly for destination "#arguments.destination#": #e.message#',
                e.stackTrace
            );
        }

        return false;
    }

}
