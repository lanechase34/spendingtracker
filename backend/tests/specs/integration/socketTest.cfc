component extends="tests.resources.baseTest" {

    property name="jwtService" inject="JwtService@cbsecurity";
    property name="cbauth"     inject="authenticationService@cbauth";
    property name="cache"      inject="cachebox:wsStorage";

    function beforeAll() {
        super.beforeAll();
        mockUser = getInstance('tests.resources.mockuser');
    }

    function run() {
        describe('Socketbox Integration Tests', () => {
            beforeEach(() => {
                setup();
                // Make sure nothing is logged in to start our tests
                cbauth.logout();
                jwtService.getTokenStorage().clearAll();

                // Clear any cached tokens between tests
                cache.clearAll();
            });

            /**
             * Singleton / application scope tests
             */
            describe('Application scope service caching', () => {
                it('configure() stores wsLog in application scope', () => {
                    var ws = getWebSocket();
                    expect(application).toHaveKey('wsLog');
                    expect(application.wsLog).toBeInstanceOf('coldbox.system.logging.Logger');
                });

                it('configure() stores wsJwtService in application scope', () => {
                    var ws = getWebSocket();
                    expect(application).toHaveKey('wsJwtService');
                    expect(application.wsJwtService).toBe(jwtService);
                });

                it('configure() stores wsRequestService in application scope', () => {
                    var ws = getWebSocket();
                    expect(application).toHaveKey('wsRequestService');
                });

                it('configure() stores wsCache in application scope', () => {
                    var ws = getWebSocket();
                    expect(application).toHaveKey('wsCache');
                });
            });

            /**
             * Cache behaviour tests
             */
            describe('Token cache behaviour', () => {
                it('authenticate() stores decoded token in cache keyed by channel hashCode', () => {
                    var ws = getWebSocket();

                    var user    = mockUser.make();
                    var jwt     = mockUser.login(user);
                    var channel = mockChannel();

                    ws.authenticate(
                        login              = jwt,
                        passcode           = '',
                        host               = 'localhost',
                        channel            = channel,
                        connectionMetadata = {}
                    );

                    var cached = cache.get('ws_token_#channel.hashCode()#');
                    expect(isNull(cached)).toBeFalse();
                    expect(cached).toHaveKey('sub');
                    expect(cached).toHaveKey('scope');
                    expect(cached.sub).toBe(user.getId());
                    mockUser.delete(user);
                });

                it('authenticate() does NOT populate connectionMetadata with the decoded token', () => {
                    var ws       = getWebSocket();
                    var user     = mockUser.make();
                    var jwt      = mockUser.login(user);
                    var metadata = {};

                    ws.authenticate(
                        login              = jwt,
                        passcode           = '',
                        host               = 'localhost',
                        channel            = mockChannel(),
                        connectionMetadata = metadata
                    );

                    expect(metadata).notToHaveKey('decodedToken');
                    mockUser.delete(user);
                });

                it('Cache TTL is set to 1, minimum allowed by CacheBox', () => {
                    var ws              = getWebSocket();
                    var user            = mockUser.make();
                    var jwt             = mockUser.login(user);
                    var channel         = mockChannel();
                    var expectedTTL     = 1;
                    var expectedTimeout = 30;

                    ws.authenticate(
                        login              = jwt,
                        passcode           = '',
                        host               = 'localhost',
                        channel            = channel,
                        connectionMetadata = {}
                    );

                    // Entry should exist immediately after authenticate
                    expect(isNull(cache.get('ws_token_#channel.hashCode()#'))).toBeFalse();

                    var cachedMeta = cache.getCachedObjectMetadata('ws_token_#channel.hashCode()#');

                    expect(cachedMeta).toHaveKey('lastAccessTimeout');
                    expect(cachedMeta.lastAccessTimeout).toBe(expectedTTL); // 1 minute last access
                    expect(cachedMeta.timeout).toBe(expectedTimeout); // 30 minute timeout in cache (matches JWT)
                    expect(cachedMeta.isExpired).toBeFalse();
                    mockUser.delete(user);
                });

                it('Failed authentication does not store anything in cache', () => {
                    var ws      = getWebSocket();
                    var channel = mockChannel();

                    ws.authenticate(
                        login              = 'invalid.token.value',
                        passcode           = '',
                        host               = 'localhost',
                        channel            = channel,
                        connectionMetadata = {}
                    );

                    var cached = cache.get('ws_token_#channel.hashCode()#');
                    expect(isNull(cached)).toBeTrue();
                });

                it('authorize() reads decoded token from cache', () => {
                    var ws      = getWebSocket();
                    var user    = mockUser.make(security_level = 50);
                    var jwt     = mockUser.login(user);
                    var channel = mockChannel();

                    ws.authenticate(
                        login              = jwt,
                        passcode           = '',
                        host               = 'localhost',
                        channel            = channel,
                        connectionMetadata = {}
                    );

                    application.STOMPBroker.STOMPConnections[channel.hashCode()] = _mockSTOMPConnection(channel, jwt);

                    var result = ws.authorize(
                        login              = jwt,
                        exchange           = 'topic',
                        destination        = 'metrics',
                        access             = 'subscribe',
                        channel            = channel,
                        connectionMetadata = {}
                    );

                    expect(result).toBeTrue();
                    mockUser.delete(user);
                });

                it('authorize() returns false when cache has expired', () => {
                    var ws      = getWebSocket();
                    var user    = mockUser.make(security_level = 50);
                    var jwt     = mockUser.login(user);
                    var channel = mockChannel();

                    application.STOMPBroker.STOMPConnections[channel.hashCode()] = _mockSTOMPConnection(channel, jwt);

                    // Intentionally skip authenticate() so nothing is in cache
                    var result = ws.authorize(
                        login              = jwt,
                        exchange           = 'topic',
                        destination        = 'metrics',
                        access             = 'subscribe',
                        channel            = channel,
                        connectionMetadata = {}
                    );

                    expect(result).toBeFalse();
                    mockUser.delete(user);
                });

                it('authorize() returns false after cache is manually cleared', () => {
                    var ws      = getWebSocket();
                    var user    = mockUser.make(security_level = 50);
                    var jwt     = mockUser.login(user);
                    var channel = mockChannel();

                    ws.authenticate(
                        login              = jwt,
                        passcode           = '',
                        host               = 'localhost',
                        channel            = channel,
                        connectionMetadata = {}
                    );

                    application.STOMPBroker.STOMPConnections[channel.hashCode()] = _mockSTOMPConnection(channel, jwt);

                    // Simulate cache expiry by clearing manually
                    cache.clear('ws_token_#channel.hashCode()#');

                    var result = ws.authorize(
                        login              = jwt,
                        exchange           = 'topic',
                        destination        = 'metrics',
                        access             = 'subscribe',
                        channel            = channel,
                        connectionMetadata = {}
                    );

                    expect(result).toBeFalse();
                    mockUser.delete(user);
                });

                it('Different channels get separate cache entries', () => {
                    var ws    = getWebSocket();
                    var user1 = mockUser.make(security_level = 50);
                    var user2 = mockUser.make(security_level = 10);

                    var jwt1     = mockUser.login(user1);
                    var channel1 = mockChannel('channel1');
                    ws.authenticate(
                        login              = jwt1,
                        passcode           = '',
                        host               = 'localhost',
                        channel            = channel1,
                        connectionMetadata = {}
                    );
                    mockUser.logout(user1, jwt1);

                    var jwt2     = mockUser.login(user2);
                    var channel2 = mockChannel('channel2');
                    ws.authenticate(
                        login              = jwt2,
                        passcode           = '',
                        host               = 'localhost',
                        channel            = channel2,
                        connectionMetadata = {}
                    );
                    mockUser.logout(user2, jwt2);

                    var cached1 = cache.get('ws_token_#channel1.hashCode()#');
                    var cached2 = cache.get('ws_token_#channel2.hashCode()#');

                    expect(cached1.sub).toBe(user1.getId());
                    expect(cached2.sub).toBe(user2.getId());
                    expect(cached1.sub).notToBe(cached2.sub);

                    mockUser.delete(user1);
                    mockUser.delete(user2);
                });
            });

            /**
             * Exception logging tests
             */
            describe('Exception logging', () => {
                it('Does not log when login is empty', () => {
                    var ws            = getWebSocket();
                    var mockLog       = _getMockLogger();
                    application.wsLog = mockLog;

                    ws.authenticate(
                        login              = '',
                        passcode           = '',
                        host               = 'localhost',
                        channel            = mockChannel(),
                        connectionMetadata = {}
                    );

                    expect(mockLog.warnCalled).toBeFalse();
                    expect(mockLog.errorCalled).toBeFalse();
                });

                it('Silences warning when token is invalid', () => {
                    var ws            = getWebSocket();
                    var mockLog       = _getMockLogger();
                    application.wsLog = mockLog;

                    ws.authenticate(
                        login              = 'invalid.token.value',
                        passcode           = '',
                        host               = 'localhost',
                        channel            = mockChannel(),
                        connectionMetadata = {}
                    );

                    expect(mockLog.warnCalled).toBeFalse();
                });

                it('Silences warning when token is invalidated', () => {
                    var ws   = getWebSocket();
                    var user = mockUser.make();
                    var jwt  = mockUser.login(user);

                    jwtService.invalidate(jwt);

                    var mockLog       = _getMockLogger();
                    application.wsLog = mockLog;

                    ws.authenticate(
                        login              = jwt,
                        passcode           = '',
                        host               = 'localhost',
                        channel            = mockChannel(),
                        connectionMetadata = {}
                    );

                    expect(mockLog.warnCalled).toBeFalse();
                    mockUser.delete(user);
                });

                it('Silences warning when token is expired', () => {
                    var ws   = getWebSocket();
                    var user = mockUser.make();

                    var expiredPayload = {
                        iss  : 'test',
                        iat  : jwtService.toEpoch(dateAdd('n', -120, now())),
                        sub  : user.getId(),
                        exp  : jwtService.toEpoch(dateAdd('n', -60, now())),
                        jti  : 'expiredtesttoken',
                        scope: ''
                    };
                    var expiredJwt = jwtService.encode(expiredPayload);

                    var mockLog       = _getMockLogger();
                    application.wsLog = mockLog;

                    ws.authenticate(
                        login              = expiredJwt,
                        passcode           = '',
                        host               = 'localhost',
                        channel            = mockChannel(),
                        connectionMetadata = {}
                    );

                    expect(mockLog.warnCalled).toBeFalse();
                    mockUser.delete(user);
                });

                it('Logs an error on unexpected exception during authentication', () => {
                    var ws                   = getWebSocket();
                    var brokenJwtService     = createObject('component', 'tests.resources.brokenJwtService');
                    application.wsJwtService = brokenJwtService;

                    var mockLog       = _getMockLogger();
                    application.wsLog = mockLog;

                    ws.authenticate(
                        login              = 'any.token.value',
                        passcode           = '',
                        host               = 'localhost',
                        channel            = mockChannel(),
                        connectionMetadata = {}
                    );

                    expect(mockLog.errorCalled).toBeTrue();
                    expect(mockLog.lastErrorMessage).toInclude('unexpectedly');

                    application.wsJwtService = jwtService;
                });

                it('Logs a warning when authorizing with no sessionID', () => {
                    var ws      = getWebSocket();
                    var user    = mockUser.make(security_level = 50);
                    var jwt     = mockUser.login(user);
                    var channel = mockChannel(sessionID = 'nosessionid');

                    application.STOMPBroker.STOMPConnections = {};

                    // Populate cache as if authenticate() ran
                    var tokenTTL = 1;
                    cache.set(
                        'ws_token_#channel.hashCode()#',
                        jwtService.decode(jwt),
                        0,
                        tokenTTL
                    );

                    // No STOMPConnections entry so sessionID will be empty
                    var mockLog       = _getMockLogger();
                    application.wsLog = mockLog;

                    ws.authorize(
                        login              = jwt,
                        exchange           = 'topic',
                        destination        = 'metrics',
                        access             = 'subscribe',
                        channel            = channel,
                        connectionMetadata = {}
                    );

                    expect(mockLog.warnCalled).toBeTrue();
                    expect(mockLog.lastWarnMessage).toInclude('no sessionID');
                    mockUser.delete(user);
                });

                it('Logs a warning when cache is missing during authorization', () => {
                    var ws      = getWebSocket();
                    var user    = mockUser.make(security_level = 50);
                    var jwt     = mockUser.login(user);
                    var channel = mockChannel();

                    application.STOMPBroker.STOMPConnections[channel.hashCode()] = _mockSTOMPConnection(channel, jwt);

                    var mockLog       = _getMockLogger();
                    application.wsLog = mockLog;

                    // No authenticate() call so cache is empty
                    ws.authorize(
                        login              = jwt,
                        exchange           = 'topic',
                        destination        = 'metrics',
                        access             = 'subscribe',
                        channel            = channel,
                        connectionMetadata = {}
                    );

                    expect(mockLog.warnCalled).toBeTrue();
                    expect(mockLog.lastWarnMessage).toInclude('token not in cache');
                    mockUser.delete(user);
                });

                it('Logs a warning when authorizing with insufficient scope', () => {
                    var ws      = getWebSocket();
                    var user    = mockUser.make(security_level = 10);
                    var jwt     = mockUser.login(user);
                    var channel = mockChannel();

                    ws.authenticate(
                        login              = jwt,
                        passcode           = '',
                        host               = 'localhost',
                        channel            = channel,
                        connectionMetadata = {}
                    );

                    application.STOMPBroker.STOMPConnections[channel.hashCode()] = _mockSTOMPConnection(channel, jwt);

                    var mockLog       = _getMockLogger();
                    application.wsLog = mockLog;

                    ws.authorize(
                        login              = jwt,
                        exchange           = 'topic',
                        destination        = 'metrics',
                        access             = 'subscribe',
                        channel            = channel,
                        connectionMetadata = {}
                    );

                    expect(mockLog.warnCalled).toBeTrue();
                    expect(mockLog.lastWarnMessage).toInclude('insufficient scope');
                    expect(mockLog.lastWarnMessage).toInclude(jwtService.decode(jwt).sub);
                    mockUser.delete(user);
                });

                it('Logs an error on unexpected exception during authorization', () => {
                    var ws      = getWebSocket();
                    var user    = mockUser.make(security_level = 50);
                    var jwt     = mockUser.login(user);
                    var channel = mockChannel();

                    application.STOMPBroker.STOMPConnections[channel.hashCode()] = _mockSTOMPConnection(channel, jwt);

                    // Put something non-struct in the cache to trigger an unexpected error in scope check
                    cache.set(
                        'ws_token_#channel.hashCode()#',
                        'not-a-struct',
                        0,
                        60
                    );

                    var mockLog       = _getMockLogger();
                    application.wsLog = mockLog;

                    ws.authorize(
                        login              = jwt,
                        exchange           = 'topic',
                        destination        = 'metrics',
                        access             = 'subscribe',
                        channel            = channel,
                        connectionMetadata = {}
                    );

                    expect(mockLog.errorCalled).toBeTrue();
                    expect(mockLog.lastErrorMessage).toInclude('unexpectedly');
                    mockUser.delete(user);
                });
            });

            /**
             * Core authentication and authorization
             */
            describe('Core authentication and authorization', () => {
                it('Socket can be created', () => {
                    var ws = getWebSocket();
                    expect(ws).toBeComponent();
                });

                it('Can configure correctly and register metrics topic', () => {
                    var ws     = getWebSocket();
                    var config = ws.getConfig();
                    expect(config.exchanges.topic.bindings).toHaveKey('metrics');
                });

                it('Can authenticate JWT successfully', () => {
                    var ws   = getWebSocket();
                    var user = mockUser.make();
                    var jwt  = mockUser.login(user);

                    var result = ws.authenticate(
                        login              = jwt,
                        passcode           = '',
                        host               = 'localhost',
                        channel            = mockChannel(),
                        connectionMetadata = {}
                    );

                    expect(result).toBeTrue();
                    mockUser.delete(user);
                });

                it('Can fail JWT authentication with invalidated token', () => {
                    var ws   = getWebSocket();
                    var user = mockUser.make();
                    var jwt  = mockUser.login(user);

                    jwtService.invalidate(jwt);

                    var result = ws.authenticate(
                        login              = jwt,
                        passcode           = '',
                        host               = 'localhost',
                        channel            = mockChannel(),
                        connectionMetadata = {}
                    );

                    expect(result).toBeFalse();
                    mockUser.delete(user);
                });

                it('Can authorize ADMIN user to metrics topic', () => {
                    var ws      = getWebSocket();
                    var user    = mockUser.make(security_level = 50);
                    var jwt     = mockUser.login(user);
                    var channel = mockChannel();

                    ws.authenticate(
                        login              = jwt,
                        passcode           = '',
                        host               = 'localhost',
                        channel            = channel,
                        connectionMetadata = {}
                    );

                    application.STOMPBroker.STOMPConnections[channel.hashCode()] = _mockSTOMPConnection(channel, jwt);

                    var result = ws.authorize(
                        login              = jwt,
                        exchange           = 'topic',
                        destination        = 'metrics',
                        access             = 'subscribe',
                        channel            = channel,
                        connectionMetadata = {}
                    );

                    expect(result).toBeTrue();
                    mockUser.delete(user);
                });

                it('Can fail authorization with non ADMIN user to metrics topic', () => {
                    var ws      = getWebSocket();
                    var user    = mockUser.make(security_level = 10);
                    var jwt     = mockUser.login(user);
                    var channel = mockChannel();

                    ws.authenticate(
                        login              = jwt,
                        passcode           = '',
                        host               = 'localhost',
                        channel            = channel,
                        connectionMetadata = {}
                    );

                    application.STOMPBroker.STOMPConnections[channel.hashCode()] = _mockSTOMPConnection(channel, jwt);

                    var result = ws.authorize(
                        login              = jwt,
                        exchange           = 'topic',
                        destination        = 'metrics',
                        access             = 'subscribe',
                        channel            = channel,
                        connectionMetadata = {}
                    );

                    expect(result).toBeFalse();
                    mockUser.delete(user);
                });

                it('Can broadcast a message to metrics', () => {
                    var ws = getWebSocket();
                    expect(() => {
                        ws.send('topic/metrics', {time: now()});
                    }).notToThrow();
                });
            });
        });
    }

    /**
     * Creates a lightweight mock logger that records calls for assertion
     */
    private struct function _getMockLogger() {
        var mockLogger = {
            warnCalled      : false,
            errorCalled     : false,
            lastWarnMessage : '',
            lastErrorMessage: '',
            warn            : '',
            error           : ''
        };

        mockLogger.warn = function(message) {
            mockLogger.warnCalled      = true;
            mockLogger.lastWarnMessage = arguments.message;
        };

        mockLogger.error = function(message) {
            mockLogger.errorCalled      = true;
            mockLogger.lastErrorMessage = arguments.message;
        };

        return mockLogger;
    }

    /**
     * Build a minimal STOMPConnections entry for a channel
     */
    private struct function _mockSTOMPConnection(required channel, required string jwt) {
        return {
            channel           : arguments.channel,
            login             : arguments.jwt,
            connectDate       : now(),
            sessionID         : arguments.channel.hashCode(),
            connectionMetadata: {}
        };
    }

    /**
     * Mock websocket channel
     *
     * @sessionID The hashCode the channel will return, defaults to mockChannelHash123
     */
    private struct function mockChannel(string sessionID = 'mockChannelHash123') {
        var mockChannel = {hashCode: '', isOpen: ''};

        var id = arguments.sessionID;

        mockChannel.hashCode = () => id;
        mockChannel.isOpen   = () => true;

        return mockChannel;
    }

    /**
     * Wrapper to instantiate new websocket component and run the initial configure
     */
    private component function getWebSocket() {
        var ws = new WebSocket();
        ws.initDeps();
        ws.getConfig();
        return ws;
    }

}
