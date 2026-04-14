component {

    variables.calls          = 0;
    // Real expenseService
    variables.expenseService = application.wirebox.getInstance('services.expense');

    // Force an exception when save is called on the first try only
    public void function save(
        required date date,
        required numeric amount,
        required string description,
        required numeric categoryid,
        required string receipt,
        required numeric userid,
        numeric subscriptionid = -1
    ) {
        var shouldFail = false;

        lock name="ThrowingOnceExpenseService_calls" type="exclusive" timeout="5" {
            variables.calls++;
            shouldFail = (variables.calls == 1);
        }

        // First attempt will fail
        if(shouldFail) {
            throw(type = 'TestException', message = 'Simulated save failure');
        }

        variables.expenseService.save(argumentCollection = arguments);
    }

}
