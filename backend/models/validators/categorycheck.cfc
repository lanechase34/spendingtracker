component accessors="true" singleton hint="Validator for checking a category exists or name is unique" {

    property name="name";
    property name="q"              inject="provider:QueryBuilder@qb";
    property name="requestService" inject="provider:coldbox:requestService";

    /**
     * Init validator
     */
    function init() {
        this.name = 'categoryCheck';
    }

    /**
     * Getter for validator's name
     */
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
        any validationData
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


        var isPk   = arguments.validationData.pk;
        var userid = val(requestService.getContext().getPrivateCollection()?.userid ?: -1);

        // Attempt to load this category by PK or category name
        var results = q
            .from('category')
            .when(
                condition = isPk,
                onTrue    = (q1) => q1.where(
                    'id',
                    '=',
                    {value: targetValue, cfsqltype: 'numeric'}
                ),
                onFalse = (q1) => q1.where(
                    'name',
                    '=',
                    {value: ucFirst(targetValue), cfsqltype: 'varchar'}
                )
            )
            .andWhere((q1) => {
                q1.whereNull('userid')
                    .orWhere(
                        'userid',
                        '=',
                        {value: userid, cfsqltype: 'numeric'}
                    );
            })
            .get();

        // PK check: category must exist; name check: name must NOT exist
        if(isPk ? results.len() == 1 : !results.len()) {
            return true;
        }

        errorStruct.message = isPk
         ? 'Categoryid not valid.'
         : 'Category name already exists. Use the existing category or choose a different name.';

        validationResult.addError(
            validationResult
                .newError(argumentCollection = errorStruct)
                .setErrorMetadata({categoryCheck: arguments.validationData})
        );
        return false;
    }

}
