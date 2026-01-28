component extends="tests.resources.baseTest" asyncAll="true" {

    function beforeAll() {
        super.beforeAll();
    }

    function afterAll() {
        super.afterAll();
    }

    function run() {
        describe('Default Behaviors', () => {
            beforeEach((currentSpec) => {
                setup(); // Setup as a new ColdBox request
            });

            it('Ping database', () => {
                var sysdate = queryExecute('select current_timestamp').current_timestamp;
                expect(dateDiff('s', now(), sysdate)).toBeBetween(0, 5);
            });

            it('Can load /healthcheck', () => {
                var event = get(route = '/healthcheck');
                expect(event.getResponse().getStatusCode()).toBe(200);
                expect(event.getResponse().getData()).toBe('Ok!');
            });

            describe('Test addition', () => {
                it('Can add two numbers', () => {
                    expect(sum(1, 2)).toBe(3);
                });

                it('Can add two negative numbers', () => {
                    expect(sum(-1, -2)).toBe(-3);
                });
            });
        });
    }

    private function sum(a, b) {
        return a + b;
    }

}
