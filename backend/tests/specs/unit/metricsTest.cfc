component extends="coldbox.system.testing.BaseTestCase" {

    function beforeAll() {
        super.beforeAll();
    }

    function afterAll() {
        super.afterAll();
    }

    /**
     * Fresh, unwired metrics service so tests don't touch the app singleton's counters
     */
    private any function newMetricsService() {
        var service = createMock('models.services.metrics');
        service.$property(
            propertyName = 'settings',
            mock         = {
                slowQueryThreshold: 100,
                maxSlowQueries    : 3,
                sqlLength         : 20,
                diagnosticsTTL    : 30
            }
        );
        service.$property(
            propertyName = 'concurrency',
            mock         = {
                activeRequests: 0,
                maxRequests   : 0,
                slowRequests  : []
            }
        );
        service.onDIComplete();
        return service;
    }

    function run() {
        describe('Metrics Service', () => {
            beforeEach(() => {
                metricsService = newMetricsService();
            });

            describe('queries', () => {
                it('Should start empty', () => {
                    var stats = metricsService.getQueryStats();

                    expect(stats.count).toBe(0);
                    expect(stats.errors).toBe(0);
                    expect(stats.avgMs).toBe(0);
                    expect(stats.maxMs).toBe(0);
                    expect(stats.total).toBe(0);
                    expect(stats.slowQueries).toBeEmpty();
                });

                it('Should count queries and track avg and max time', () => {
                    metricsService.recordQuery(sql = 'select 1', ms = 10);
                    metricsService.recordQuery(sql = 'select 2', ms = 30);
                    metricsService.recordQuery(sql = 'select 3', ms = 20);
                    metricsService.recordQueryError();

                    var stats = metricsService.getQueryStats();

                    expect(stats.count).toBe(3);
                    expect(stats.errors).toBe(1);
                    expect(stats.avgMs).toBe(20);
                    expect(stats.maxMs).toBe(30);
                    expect(stats.total).toBe(3);
                    expect(stats.peak).toBe(3);
                });

                it('Should record slow queries with collapsed, truncated sql', () => {
                    metricsService.recordQuery(sql = 'select 1', ms = 99);
                    metricsService.recordQuery(sql = 'select   *#chr(10)#from expense where userid = ?', ms = 150);

                    var slow = metricsService.getQueryStats().slowQueries;

                    expect(slow).toHaveLength(1);
                    expect(slow[1].sql).toBe('select * from expens');
                    expect(slow[1].ms).toBe(150);
                    expect(slow[1]).toHaveKey('uuid');
                    expect(slow[1]).toHaveKey('time');
                });

                it('Should cap the slow query list, dropping the oldest', () => {
                    for(var i = 1; i <= 5; i++) {
                        metricsService.recordQuery(sql = 'q#i#', ms = 100 + i);
                    }

                    var slow = metricsService.getQueryStats().slowQueries;

                    expect(slow).toHaveLength(3);
                    expect(slow.map((q) => q.sql)).toBe(['q3', 'q4', 'q5']);
                });

                it('Should reset window counters but keep totals, peak and slow queries on markWindow', () => {
                    metricsService.recordQuery(sql = 'select 1', ms = 10);
                    metricsService.recordQuery(sql = 'select 2', ms = 200);
                    metricsService.recordQueryError();

                    metricsService.markWindow(gcTotalMs = 0);
                    metricsService.recordQuery(sql = 'select 3', ms = 5);

                    var stats = metricsService.getQueryStats();

                    expect(stats.count).toBe(1);
                    expect(stats.errors).toBe(0);
                    expect(stats.avgMs).toBe(5);
                    expect(stats.maxMs).toBe(5);
                    expect(stats.total).toBe(3);
                    expect(stats.peak).toBe(2);
                    expect(stats.slowQueries).toHaveLength(1);
                });
            });

            describe('rate limit', () => {
                it('Should count blocks per window, in total, and by event', () => {
                    metricsService.recordRateLimitBlock(event = 'api.login');
                    metricsService.recordRateLimitBlock(event = 'api.login');
                    metricsService.recordRateLimitBlock(event = 'auth.register');

                    var stats = metricsService.getRateLimitStats();

                    expect(stats.blocked).toBe(3);
                    expect(stats.total).toBe(3);
                    expect(stats.byEvent['api.login']).toBe(2);
                    expect(stats.byEvent['auth.register']).toBe(1);
                });

                it('Should reset the window count but keep totals on markWindow', () => {
                    metricsService.recordRateLimitBlock(event = 'api.login');
                    metricsService.markWindow(gcTotalMs = 0);

                    var stats = metricsService.getRateLimitStats();

                    expect(stats.blocked).toBe(0);
                    expect(stats.total).toBe(1);
                    expect(stats.byEvent['api.login']).toBe(1);
                });
            });

            describe('markWindow', () => {
                it('Should reset the active request count but keep the peak', () => {
                    var concurrency = {
                        activeRequests: 4,
                        maxRequests   : 9,
                        slowRequests  : []
                    };
                    metricsService.$property(propertyName = 'concurrency', mock = concurrency);

                    metricsService.markWindow(gcTotalMs = 0);

                    expect(concurrency.activeRequests).toBe(0);
                    expect(concurrency.maxRequests).toBe(9);
                });
            });

            describe('gc', () => {
                it('Should report no delta before the first window mark', () => {
                    var stats = metricsService.getGcStats(gcTotalMs = 500);

                    expect(stats.totalMs).toBe(500);
                    expect(stats.deltaMs).toBe(0);
                    expect(stats.percent).toBe(0);
                });

                it('Should report the delta since the last mark without advancing it', () => {
                    metricsService.markWindow(gcTotalMs = 500);

                    expect(metricsService.getGcStats(gcTotalMs = 520).deltaMs).toBe(20);
                    // Reading again doesn't consume the delta
                    expect(metricsService.getGcStats(gcTotalMs = 520).deltaMs).toBe(20);
                    expect(metricsService.getGcStats(gcTotalMs = 520).percent).toBeBetween(0, 100);
                });
            });
        });
    }

}
