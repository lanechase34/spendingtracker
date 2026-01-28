component {

    function configure() {
        return {
            // Turn on to use the ISO8601 date/time formatting on all processed date/time properites, else use the masks
            iso8601Format    : false,
            // The default date mask to use for date properties
            dateMask         : 'yyyy-MM-dd',
            // The default time mask to use for date properties
            timeMask         : 'HH:mm: ss',
            // Enable orm auto default includes: If true and an object doesn't have any `memento` struct defined
            // this module will create it with all properties and relationships it can find for the target entity
            // leveraging the cborm module.
            ormAutoIncludes  : false,
            // The default value for relationships/getters which return null
            nullDefaultValue : '',
            // Don't check for getters before invoking them
            trustedGetters   : false,
            // If not empty, convert all date/times to the specific timezone
            convertToTimezone: '',
            // Verifies if values are not numeric and isBoolean() and do auto casting to Java Boolean
            autoCastBooleans : true
        }
    }

}
