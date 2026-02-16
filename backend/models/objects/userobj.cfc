component
    accessors     ="true"
    transientCache="false"
    delegates     ="
		Validatable@cbvalidation,
		Population@cbDelegates,
		Auth@cbSecurity,
		Authorizable@cbSecurity,
		JwtSubject@cbSecurity
	"
{

    /**
     * Properties
     */
    property name="id"                   type="numeric";
    property name="email"                type="string";
    property name="password"             type="string";
    property name="security_level"       type="numeric";
    property name="permissions"          type="array";
    property name="dir"                  type="string";
    property name="verified"             type="numeric";
    property name="verificationSentDate" type="date";

    /**
     * Dervied
     */
    property name="initializedDate" type="date";

    /**
     * Injected
     */
    property name="q" inject="provider:QueryBuilder@qb";

    /**
     * Mementifier
     */
    this.memento = {defaultIncludes: ['email', 'permissions'], neverInclude: ['id', 'password']};

    /**
	 * --------------------------------------------------------------------------
	 * Population Control
	 * --------------------------------------------------------------------------
	 * https://coldbox.ortusbooks.com/readme/release-history/whats-new-with-7.0.0#population-enhancements
	 */
    this.population = {
        include: [], // if empty, tries to include them all
        exclude: ['permissions', 'initializedDate'] // These are not mass assignable
    }

    /**
	 * Constructor
	 */
    function init() {
        variables.id                   = -1;
        variables.email                = '';
        variables.password             = '';
        variables.security_level       = '';
        variables.permissions          = [];
        variables.dir                  = '';
        variables.verified             = false;
        variables.verificationSentDate = createDateTime(2000, 1, 1, 0, 0, 0);
        variables.initializedDate      = now();
        return this;
    }

    /**
     * A struct of custom claims to add to the JWT token
     */
    struct function getJWTCustomClaims() {
        return {};
    }

    /**
     * This function returns an array of all the scopes that should be attached to the JWT token that will be used for authorization.
     */
    array function getJWTScopes() {
        return variables.permissions;
    }

    /**
     * Verify if the user has one or more of the passed in permissions
     *
     * @permission One or a list of permissions to check for access
     */
    boolean function hasPermission(required permission) {
        if(isSimpleValue(arguments.permission)) {
            arguments.permission = listToArray(arguments.permission);
        }

        return arguments.permission.some(
            (item) => {
                return variables.permissions.findNoCase(item);
            },
            true,
            2
        );
    }

    /**
	 * Set permissions into this object
	 *
	 * @permissions array or list of permissions
	 */
    UserObj function setPermissions(permissions) {
        if(isSimpleValue(arguments.permissions)) {
            arguments.permissions = listToArray(arguments.permissions);
        }
        variables.permissions = arguments.permissions;
        return this;
    }

    /**
	 * Verify if this is a valid user or not
	 */
    boolean function isLoaded() {
        return (!isNull(variables.id) && len(variables.id) && variables.id > 0);
    }

    numeric function getSecurityLevel() {
        return variables.security_level;
    }

}
