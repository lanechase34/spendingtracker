component extends="tests.resources.baseTest" {

    function beforeAll() {
        super.beforeAll();

        subscriptionService = getInstance('services.subscription');
        auditService        = getInstance('services.audit');
        mockUser            = getInstance('tests.resources.mockuser');

        /**
         * Setup user to be shared throughout the test suite
         */
        user = mockUser.make();
        jwt  = mockUser.login(user);
    }

    function afterAll() {
        super.afterAll();

        mockUser.logout(user, jwt);
        mockUser.delete(user);
    }

    function run() {
        describe('subscription.charge', () => {
            beforeEach(() => {
                setup();
                subscriptionHelper.fresh();
            });

            describe('Monthly subscriptions', () => {
                it('Charges a MONTHLY subscription that is due today', () => {
                    var data = subscriptionHelper.mock(
                        date     = now(),
                        interval = 'M',
                        userid   = user.getId()
                    );
                    subscriptionHelper.insert(data);

                    subscriptionService.charge();

                    subscriptionHelper.verifyExpense(data, true);
                });

                it('Charges a MONTHLY subscription that was due in the past and has not been charged yet', () => {
                    var data = subscriptionHelper.mock(
                        date     = dateAdd('m', -3, now()),
                        interval = 'M',
                        userid   = user.getId()
                    );
                    var id = subscriptionHelper.insert(data);

                    subscriptionService.charge();

                    // Only one expense is created per charge() call - the task catches up
                    // one interval at a time on subsequent nightly runs
                    var expenses = subscriptionHelper.getExpenses(id);
                    expect(expenses.len()).toBe(1, 'charge() should create exactly one expense per call');

                    // Next charge date advances from the original due date, not from today
                    var updated = subscriptionHelper.load(id);
                    expect(dateFormat(updated.next_charge_date, 'yyyy-mm-dd')).toBe(
                        dateFormat(dateAdd('m', 1, data.date), 'yyyy-mm-dd')
                    );
                });

                it('Does not charge a MONTHLY subscription whose next charge date is in the future', () => {
                    var data = subscriptionHelper.mock(
                        date     = dateAdd('m', 1, now()),
                        interval = 'M',
                        userid   = user.getId()
                    );
                    subscriptionHelper.insert(data);

                    subscriptionService.charge();

                    subscriptionHelper.verifyExpense(data, false);
                });
            });

            describe('Yearly subscriptions', () => {
                it('Charges a YEARLY subscription that is due today', () => {
                    var data = subscriptionHelper.mock(
                        date     = now(),
                        interval = 'Y',
                        userid   = user.getId()
                    );
                    subscriptionHelper.insert(data);

                    subscriptionService.charge();

                    subscriptionHelper.verifyExpense(data, true);
                });

                it('Charges a YEARLY subscription that was due in the past and has not been charged yet', () => {
                    var data = subscriptionHelper.mock(
                        date     = dateAdd('yyyy', -2, now()),
                        interval = 'Y',
                        userid   = user.getId()
                    );
                    var id = subscriptionHelper.insert(data);

                    subscriptionService.charge();

                    // Only one expense is created per charge() call - the task catches up
                    // one interval at a time on subsequent nightly runs
                    var expenses = subscriptionHelper.getExpenses(id);
                    expect(expenses.len()).toBe(1, 'charge() should create exactly one expense per call');

                    // Next charge date advances from the original due date, not from today
                    var updated = subscriptionHelper.load(id);
                    expect(dateFormat(updated.next_charge_date, 'yyyy-mm-dd')).toBe(
                        dateFormat(dateAdd('yyyy', 1, data.date), 'yyyy-mm-dd')
                    );
                });

                it('Does not charge a YEARLY subscription whose next charge date is in the future', () => {
                    var data = subscriptionHelper.mock(
                        date     = dateAdd('yyyy', 1, now()),
                        interval = 'Y',
                        userid   = user.getId()
                    );
                    subscriptionHelper.insert(data);

                    subscriptionService.charge();

                    subscriptionHelper.verifyExpense(data, false);
                });
            });

            describe('Mixed subscriptions', () => {
                it('Charges a combination of MONTHLY and YEARLY subscriptions that are due', () => {
                    var monthly = subscriptionHelper.mock(
                        date     = now(),
                        interval = 'M',
                        userid   = user.getId()
                    );
                    var yearly = subscriptionHelper.mock(
                        date     = now(),
                        interval = 'Y',
                        userid   = user.getId()
                    );
                    subscriptionHelper.insert(monthly);
                    subscriptionHelper.insert(yearly);

                    subscriptionService.charge();

                    subscriptionHelper.verifyExpense(monthly, true);
                    subscriptionHelper.verifyExpense(yearly, true);
                });

                it('Only charges due subscriptions when a mix of due and future subscriptions exist', () => {
                    var due = subscriptionHelper.mock(
                        date     = now(),
                        interval = 'M',
                        userid   = user.getId()
                    );
                    var notDue = subscriptionHelper.mock(
                        date     = dateAdd('m', 1, now()),
                        interval = 'M',
                        userid   = user.getId()
                    );
                    subscriptionHelper.insert(due);
                    subscriptionHelper.insert(notDue);

                    subscriptionService.charge();

                    subscriptionHelper.verifyExpense(due, true);
                    subscriptionHelper.verifyExpense(notDue, false);
                });
            });

            describe('Inactive subscriptions', () => {
                it('Does not charge an inactive MONTHLY subscription even if it is due', () => {
                    var data = subscriptionHelper.mock(
                        date     = now(),
                        interval = 'M',
                        userid   = user.getId()
                    );
                    subscriptionHelper.insert(data, false);

                    subscriptionService.charge();

                    subscriptionHelper.verifyExpense(data, false);
                });

                it('Does not charge an inactive YEARLY subscription even if it is due', () => {
                    var data = subscriptionHelper.mock(
                        date     = now(),
                        interval = 'Y',
                        userid   = user.getId()
                    );
                    subscriptionHelper.insert(data, false);

                    subscriptionService.charge();

                    subscriptionHelper.verifyExpense(data, false);
                });

                it('Charges only active subscriptions when a mix of active and inactive due subscriptions exist', () => {
                    var active = subscriptionHelper.mock(
                        date     = now(),
                        interval = 'M',
                        userid   = user.getId()
                    );
                    var inactive = subscriptionHelper.mock(
                        date     = now(),
                        interval = 'M',
                        userid   = user.getId()
                    );
                    subscriptionHelper.insert(active, true);
                    subscriptionHelper.insert(inactive, false);

                    subscriptionService.charge();

                    subscriptionHelper.verifyExpense(active, true);
                    subscriptionHelper.verifyExpense(inactive, false);
                });
            });

            describe('Specific subscription charging', () => {
                it('Only charges the specified subscriptionid when provided', () => {
                    var target = subscriptionHelper.mock(
                        date     = now(),
                        interval = 'M',
                        userid   = user.getId()
                    );
                    var other = subscriptionHelper.mock(
                        date     = now(),
                        interval = 'M',
                        userid   = user.getId()
                    );
                    var targetId = subscriptionHelper.insert(target);
                    subscriptionHelper.insert(other);

                    subscriptionService.charge(subscriptionid = targetId);

                    subscriptionHelper.verifyExpense(target, true);
                    subscriptionHelper.verifyExpense(other, false);
                });

                it('Does not charge any subscription when specified subscriptionid is not due', () => {
                    var data = subscriptionHelper.mock(
                        date     = dateAdd('m', 1, now()),
                        interval = 'M',
                        userid   = user.getId()
                    );
                    var id = subscriptionHelper.insert(data);

                    subscriptionService.charge(subscriptionid = id);

                    subscriptionHelper.verifyExpense(data, false);
                });
            });

            describe('Next charge date advancement', () => {
                it('Advances the next charge date by one month after a MONTHLY subscription is charged', () => {
                    var chargeDate = now();
                    var data       = subscriptionHelper.mock(
                        date     = chargeDate,
                        interval = 'M',
                        userid   = user.getId()
                    );
                    var id = subscriptionHelper.insert(data);

                    subscriptionService.charge();

                    var updated  = subscriptionHelper.load(id);
                    var expected = dateAdd('m', 1, chargeDate);

                    expect(dateFormat(updated.next_charge_date, 'yyyy-mm-dd')).toBe(
                        dateFormat(expected, 'yyyy-mm-dd'),
                        'Expected next_charge_date to advance by 1 month'
                    );
                });

                it('Advances the next charge date by one year after a YEARLY subscription is charged', () => {
                    var chargeDate = now();
                    var data       = subscriptionHelper.mock(
                        date     = chargeDate,
                        interval = 'Y',
                        userid   = user.getId()
                    );
                    var id = subscriptionHelper.insert(data);

                    subscriptionService.charge();

                    var updated  = subscriptionHelper.load(id);
                    var expected = dateAdd('yyyy', 1, chargeDate);

                    expect(dateFormat(updated.next_charge_date, 'yyyy-mm-dd')).toBe(
                        dateFormat(expected, 'yyyy-mm-dd'),
                        'Expected next_charge_date to advance by 1 year'
                    );
                });

                it('Does not advance the next charge date when the subscription is not due', () => {
                    var futureDate = dateAdd('m', 1, now());
                    var data       = subscriptionHelper.mock(
                        date     = futureDate,
                        interval = 'M',
                        userid   = user.getId()
                    );
                    var id = subscriptionHelper.insert(data);

                    subscriptionService.charge();

                    var record = subscriptionHelper.load(id);

                    expect(dateFormat(record.next_charge_date, 'yyyy-mm-dd')).toBe(
                        dateFormat(futureDate, 'yyyy-mm-dd'),
                        'next_charge_date should not have changed for a future subscription'
                    );
                });

                it('Advances next charge date from the original due date, not from now, to preserve the billing cycle', () => {
                    // Subscription was due 3 months ago and has never been charged
                    // Next charge date should be due_date + 1 month, not now() + 1 month
                    var overdueDate = dateAdd('m', -3, now());
                    var data        = subscriptionHelper.mock(
                        date     = overdueDate,
                        interval = 'M',
                        userid   = user.getId()
                    );
                    var id = subscriptionHelper.insert(data);

                    subscriptionService.charge();

                    var updated            = subscriptionHelper.load(id);
                    var expectedNextCharge = dateAdd('m', 1, overdueDate);

                    expect(dateFormat(updated.next_charge_date, 'yyyy-mm-dd')).toBe(
                        dateFormat(expectedNextCharge, 'yyyy-mm-dd'),
                        'next_charge_date should advance from original due date, not from today'
                    );
                });
            });

            describe('Transaction rollback and retry on failure', () => {
                beforeEach(() => {
                    mockSubscriptionService = subscriptionHelper.createBrokenChargeMock();
                });

                it('Does not create an expense when the transaction fails', () => {
                    var data = subscriptionHelper.mock(
                        date     = now(),
                        interval = 'M',
                        userid   = user.getId()
                    );
                    var id = subscriptionHelper.insert(data);

                    mockSubscriptionService.charge(subscriptionid = id);

                    var expenses = subscriptionHelper.getExpenses(id);
                    expect(expenses.len()).toBe(0, 'No expense should be created when the transaction fails');
                });

                it('Does not advance the next charge date when the transaction fails', () => {
                    var chargeDate = now();
                    var data       = subscriptionHelper.mock(
                        date     = chargeDate,
                        interval = 'M',
                        userid   = user.getId()
                    );
                    var id = subscriptionHelper.insert(data);

                    mockSubscriptionService.charge(subscriptionid = id);

                    var record = subscriptionHelper.load(id);
                    expect(dateFormat(record.next_charge_date, 'yyyy-mm-dd')).toBe(
                        dateFormat(chargeDate, 'yyyy-mm-dd'),
                        'next_charge_date should not advance when the transaction fails'
                    );
                });

                it('Successfully charges a subscription on a subsequent run after a prior failure left next_charge_date unchanged', () => {
                    var data = subscriptionHelper.mock(
                        date     = now(),
                        interval = 'M',
                        userid   = user.getId()
                    );
                    var id = subscriptionHelper.insert(data);

                    // First charge fails
                    mockSubscriptionService.charge(subscriptionid = id);
                    var expenses = subscriptionHelper.getExpenses(id);
                    expect(expenses.len()).toBe(0, 'No expense should exist after the failed first run');

                    // Second run should succeed since next_charge_date was not advanced
                    mockSubscriptionService.charge(subscriptionid = id);
                    expenses = subscriptionHelper.getExpenses(id);
                    expect(expenses.len()).toBe(1, 'Expense should be created on the successful retry run');
                });

                it('Continues charging other due subscriptions when one transaction fails', () => {
                    var a = subscriptionHelper.mock(
                        date        = now(),
                        interval    = 'M',
                        userid      = user.getId(),
                        description = 'Subscription A'
                    );
                    var b = subscriptionHelper.mock(
                        date        = now(),
                        interval    = 'M',
                        userid      = user.getId(),
                        description = 'Subscription B'
                    );

                    // Since the charge runs in parallel, A or B can be charged 'first' which fails
                    var aId = subscriptionHelper.insert(a);
                    var bId = subscriptionHelper.insert(b);

                    mockSubscriptionService.charge();

                    // Wait for A or B to charge
                    waitFor(
                        condition = () => {
                            return subscriptionHelper.getExpenses(aId).len() == 1 ||
                            subscriptionHelper.getExpenses(bId).len() == 1
                        },
                        timeout = 5,
                        message = 'Successful subscription was never created within the timeout period'
                    );

                    var badId       = subscriptionHelper.getExpenses(aId).len() == 1 ? bId : aId;
                    var badExpenses = subscriptionHelper.getExpenses(badId);
                    expect(badExpenses.len()).toBe(0, 'Failed subscription should not have an expense');
                });
            });

            describe('Audit on charge failure', () => {
                beforeEach(() => {
                    mockSubscriptionService = subscriptionHelper.createBrokenChargeMock();
                });

                it('Creates an audit record when a subscription transaction fails', () => {
                    var data = subscriptionHelper.mock(
                        date     = now(),
                        interval = 'M',
                        userid   = user.getId()
                    );
                    var id = subscriptionHelper.insert(data);

                    var auditCountBefore = subscriptionHelper.countSubscriptionAudits();

                    mockSubscriptionService.charge();

                    var auditCountAfter = subscriptionHelper.countSubscriptionAudits();

                    expect(auditCountAfter).toBe(
                        auditCountBefore + 1,
                        'Expected one audit record to be created on transaction failure'
                    );
                });

                it('Does not create an audit record when a subscription is charged successfully', () => {
                    var data = subscriptionHelper.mock(
                        date     = now(),
                        interval = 'M',
                        userid   = user.getId()
                    );
                    var id = subscriptionHelper.insert(data);

                    var auditCountBefore = subscriptionHelper.countSubscriptionAudits();

                    subscriptionService.charge();

                    var auditCountAfter = subscriptionHelper.countSubscriptionAudits();

                    expect(auditCountAfter).toBe(
                        auditCountBefore,
                        'No audit record should be created on a successful charge'
                    );
                });
            });
        });
    }

}
