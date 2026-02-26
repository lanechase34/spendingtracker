component accessors="true" singleton hint="Validator for checking if a field is unique in database" {

    property name="q" inject="provider:QueryBuilder@qb";
    property name="name";

    /**
     * Init validator
     */
    function init() {
        this.name = 'uniqueDatabaseField';
    }

    /**
     * Getter for validator's name
     */
    string function getName() {
        return this.name;
    }

    /**
     * Checks if the supplied value is unique to a database table and column
     *
     * Expects the table and column
     *
     * @targetValue           the value to check with
     * @validationData.table  table to check against
     * @validationData.column column for unique value
     */
    boolean function validate(
        required any validationResult,
        required any target,
        required string field,
        any targetValue,
        any validationData
    ) {
        var errorStruct = {
            message       : '',
            field         : arguments.field,
            validationType: getName(),
            rejectedValue : (isSimpleValue(arguments.targetValue) ? arguments.targetValue : ''),
            validationData: arguments.validationData
        };

        // Field must be present
        if(
            isNull(arguments.targetValue) ||
            !isSimpleValue(arguments.targetValue) ||
            !arguments.targetValue.len() ||
            !arguments.validationData.keyExists('table') ||
            !arguments.validationData.keyExists('column')
        ) {
            errorStruct.message = 'Invalid unique database field call.';
            validationResult.addError(
                validationResult
                    .newError(argumentCollection = errorStruct)
                    .setErrorMetadata({uniqueDatabaseField: arguments.validationData})
            );
            return false;
        }

        // Run query to make sure value is unique in column in table
        var check = q
            .from('#validationData.table#')
            .whereRaw(
                'upper(#validationData.column#) = ?',
                [{value: uCase(arguments.targetValue), cfsqltype: 'varchar'}]
            )
            .get();

        // Already taken
        if(check.len()) {
            errorStruct.message = 'The #validationData.column# is already taken.';
            validationResult.addError(
                validationResult
                    .newError(argumentCollection = errorStruct)
                    .setErrorMetadata({uniqueDatabaseField: arguments.validationData})
            );
            return false;
        }

        return true;
    }

}
