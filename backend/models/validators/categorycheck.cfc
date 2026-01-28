component accessors="true" singleton {

    property name="name";
    property name="q" inject="provider:QueryBuilder@qb";

    function init() {
        this.name = 'categoryCheck';
    }

    string function getName() {
        return this.name;
    }

    /**
     * Check if the incoming category is valid
     * Can be either PK of category or name, which must be a unique name
     *
     * @validationResult  result object of the validation
     * @target            target object to validate on
     * @field             field on the target object to validate on
     * @targetValue       target value to validate
     * @validationData    data
     * @validationData.pk true if this is the pk (categoryid)
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

        // If the incoming value isn't valid, just return true
        // The other validations on this field will error
        if(
            isNull(arguments.targetValue) ||
            (arguments.validationData.pk && !isNumeric(arguments.targetValue)) ||
            (!arguments.validationData.pk && !isSimpleValue(arguments.targetValue))
        ) {
            return true;
        }

        // Attempt to load this category by PK
        if(arguments.validationData.pk) {
            var category = q
                .from('category')
                .where(
                    'id',
                    '=',
                    {value: arguments.targetValue, cfsqltype: 'numeric'}
                )
                .get();

            if(category.len() == 1) {
                return true;
            }
            errorStruct.message = 'Categoryid not valid.';
        }
        // Verify this is a unique field
        else {
            var category = q
                .from('category')
                .where(
                    'name',
                    '=',
                    {value: ucFirst(arguments.targetValue), cfsqltype: 'varchar'}
                )
                .get();

            if(!category.len()) {
                return true;
            }
            errorStruct.message = 'Category must be unique';
        }

        validationResult.addError(
            validationResult
                .newError(argumentCollection = errorStruct)
                .setErrorMetadata({dateRangeCheck: arguments.validationData})
        );
        return false;
    }

}
