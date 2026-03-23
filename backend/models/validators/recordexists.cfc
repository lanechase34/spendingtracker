component accessors="true" singleton hint="Validator for checking a record exists in the database" {

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
        if(isOptionalAndEmpty(arguments.targetValue, arguments.rules)) {
            return true;
        }

        // Field must be present
        if(!hasValidInput(arguments.targetValue, arguments.validationData)) {
            errorStruct.message = '1: Invalid record check. Please check the format.';
            validationResult.addError(
                validationResult
                    .newError(argumentCollection = errorStruct)
                    .setErrorMetadata({recordExists: arguments.validationData})
            );
            return false;
        }

        var checkOwnership = requiresUserCheck(arguments.validationData);

        // If belongsToUser is true
        // Userid must also be present and valid
        if(
            checkOwnership
            && !hasValidUserId(arguments.target)
        ) {
            errorStruct.message = '2: Invalid record check. Please check the format.';
            validationResult.addError(
                validationResult
                    .newError(argumentCollection = errorStruct)
                    .setErrorMetadata({recordExists: arguments.validationData})
            );
            return false;
        }


        // Attempt to load record (by PK or col)
        var records = loadRecord(arguments.targetValue, arguments.validationData);

        // Record does not exist
        if(records.len() != 1) {
            errorStruct.message = 'The record does not exist.';
            validationResult.addError(
                validationResult
                    .newError(argumentCollection = errorStruct)
                    .setErrorMetadata({recordExists: arguments.validationData})
            );
            return false;
        }

        // If this entity should belong to the current user
        if(checkOwnership && records[1].userid != arguments.target.getUserId()) {
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

    private boolean function isOptionalAndEmpty(required any targetValue, required any rules) {
        return (
            !isNull(arguments.targetValue) &&
            isSimpleValue(arguments.targetValue) &&
            !arguments.rules.required && (
                (arguments.rules.type == 'numeric' && arguments.targetValue == -1) ||
                (arguments.rules.type == 'string' && arguments.targetValue == '')
            )
        );
    }

    private boolean function hasValidInput(required any targetValue, required any validationData) {
        var hasColumn   = arguments.validationData.keyExists('column');
        var hasPK       = arguments.validationData.keyExists('pk');
        var pkIsNumeric = hasPK && isNumeric(arguments.targetValue);

        return (
            !isNull(arguments.targetValue) &&
            isSimpleValue(arguments.targetValue) &&
            arguments.targetValue.len() &&
            arguments.validationData.keyExists('table') &&
            (hasPK || hasColumn) &&
            (!hasPK || pkIsNumeric)
        );
    }

    private boolean function requiresUserCheck(required any validationData) {
        return (
            arguments.validationData.keyExists('belongsToUser') &&
            arguments.validationData.belongsToUser
        );
    }

    private boolean function hasValidUserId(required any target) {
        return (
            !isNull(arguments.target.getUserId()) &&
            isSimpleValue(arguments.target.getUserId()) &&
            isNumeric(arguments.target.getUserId())
        );
    }

    private array function loadRecord(required any targetValue, required any validationData) {
        var column = arguments.validationData.keyExists('pk') && arguments.validationData.pk
         ? 'id'
         : arguments.validationData.column;

        return q
            .from(arguments.validationData.table)
            .where(
                column,
                '=',
                {value: arguments.targetValue, cfsqltype: 'numeric'}
            )
            .get();
    }

}
