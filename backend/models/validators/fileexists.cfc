component accessors="true" singleton {

    property name="name";

    function init() {
        this.name = 'fileExistsCheck';
    }

    string function getName() {
        return this.name;
    }

    /**
     * Checks if the file exists
     * Expects filename (targetValue), filePath, and optional extension
     *
     * @validationResultThe result object of the validation
     * @targetThe           target object to validate on
     * @fieldThe            field on the target object to validate on
     * @targetValueThe      target value to validate
     * @validationDataThe   validation data the validator was created with
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

        // Field must be present
        if(
            isNull(arguments.targetValue) ||
            !isSimpleValue(arguments.targetValue) ||
            !arguments.targetValue.len() ||
            !arguments.validationData.keyExists('path')
        ) {
            errorStruct.message = 'Invalid file exists check call.';
            validationResult.addError(
                validationResult
                    .newError(argumentCollection = errorStruct)
                    .setErrorMetadata({fileExistsCheck: arguments.validationData})
            );
            return false;
        }

        // Make sure file exists, if extension provided, use that
        var check = fileExists('#validationData.path#/#arguments.targetValue##validationData.keyExists('extension') ? validationData.extension : ''#');

        if(!check) {
            errorStruct.message = 'The file #arguments.targetValue# does not exist.';
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
