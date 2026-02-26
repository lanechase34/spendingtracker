component acecssors="true" singleton hint="Validator for checking a record exists in the database" {

    property name="name";
    property name="q" inject="provider:QueryBuilder@qb";

    /**
     * Init validator
     */
    function init() {
        this.name = 'recordExists';
    }

    /**
     * Getter for validator's name
     */
    string function getName() {
        return this.name;
    }

    /**
     * Check if the record exists
     *
     * @validationResult             result object of the validation
     * @target                       target object to validate on
     * @field                        field on the target object to validate on
     * @targetValue                  target value to validate
     * @validationData               data
     * @validationData.table         the table to check
     * @validationData.pk            whether the field is the primary key of the tbale (id)
     * @validationData.belongsToUser whether this record should belong to the user
     * @validationData.column        if not pk, the column to load record by
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

        // If the field is not required
        // And no valid value was passed in - skip the check
        if(
            !isNull(arguments.targetValue) &&
            isSimpleValue(arguments.targetValue) &&
            !arguments.rules.required && (
                (
                    arguments.rules.type == 'numeric' &&
                    arguments.targetValue == -1
                ) ||
                (
                    arguments.rules.type == 'string' &&
                    arguments.targetValue == ''
                )
            )
        ) {
            return true;
        }

        // Field must be present
        if(
            isNull(arguments.targetValue) ||
            !isSimpleValue(arguments.targetValue) ||
            !arguments.targetValue.len() ||
            !arguments.validationData.keyExists('table') ||
            (
                !arguments.validationData.keyExists('pk') &&
                !arguments.validationData.keyExists('column')
            ) ||
            (
                arguments.validationData.keyExists('pk') &&
                !isNumeric(arguments.targetValue)
            )
        ) {
            errorStruct.message = '1: Invalid record check. Please check the format.';
            validationResult.addError(
                validationResult
                    .newError(argumentCollection = errorStruct)
                    .setErrorMetadata({recordExists: arguments.validationData})
            );
            return false;
        }

        // If belongsToUser is true
        // Userid must also be present and valid
        if(
            arguments.validationData.keyExists('belongsToUser') &&
            arguments.validationData.belongsToUser && (
                isNull(arguments.target.getUserId()) || !isSimpleValue(arguments.target.getUserId()) || !isNumeric(
                    arguments.target.getUserId()
                )
            )
        ) {
            errorStruct.message = '2: Invalid record check. Please check the format.';
            validationResult.addError(
                validationResult
                    .newError(argumentCollection = errorStruct)
                    .setErrorMetadata({recordExists: arguments.validationData})
            );
            return false;
        }


        // Attempt to load record by PK
        if(arguments.validationData.keyExists('pk') && arguments.validationData.pk) {
            var check = q
                .from(arguments.validationData.table)
                .where(
                    'id',
                    '=',
                    {value: arguments.targetValue, cfsqltype: 'numeric'}
                )
                .get();
        }

        // Attempt to load entity based on column provided
        else {
            var check = q
                .from(arguments.validationData.table)
                .where(
                    arguments.validationData.column,
                    '=',
                    {value: arguments.targetValue, cfsqltype: 'numeric'}
                )
                .get();
        }

        // Record does not exist
        if(check.len() != 1) {
            errorStruct.message = 'The record does not exist.';
            validationResult.addError(
                validationResult
                    .newError(argumentCollection = errorStruct)
                    .setErrorMetadata({recordExists: arguments.validationData})
            );
            return false;
        }

        // If this entity should belong to the current user
        if(
            arguments.validationData.keyExists('belongsToUser') && arguments.validationData.belongsToUser && check[1].userid != arguments.target.getUserId()
        ) {
            errorStruct.message = 'Invalid access.';
            validationResult.addError(
                validationResult
                    .newError(argumentCollection = errorStruct)
                    .setErrorMetadata({recordExists: arguments.validationData})
            );
            return false;
        }

        return true;
    }

}
