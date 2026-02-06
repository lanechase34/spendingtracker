component accessors="true" singleton {

    property name="name";
    property name="datePart";
    property name="maxRange";

    function init() {
        this.name     = 'dateRangeCheck';
        this.datePart = 'd';
        this.maxRange = 365; // 1 year
        this.minRange = 0;
    }

    string function getName() {
        return this.name;
    }

    /**
     * Check if the startDate -> endDate range is valid
     *
     * Expects the entity name and either the PK or unique field to load entity by
     *
     * @validationResult        result object of the validation
     * @target                  target object to validate on
     * @field                   field on the target object to validate on
     * @targetValue             target value to validate
     * @validationData          data
     * @validationData.datePart datepart (y, d, etc..), default to d
     * @validationData.maxRange maximum number of dateparts allowed, default 365
     */
    boolean function validate(
        required any validationResult,
        required any target,
        required string field,
        any targetValue,
        any validationData,
        struct rules
    ) {
        var errorStruct = {
            message       : '',
            field         : arguments.field,
            validationType: getName(),
            rejectedValue : (isSimpleValue(arguments.targetValue) ? arguments.targetValue : ''),
            validationData: arguments.validationData
        };

        // Field (endDate) must be present
        // startDate must also be present
        if(
            isNull(arguments.targetValue) ||
            !isDate(arguments.targetValue) ||
            isNull(arguments.target.getStartDate()) ||
            !isDate(arguments.target.getStartDate())
        ) {
            errorStruct.message = 'Invalid date range. startDate and endDate must both be valid dates';
            validationResult.addError(
                validationResult
                    .newError(argumentCollection = errorStruct)
                    .setErrorMetadata({dateRangeCheck: arguments.validationData})
            );
            return false;
        }

        // Verify the startDate and endDate are within the range supplied
        var datePart = arguments.validationData.keyExists('datePart') ? arguments.validationData.datePart : this.datePart;
        var maxRange = arguments.validationData.keyExists('maxRange') ? arguments.validationData.maxRange : this.maxRange;
        var minRange = arguments.validationData.keyExists('minRange') ? arguments.validationData.minRange : this.minRange;
        var check    = dateDiff(
            datePart,
            arguments.target.getStartDate(),
            arguments.targetValue
        );

        if(check > maxRange || check < 0) {
            errorStruct.message = 'The startDate and endDate range is over the maximum allowed. The maximum allowed is #maxRange# #datePart#(s)';
            validationResult.addError(
                validationResult
                    .newError(argumentCollection = errorStruct)
                    .setErrorMetadata({fileExistsCheck: arguments.validationData})
            );
            return false;
        }

        if(check < minRange) {
            errorStruct.message = 'The startDate and endDate range is not over the minimum allowed. The minimum allowed is #minRange# #datePart#(s)';
            validationResult.addError(
                validationResult
                    .newError(argumentCollection = errorStruct)
                    .setErrorMetadata({fileExistsCheck: arguments.validationData})
            );
            return false;
        }

        return true;
    }

}
