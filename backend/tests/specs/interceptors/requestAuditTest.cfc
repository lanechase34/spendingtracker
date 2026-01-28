component extends="coldbox.system.testing.BaseInterceptorTest" interceptor="interceptors.requestAudit" {

    function beforeAll() {
        super.beforeAll();

        // Init inteceptor
        super.setup();

        // Mock inteceptor dependencies
        mockAsync           = createEmptyMock('coldbox.system.async.AsyncManager');
        mockAuditService    = createEmptyMock(className = 'models.services.audit');
        mockSecurityService = createEmptyMock(className = 'models.services.security');
        mockConcurrency     = {slowRequests: []};

        // Mock audit settings
        mockAuditSettings = {
            urlpathLength       : 500,
            methodLength        : 10,
            agentLength         : 250,
            detailLength        : 500,
            slowRequestThreshold: 1000,
            maxSlowRequests     : 25
        };
    }

    function afterAll() {
        super.afterAll();
    }

    function run() {
        describe('RequestAudit Interceptor', () => {
            beforeEach(() => {
                setup();

                // Reset mocks before each test
                mockAsync.$reset();
                mockAuditService.$reset();
                mockSecurityService.$reset();

                // Reset concurrency struct
                mockConcurrency.slowRequests = [];

                // Inject dependencies
                interceptor.$property(propertyName = 'async', mock = mockAsync);
                interceptor.$property(propertyName = 'auditService', mock = mockAuditService);
                interceptor.$property(propertyName = 'securityService', mock = mockSecurityService);
                interceptor.$property(propertyName = 'concurrency', mock = mockConcurrency);
                interceptor.$property(propertyName = 'AUDIT_SETTINGS', mock = mockAuditSettings);
                interceptor.$property(propertyName = 'LOG_REQUESTS', mock = true);

                // Mock event and data objects
                mockRequestContext = createEmptyMock('coldbox.system.web.context.RequestContext');

                mockData   = {};
                mockBuffer = '';
                rc         = {};
                prc        = {};

                // Setup default mock responses
                mockSecurityService.$('getRequestIP', '192.168.1.100');
                mockSecurityService.$('getUserAgent', 'Mozilla/5.0 Test Browser');
                mockRequestContext.$('getFullPath', '/api/v1/users');
                mockRequestContext.$('getHTTPMethod', 'GET');

                // Mock async future
                var mockFuture = createEmptyMock(className = 'coldbox.system.async.tasks.Future');
                mockAsync.$('newFuture', mockFuture);

                // Mock audit
                mockAuditService.$('audit');
            });

            describe('configure()', () => {
                it('Should set URLPATH_LENGTH from AUDIT_SETTINGS', () => {
                    interceptor.configure();

                    expect(interceptor.$getProperty('URLPATH_LENGTH')).toBe(500);
                });

                it('Should set METHOD_LENGTH from AUDIT_SETTINGS', () => {
                    interceptor.configure();

                    expect(interceptor.$getProperty('METHOD_LENGTH')).toBe(10);
                });

                it('Should set AGENT_LENGTH from AUDIT_SETTINGS', () => {
                    interceptor.configure();

                    expect(interceptor.$getProperty('AGENT_LENGTH')).toBe(250);
                });

                it('Should set DETAIL_LENGTH from AUDIT_SETTINGS', () => {
                    interceptor.configure();

                    expect(interceptor.$getProperty('DETAIL_LENGTH')).toBe(500);
                });

                it('Should set SLOW_REQUEST_THRESHOLD from AUDIT_SETTINGS', () => {
                    interceptor.configure();

                    expect(interceptor.$getProperty('SLOW_REQUEST_THRESHOLD')).toBe(1000);
                });

                it('Should set MAX_SLOW_REQUESTS from AUDIT_SETTINGS', () => {
                    interceptor.configure();

                    expect(interceptor.$getProperty('MAX_SLOW_REQUESTS')).toBe(25);
                });

                it('Should configure all settings in one call', () => {
                    var customSettings = {
                        urlpathLength       : 100,
                        methodLength        : 5,
                        agentLength         : 50,
                        detailLength        : 100,
                        slowRequestThreshold: 500,
                        maxSlowRequests     : 10
                    };
                    interceptor.$property(propertyName = 'AUDIT_SETTINGS', mock = customSettings);

                    interceptor.configure();

                    expect(interceptor.$getProperty('URLPATH_LENGTH')).toBe(100);
                    expect(interceptor.$getProperty('METHOD_LENGTH')).toBe(5);
                    expect(interceptor.$getProperty('AGENT_LENGTH')).toBe(50);
                    expect(interceptor.$getProperty('DETAIL_LENGTH')).toBe(100);
                    expect(interceptor.$getProperty('SLOW_REQUEST_THRESHOLD')).toBe(500);
                    expect(interceptor.$getProperty('MAX_SLOW_REQUESTS')).toBe(10);
                });
            });

            describe('preProcess()', () => {
                beforeEach(() => {
                    // Configure interceptor before each test
                    interceptor.configure();
                });

                it('Should initialize prc.requestAudit with correct structure', () => {
                    interceptor.preProcess(
                        event  = mockRequestContext,
                        data   = mockData,
                        buffer = mockBuffer,
                        rc     = rc,
                        prc    = prc
                    );

                    expect(prc).toHaveKey('requestAudit');
                    expect(prc.requestAudit).toBeStruct();
                    expect(prc.requestAudit).toHaveKey('ip');
                    expect(prc.requestAudit).toHaveKey('urlpath');
                    expect(prc.requestAudit).toHaveKey('method');
                    expect(prc.requestAudit).toHaveKey('start');
                    expect(prc.requestAudit).toHaveKey('agent');
                    expect(prc.requestAudit).toHaveKey('detail');
                    expect(prc.requestAudit).toHaveKey('statuscode');
                    expect(prc.requestAudit).toHaveKey('userid');
                });

                it('Should set IP from securityService', () => {
                    interceptor.preProcess(
                        event  = mockRequestContext,
                        data   = mockData,
                        buffer = mockBuffer,
                        rc     = rc,
                        prc    = prc
                    );

                    // Calls securityService.getRequestIP()
                    expect(mockSecurityService.$once('getRequestIP')).toBeTrue();
                    expect(prc.requestAudit.ip).toBe('192.168.1.100');
                });

                it('Should set urlpath from event.getFullPath()', () => {
                    interceptor.preProcess(
                        event  = mockRequestContext,
                        data   = mockData,
                        buffer = mockBuffer,
                        rc     = rc,
                        prc    = prc
                    );

                    // Calls event.getFullPath()
                    expect(mockRequestContext.$once('getFullPath')).toBeTrue();
                    expect(prc.requestAudit.urlpath).toBe('/api/v1/users');
                });

                it('Should truncate urlpath to URLPATH_LENGTH', () => {
                    var longPath = repeatString('a', 600);
                    mockRequestContext.$('getFullPath', longPath);

                    interceptor.preProcess(
                        event  = mockRequestContext,
                        data   = mockData,
                        buffer = mockBuffer,
                        rc     = rc,
                        prc    = prc
                    );

                    expect(len(prc.requestAudit.urlpath)).toBe(500);
                });

                it('Should set method from event.getHTTPMethod()', () => {
                    mockRequestContext.$('getHTTPMethod', 'POST');

                    interceptor.preProcess(
                        event  = mockRequestContext,
                        data   = mockData,
                        buffer = mockBuffer,
                        rc     = rc,
                        prc    = prc
                    );

                    // Calls event.getHTTPMethod()
                    expect(mockRequestContext.$once('getHTTPMethod')).toBeTrue();
                    expect(prc.requestAudit.method).toBe('POST');
                });

                it('Should truncate method to METHOD_LENGTH', () => {
                    mockRequestContext.$('getHTTPMethod', 'VERYLONGMETHOD');

                    interceptor.preProcess(
                        event  = mockRequestContext,
                        data   = mockData,
                        buffer = mockBuffer,
                        rc     = rc,
                        prc    = prc
                    );

                    expect(len(prc.requestAudit.method)).toBe(10);
                    expect(prc.requestAudit.method).toBe('VERYLONGME');
                });

                it('Should set start time using getTickCount()', () => {
                    var beforeTick = getTickCount();

                    interceptor.preProcess(
                        event  = mockRequestContext,
                        data   = mockData,
                        buffer = mockBuffer,
                        rc     = rc,
                        prc    = prc
                    );

                    var afterTick = getTickCount();

                    expect(prc.requestAudit.start).toBeGTE(beforeTick);
                    expect(prc.requestAudit.start).toBeLTE(afterTick);
                });

                it('Should set agent from securityService.getUserAgent()', () => {
                    interceptor.preProcess(
                        event  = mockRequestContext,
                        data   = mockData,
                        buffer = mockBuffer,
                        rc     = rc,
                        prc    = prc
                    );

                    // Calls securityService.getUserAgent()
                    expect(mockSecurityService.$once('getUserAgent')).toBeTrue();
                    expect(prc.requestAudit.agent).toBe('Mozilla/5.0 Test Browser');
                });

                it('Should use ''Unknown'' when cgi.http_user_agent does not exist', () => {
                    mockSecurityService.$('getUserAgent', 'Unknown');

                    interceptor.preProcess(
                        event  = mockRequestContext,
                        data   = mockData,
                        buffer = mockBuffer,
                        rc     = rc,
                        prc    = prc
                    );

                    expect(mockSecurityService.$once('getUserAgent')).toBeTrue();
                    expect(prc.requestAudit.agent).toBe('Unknown');
                });

                it('Should truncate agent to AGENT_LENGTH', () => {
                    mockSecurityService.$('getUserAgent', repeatString('b', 300))

                    interceptor.preProcess(
                        event  = mockRequestContext,
                        data   = mockData,
                        buffer = mockBuffer,
                        rc     = rc,
                        prc    = prc
                    );

                    expect(mockSecurityService.$once('getUserAgent')).toBeTrue();
                    expect(len(prc.requestAudit.agent)).toBe(250);
                });

                it('Should initialize detail as empty string', () => {
                    interceptor.preProcess(
                        event  = mockRequestContext,
                        data   = mockData,
                        buffer = mockBuffer,
                        rc     = rc,
                        prc    = prc
                    );

                    expect(prc.requestAudit.detail).toBe('');
                });

                it('Should initialize statuscode as -1', () => {
                    interceptor.preProcess(
                        event  = mockRequestContext,
                        data   = mockData,
                        buffer = mockBuffer,
                        rc     = rc,
                        prc    = prc
                    );

                    expect(prc.requestAudit.statuscode).toBe(-1);
                });

                it('Should initialize userid as -1', () => {
                    interceptor.preProcess(
                        event  = mockRequestContext,
                        data   = mockData,
                        buffer = mockBuffer,
                        rc     = rc,
                        prc    = prc
                    );

                    expect(prc.requestAudit.userid).toBe(-1);
                });
            });

            describe('postProcess()', () => {
                beforeEach(() => {
                    // Configure interceptor
                    interceptor.configure();

                    // Setup prc.requestAudit as if preProcess ran
                    prc.requestAudit = {
                        ip        : '192.168.1.100',
                        urlpath   : '/api/test',
                        method    : 'POST',
                        start     : getTickCount() - 500,
                        agent     : 'Test Agent',
                        detail    : '',
                        statuscode: -1,
                        userid    : -1
                    };

                    // Setup prc.userid
                    prc.userid = 123;

                    // Mock response
                    mockResponse = createStub();
                    mockResponse.$('getStatusCode', 200);
                    mockResponse.$('getMessagesString', 'Success');
                    prc.response = mockResponse;
                });

                it('Should set prc.requestAudit.userid from prc.userid', () => {
                    interceptor.postProcess(event = mockRequestContext, rc = rc, prc = prc);

                    expect(prc.requestAudit.userid).toBe(123);
                });

                it('Should calculate delta from start time', () => {
                    interceptor.postProcess(event = mockRequestContext, rc = rc, prc = prc);

                    expect(prc.requestAudit).toHaveKey('delta');
                    expect(prc.requestAudit.delta).toBeGTE(0);
                    expect(prc.requestAudit.delta).toBeNumeric();
                });

                it('Should set statuscode from response.getStatusCode()', () => {
                    interceptor.postProcess(event = mockRequestContext, rc = rc, prc = prc);

                    expect(prc.requestAudit.statuscode).toBe(200);
                });

                it('Should use -1 for statuscode when response does not exist', () => {
                    structDelete(prc, 'response');

                    interceptor.postProcess(event = mockRequestContext, rc = rc, prc = prc);

                    expect(prc.requestAudit.statuscode).toBe(-1);
                });

                it('Should set detail from response.getMessagesString()', () => {
                    interceptor.postProcess(event = mockRequestContext, rc = rc, prc = prc);

                    expect(prc.requestAudit.detail).toBe('Success');
                });

                it('Should use empty string for detail when response does not exist', () => {
                    structDelete(prc, 'response');

                    interceptor.postProcess(event = mockRequestContext, rc = rc, prc = prc);

                    expect(prc.requestAudit.detail).toBe('');
                });

                it('Should truncate detail to DETAIL_LENGTH', () => {
                    var longMessage = repeatString('x', 600);
                    mockResponse.$('getMessagesString', longMessage);

                    interceptor.postProcess(event = mockRequestContext, rc = rc, prc = prc);

                    expect(len(prc.requestAudit.detail)).toBe(500);
                });

                it('Should respect custom DETAIL_LENGTH setting', () => {
                    mockAuditSettings.detailLength = 100;
                    interceptor.configure();
                    var longMessage = repeatString('y', 200);
                    mockResponse.$('getMessagesString', longMessage);

                    interceptor.postProcess(event = mockRequestContext, rc = rc, prc = prc);

                    expect(len(prc.requestAudit.detail)).toBe(100);
                });

                it('Should call auditService.audit when LOG_REQUESTS is true', () => {
                    interceptor.$property(propertyName = 'LOG_REQUESTS', mock = true);

                    interceptor.postProcess(event = mockRequestContext, rc = rc, prc = prc);

                    expect(mockAsync.$once('newFuture')).toBeTrue();
                });

                it('Should not call auditService.audit when LOG_REQUESTS is false', () => {
                    interceptor.$property(propertyName = 'LOG_REQUESTS', mock = false);

                    interceptor.postProcess(event = mockRequestContext, rc = rc, prc = prc);

                    expect(mockAsync.$never('newFuture')).toBeTrue();
                });

                it('Should not add to slowRequests when delta is below threshold', () => {
                    prc.requestAudit.start = getTickCount() - 500; // 500ms delta

                    interceptor.postProcess(event = mockRequestContext, rc = rc, prc = prc);

                    expect(arrayLen(mockConcurrency.slowRequests)).toBe(0);
                });

                it('Should not add to slowRequests when delta equals threshold', () => {
                    prc.requestAudit.start = getTickCount() - 1000; // Exactly 1000ms

                    interceptor.postProcess(event = mockRequestContext, rc = rc, prc = prc);

                    expect(arrayLen(mockConcurrency.slowRequests)).toBe(0);
                });

                it('Should add to slowRequests when delta exceeds threshold', () => {
                    prc.requestAudit.start = getTickCount() - 1500; // 1500ms delta

                    interceptor.postProcess(event = mockRequestContext, rc = rc, prc = prc);

                    expect(arrayLen(mockConcurrency.slowRequests)).toBe(1);
                    expect(mockConcurrency.slowRequests[1]).toHaveKey('urlpath');
                    expect(mockConcurrency.slowRequests[1]).toHaveKey('method');
                    expect(mockConcurrency.slowRequests[1]).toHaveKey('delta');
                    expect(mockConcurrency.slowRequests[1]).toHaveKey('userid');
                    expect(mockConcurrency.slowRequests[1]).toHaveKey('time');
                });

                it('Should populate slowRequest with correct data', () => {
                    prc.requestAudit.start = getTickCount() - 1500;

                    interceptor.postProcess(event = mockRequestContext, rc = rc, prc = prc);

                    var slowReq = mockConcurrency.slowRequests[1];
                    expect(slowReq.urlpath).toBe('/api/test');
                    expect(slowReq.method).toBe('POST');
                    expect(slowReq.delta).toBeGT(1000);
                    expect(slowReq.userid).toBe(123);
                    expect(isDate(slowReq.time)).toBeTrue();
                });

                it('Should respect custom SLOW_REQUEST_THRESHOLD setting', () => {
                    mockAuditSettings.slowRequestThreshold = 500;
                    interceptor.configure();
                    prc.requestAudit.start = getTickCount() - 600; // 600ms delta

                    interceptor.postProcess(event = mockRequestContext, rc = rc, prc = prc);

                    expect(arrayLen(mockConcurrency.slowRequests)).toBe(1);
                });

                it('Should filter out requests older than 24 hour', () => {
                    var twentySixHoursAgo = dateAdd('h', -26, now());
                    var thirtyMinsAgo     = dateAdd('n', -30, now());

                    mockConcurrency.slowRequests = [
                        {
                            urlpath: '/old1',
                            method : 'GET',
                            delta  : 1100,
                            userid : 1,
                            time   : twentySixHoursAgo
                        },
                        {
                            urlpath: '/old2',
                            method : 'POST',
                            delta  : 1200,
                            userid : 2,
                            time   : twentySixHoursAgo
                        },
                        {
                            urlpath: '/recent',
                            method : 'GET',
                            delta  : 1300,
                            userid : 3,
                            time   : thirtyMinsAgo
                        }
                    ];

                    prc.requestAudit.start = getTickCount() - 1500;

                    interceptor.postProcess(event = mockRequestContext, rc = rc, prc = prc);
                    // Should have recent + new = 2 items
                    expect(arrayLen(mockConcurrency.slowRequests)).toBe(2);
                    expect(mockConcurrency.slowRequests[1].urlpath).toBe('/recent');
                    expect(mockConcurrency.slowRequests[2].urlpath).toBe('/api/test');
                });

                it('Should enforce MAX_SLOW_REQUESTS limit', () => {
                    // Fill with exactly MAX_SLOW_REQUESTS (25)
                    for(var i = 1; i <= 25; i++) {
                        arrayAppend(
                            mockConcurrency.slowRequests,
                            {
                                urlpath: '/api/old#i#',
                                method : 'GET',
                                delta  : 1100,
                                userid : i,
                                time   : now()
                            }
                        );
                    }

                    prc.requestAudit.start = getTickCount() - 1500;

                    interceptor.postProcess(event = mockRequestContext, rc = rc, prc = prc);

                    expect(arrayLen(mockConcurrency.slowRequests)).toBe(25);
                    expect(mockConcurrency.slowRequests[1].urlpath).toBe('/api/old2'); // First removed
                    expect(mockConcurrency.slowRequests[25].urlpath).toBe('/api/test'); // New added
                });

                it('Should respect custom MAX_SLOW_REQUESTS setting', () => {
                    mockAuditSettings.maxSlowRequests = 5;
                    interceptor.configure();

                    // Fill with 5 slow requests
                    for(var i = 1; i <= 5; i++) {
                        arrayAppend(
                            mockConcurrency.slowRequests,
                            {
                                urlpath: '/api/old#i#',
                                method : 'GET',
                                delta  : 1100,
                                userid : i,
                                time   : now()
                            }
                        );
                    }

                    prc.requestAudit.start = getTickCount() - 1500;

                    interceptor.postProcess(event = mockRequestContext, rc = rc, prc = prc);

                    expect(arrayLen(mockConcurrency.slowRequests)).toBe(5);
                    expect(mockConcurrency.slowRequests[1].urlpath).toBe('/api/old2'); // First removed
                    expect(mockConcurrency.slowRequests[5].urlpath).toBe('/api/test'); // New added
                });

                it('Should remove multiple old entries when over MAX_SLOW_REQUESTS', () => {
                    // Fill with 27 requests (2 over limit)
                    mockAuditSettings.maxSlowRequests = 25;
                    interceptor.configure();
                    for(var i = 1; i <= 27; i++) {
                        arrayAppend(
                            mockConcurrency.slowRequests,
                            {
                                urlpath: '/api/old#i#',
                                method : 'GET',
                                delta  : 1100,
                                userid : i,
                                time   : now()
                            }
                        );
                    }

                    prc.requestAudit.start = getTickCount() - 1500;

                    interceptor.postProcess(event = mockRequestContext, rc = rc, prc = prc);

                    expect(arrayLen(mockConcurrency.slowRequests)).toBe(25);
                    // Should have removed 3 oldest (old1, old2, old3) to make room
                    expect(mockConcurrency.slowRequests[1].urlpath).toBe('/api/old4');
                });

                it('Should handle both filtering and size enforcement together', () => {
                    var twentySixHoursAgo = dateAdd('h', -26, now());

                    // Add 20 old entries (will be filtered)
                    for(var i = 1; i <= 20; i++) {
                        arrayAppend(
                            mockConcurrency.slowRequests,
                            {
                                urlpath: '/old#i#',
                                method : 'GET',
                                delta  : 1100,
                                userid : i,
                                time   : twentySixHoursAgo
                            }
                        );
                    }

                    // Add 10 recent entries (will be kept)
                    for(var i = 1; i <= 10; i++) {
                        arrayAppend(
                            mockConcurrency.slowRequests,
                            {
                                urlpath: '/recent#i#',
                                method : 'GET',
                                delta  : 1100,
                                userid : i,
                                time   : now()
                            }
                        );
                    }

                    prc.requestAudit.start = getTickCount() - 1500;

                    interceptor.postProcess(event = mockRequestContext, rc = rc, prc = prc);
                    // Should have 10 recent + 1 new = 11 total
                    expect(arrayLen(mockConcurrency.slowRequests)).toBe(11);
                    expect(mockConcurrency.slowRequests[11].urlpath).toBe('/api/test');
                });
            });

            describe('Integration Tests', () => {
                it('Should handle complete request lifecycle with slow request', () => {
                    interceptor.configure();
                    interceptor.$property(propertyName = 'LOG_REQUESTS', mock = true);

                    prc.userid   = 456;
                    mockResponse = createStub();
                    mockResponse.$('getStatusCode', 200);
                    mockResponse.$('getMessagesString', 'Operation completed');
                    prc.response = mockResponse;

                    // Act - preProcess
                    interceptor.preProcess(
                        event  = mockRequestContext,
                        data   = mockData,
                        buffer = mockBuffer,
                        rc     = rc,
                        prc    = prc
                    );

                    // Simulate slow request
                    prc.requestAudit.start = getTickCount() - 2000;

                    // Act - postProcess
                    interceptor.postProcess(event = mockRequestContext, rc = rc, prc = prc);

                    // Assert
                    expect(prc.requestAudit.userid).toBe(456);
                    expect(prc.requestAudit.delta).toBeGT(1000);
                    expect(mockAsync.$once('newFuture')).toBeTrue();
                    expect(arrayLen(mockConcurrency.slowRequests)).toBe(1);
                });

                it('Should handle complete request lifecycle with fast request', () => {
                    interceptor.configure();
                    interceptor.$property(propertyName = 'LOG_REQUESTS', mock = true);

                    prc.userid   = 789;
                    mockResponse = createStub();
                    mockResponse.$('getStatusCode', 200);
                    mockResponse.$('getMessagesString', 'Quick response');
                    prc.response = mockResponse;

                    // Act - preProcess
                    interceptor.preProcess(
                        event  = mockRequestContext,
                        data   = mockData,
                        buffer = mockBuffer,
                        rc     = rc,
                        prc    = prc
                    );

                    // Simulate fast request (100ms)
                    prc.requestAudit.start = getTickCount() - 100;

                    // Act - postProcess
                    interceptor.postProcess(event = mockRequestContext, rc = rc, prc = prc);

                    // Assert
                    expect(prc.requestAudit.userid).toBe(789);
                    expect(prc.requestAudit.delta).toBeLT(1000);
                    expect(mockAsync.$once('newFuture')).toBeTrue();
                    expect(arrayLen(mockConcurrency.slowRequests)).toBe(0);
                });

                it('Should handle request with no response object', () => {
                    interceptor.configure();
                    interceptor.$property(propertyName = 'LOG_REQUESTS', mock = false);

                    prc.userid = 999;

                    // Act - preProcess
                    interceptor.preProcess(
                        event  = mockRequestContext,
                        data   = mockData,
                        buffer = mockBuffer,
                        rc     = rc,
                        prc    = prc
                    );

                    // Act - postProcess (no response)
                    interceptor.postProcess(event = mockRequestContext, rc = rc, prc = prc);

                    // Assert
                    expect(prc.requestAudit.statuscode).toBe(-1);
                    expect(prc.requestAudit.detail).toBe('');
                    expect(mockAsync.$never('newFuture')).toBeTrue();
                });
            });
        });
    }

}
