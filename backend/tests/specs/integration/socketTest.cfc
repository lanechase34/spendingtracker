component extends="tests.resources.baseTest" {

    property name="jwtService" inject="JwtService@cbsecurity";
    property name="cbauth"     inject="authenticationService@cbauth";

    function beforeAll() {
        super.beforeAll();
        mockUser = getInstance('tests.resources.mockuser');
    }

    function run() {
        describe('Socketbox Integration Tests', () => {
            beforeEach(() => {
                setup();

                // Make sure nothing is logged in to start our calls
                cbauth.logout();
                jwtService.getTokenStorage().clearAll();
            });

            it('Socket can be created', () => {
                var ws = new WebSocket();
                expect(ws).toBeComponent();
            });

            it('Can configure correctly and register metrics topic', () => {
                var ws     = new WebSocket();
                var config = ws.getConfig();
                expect(config.exchanges.topic.bindings).toHaveKey('metrics');
            });

            it('Can authenticate JWT successfully', () => {
                var ws = new WebSocket();

                var user = mockUser.make();
                var jwt  = mockUser.login(user);

                var authenticateResult = ws.authenticate(
                    login              = jwt,
                    passcode           = '',
                    host               = 'localhost',
                    channel            = {},
                    connectionMetadata = {}
                );
                expect(authenticateResult).toBeTrue();
                mockUser.delete(user);
            });

            it('Can fail JWT authentication', () => {
                var ws = new WebSocket();

                var user = mockUser.make();
                var jwt  = mockUser.login(user);

                // Force invalidate the jwt
                jwtService.invalidate(jwt);

                var authenticateResult = ws.authenticate(
                    login              = jwt,
                    passcode           = '',
                    host               = 'localhost',
                    channel            = {},
                    connectionMetadata = {}
                );
                expect(authenticateResult).toBeFalse();
                mockUser.delete(user);
            });

            it('Can authorize ADMIN user to metrics topic', () => {
                var ws = new WebSocket();

                // Admin user
                var user         = mockUser.make(security_level = 50);
                var jwt          = mockUser.login(user);
                var decodedToken = jwtService.decode(token = jwt);

                var metadata = {};

                /**
                 * Mock the connection channel
                 */
                var channel = mockChannel();

                application.STOMPBroker.STOMPConnections[channel.hashCode()] = {
                    channel           : channel,
                    login             : jwt,
                    connectDate       : now(),
                    sessionID         : channel.hashCode(),
                    connectionMetadata: {decodedToken: decodedToken}
                }

                var authenticateResult = ws.authenticate(
                    login              = jwt,
                    passcode           = '',
                    host               = 'localhost',
                    channel            = {},
                    connectionMetadata = {}
                );
                expect(authenticateResult).toBeTrue();

                var authorizeResult = ws.authorize(
                    login              = jwt,
                    exchange           = 'topic',
                    destination        = 'metrics',
                    access             = 'subscribe',
                    channel            = channel,
                    connectionMetadata = application.STOMPBroker.STOMPConnections[channel.hashCode()].connectionMetadata
                );
                expect(authorizeResult).toBeTrue();
                mockUser.delete(user);
            });

            it('Can fail authorization with non ADMIN user to metrics topic', () => {
                var ws = new WebSocket();

                var user         = mockUser.make(security_level = 10);
                var jwt          = mockUser.login(user);
                var decodedToken = jwtService.decode(token = jwt);

                var metadata = {};

                /**
                 * Mock the connection channel
                 */
                var channel = mockChannel();

                application.STOMPBroker.STOMPConnections[channel.hashCode()] = {
                    channel           : channel,
                    login             : jwt,
                    connectDate       : now(),
                    sessionID         : channel.hashCode(),
                    connectionMetadata: {decodedToken: decodedToken}
                }

                /**
                 * Can authenticate, but the authorization will fail (insufficient permission)
                 */
                var authenticateResult = ws.authenticate(
                    login              = jwt,
                    passcode           = '',
                    host               = 'localhost',
                    channel            = {},
                    connectionMetadata = {}
                );
                expect(authenticateResult).toBeTrue();

                var authorizeResult = ws.authorize(
                    login              = jwt,
                    exchange           = 'topic',
                    destination        = 'metrics',
                    access             = 'subscribe',
                    channel            = channel,
                    connectionMetadata = application.STOMPBroker.STOMPConnections[channel.hashCode()].connectionMetadata
                );
                expect(authorizeResult).toBeFalse();
                mockUser.delete(user);
            });

            it('Can broadcast a message to metrics', () => {
                var ws = new WebSocket();

                expect(() => {
                    ws.send('topic/metrics', {time: now()});
                }).notToThrow();
            });
        });
    }

    /**
     * Mock session id for websocket channel
     */
    private struct function mockChannel() {
        return {hashCode: () => 'mockChannelHash123', isOpen: () => true};
    }

}
