component extends="modules.socketbox.models.WebSocketSTOMP" {

    /**
	 * Socket destination -> Allowed permission(s)
	 */
    this.validSockets = {'metrics': 'ADMIN'};

    function configure() {
        return {
            debugMode  : false,
            heartBeatMS: 10000,
            exchanges  : {
                // Topic exchange routes messages based on a pattern match to their incoming destination
                topic: {bindings: {metrics: 'metrics'}}
            },
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
        required Struct connectionMetadata
    ) {
        if(!login.len()) {
            return false;
        }

        try {
            var jwt        = arguments.login;
            var jwtService = application.wirebox.getInstance('JwtService@cbsecurity');
            var valid      = jwtService.parseToken(
                token          = jwt,
                storeInContext = true,
                authenticate   = true
            );

            connectionMetadata.decodedToken = application.wirebox
                .getInstance('coldbox:requestService')
                .getContext()
                .getPrivateValue('jwt_payload');
            return true;
        }
        catch(any e) {
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
        required Struct connectionMetadata
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
            return false;
        }

        try {
            /**
			 * Check the permissions associated with this user
			 */
            var decodedToken = connectionMetadata.decodedToken;
            return decodedToken.scope.listFindNoCase(this.validSockets[destination], ' ');
        }
        catch(any e) {
        }

        return false;
    }

}
