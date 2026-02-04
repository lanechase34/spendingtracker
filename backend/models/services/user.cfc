component singleton accessors="true" {

    property name="async"           inject="asyncManager@coldbox";
    property name="auditService"    inject="services.audit";
    property name="cacheStorage"    inject="cachebox:coldboxStorage";
    property name="q"               inject="provider:QueryBuilder@qb";
    property name="populator"       inject="wirebox:populator";
    property name="bcrypt"          inject="@BCrypt";
    property name="emailService"    inject="services.email";
    property name="incomeService"   inject="services.income";
    property name="securityService" inject="services.security";

    property name="impersonation"        inject="coldbox:setting:impersonation";
    property name="uploadPath"           inject="coldbox:setting:uploadPath";
    property name="verificationLifespan" inject="coldbox:setting:verificationLifespan";

    this.roleMap = {
        '0' : 'UNVERIFIED',
        '10': 'USER',
        '50': 'ADMIN'
    };

    this.userCols = [
        'id',
        'email',
        'password',
        'lastlogin',
        'security_level',
        'verified',
        'verificationsentdate',
        'settings',
        'salary',
        'monthlytakehome'
    ];

    /**
	 * Construct a new user object via WireBox Providers
	 */
    private userObj function new() provider="objects.userobj" {
    }

    /**
	 * Verify if the incoming username/password are valid credentials.
     *
     * @username The username (email)
     * @password The password
     *
     * @return T/F whether valid
	 */
    public boolean function isValidCredentials(required string username, required string password) {
        // 1. Check this is a valid user
        var user = retrieveUserByUserName(username);
        if(!user.isLoaded()) {
            return false;
        }

        // 2. Check the password
        if(!impersonation && !bcrypt.checkPassword(candidate = password, bCryptHash = user.getPassword())) {
            return false;
        }

        // 3. Check that they are verified
        if(!user.getVerified()) {
            // throw special exception to be caught
            throw(message = 'User not verified', type = 'VerificationException');
            return false;
        }

        updateLastLogin(userid = user.getId());
        return true;
    }

    /**
     * Fire a new future (non-blocking) to update the last login column
     */
    private void function updateLastLogin(required numeric userid) {
        async.newFuture(() => {
            q.from('users')
                .where('id', '=', {value: userid, cfsqltype: 'numeric'})
                .update({lastlogin: {value: now(), cfsqltype: 'timestamp'}});
        });
    }

    /**
     * Refine the raw query database fields to useable information
     *
     * @userData struct returned from querybuilder on user
     */
    private struct function refineUserFields(required struct userData) {
        if(!userData.keyExists('id')) {
            return userData;
        }

        // Build user dir and make sure it exists
        userData.dir = '#uploadPath#/#userData.id#';

        // Make sure dir exists
        if(!directoryExists(userData.dir)) {
            directoryCreate(userData.dir);
        }

        // Decrypt fields
        userData.salary          = securityService.decryptValue(userData.salary, 'numeric');
        userData.monthlytakehome = securityService.decryptValue(userData.monthlytakehome, 'numeric');

        return userData;
    }

    /**
	 * Retrieve a user by username
	 *
	 * @username The username (email)
	 *
	 * @return userObj that implements JWTSubject
	 */
    public userObj function retrieveUserByUsername(required string username) {
        var base = q
            .from('users')
            .where('email', '=', lCase(username))
            .select(this.userCols)
            .first();

        var user = populator.populateFromStruct(new (), refineUserFields(base));

        /**
         * Valid user, store in cache
         */
        if(user.isLoaded()) {
            user.setPermissions(this.roleMap[user.getSecurityLevel()]);
            cacheStorage.set('user_#user.getId()#', user);
        }

        return user;
    }

    /**
     * Retrieve a user by id (pk)
     *
     * @id pk
     *
     * @return userObj that implements JWTSubject
     */
    public userObj function retrieveUserById(required numeric id) {
        var cacheKey = 'user_#id#';
        var user     = cacheStorage.get(cacheKey);
        if(isNull(user)) {
            var base = q
                .from('users')
                .where('id', '=', {value: id, cfsqltype: 'numeric'})
                .select(this.userCols)
                .first();

            var user = populator.populateFromStruct(new (), refineUserFields(base));
            user.setPermissions(this.roleMap[user.getSecurityLevel()]);

            cacheStorage.set(cacheKey, user);
        }

        return user;
    }

    /**
     * Generate salt and hashed password using bcrypt
     *
     * @return hashedPassword
     */
    private string function generateBcryptPassword(required string password) {
        var salt           = bcrypt.generateSalt();
        var hashedPassword = bcrypt.hashPassword(password = password, salt = salt);
        return hashedPassword;
    }

    /**
     * Registers a new user
     */
    public void function register(
        required string email,
        required string password,
        required numeric salary,
        required numeric monthlyTakeHome
    ) {
        var hashedPassword = generateBcryptPassword(password);
        var qResult        = q
            .from('users')
            .returning(['id'])
            .insert({
                email          : {value: lCase(email), cfsqltype: 'varchar'},
                password       : {value: hashedPassword, cfsqltype: 'varchar'},
                security_level : {value: 0, cfsqltype: 'numeric'},
                verified       : {value: false, cfsqltype: 'boolean'},
                salary         : {value: securityService.encryptValue(salary), cfsqltype: 'varchar'},
                monthlytakehome: {value: securityService.encryptValue(monthlyTakeHome), cfsqltype: 'varchar'}
            });

        /**
         * Create user directory
         */
        if(!directoryExists('#uploadPath#/#qResult.result.id#')) {
            directoryCreate('#uploadPath#/#qResult.result.id#');
        }

        /**
         * Create pay for this month
         */
        async.newFuture(() => {
            incomeService.pay(
                date   = now(),
                userid = qResult.result.id,
                pay    = monthlyTakeHome
            );
        });

        /**
         * Send verification email
         */
        sendVerificationCode(userid = qResult.result.id);
        return;
    }

    /**
     * Returns struct of user profile information
     */
    public struct function retrieveUserDataById(required numeric id) {
        var cacheKey = 'user_#id#_data';
        var result   = cacheStorage.get(cacheKey);
        if(isNull(result)) {
            var base = q
                .from('users')
                .where('id', '=', {value: id, cfsqltype: 'numeric'})
                .select([
                    'security_level',
                    'salary',
                    'monthlytakehome',
                    'settings'
                ])
                .first();

            // Transform result
            result = {
                role           : this.roleMap[base.security_level],
                settings       : deserializeJSON(base.settings),
                salary         : securityService.decryptValue(base.salary, 'numeric'),
                monthlytakehome: securityService.decryptValue(base.monthlytakehome, 'numeric')
            };

            cacheStorage.set(cacheKey, result);
        }

        return result;
    }

    /**
     * Update a users profile information
     *
     * @id              required userid
     * @password        updated pass
     * @salary          updated salary
     * @monthlyTakeHome updated monthlyTakeHome
     * @settings        updated struct of settings
     */
    public void function updateProfile(
        required numeric id,
        string password         = '',
        numeric salary          = -1,
        numeric monthlyTakeHome = -1,
        struct settings         = {}
    ) {
        q.from('users')
            .where('id', '=', {value: id, cfsqltype: 'numeric'})
            .when(
                condition = password.len(),
                onTrue    = (q) => {
                    var hashedPassword = generateBcryptPassword(password);
                    q.addUpdate({'password': {value: hashedPassword, cfsqltype: 'varchar'}});
                }
            )
            .when(
                condition = salary > 0,
                onTrue    = (q) => {
                    q.addUpdate({'salary': {value: securityService.encryptValue(salary), cfsqltype: 'varchar'}})
                }
            )
            .when(
                condition = monthlyTakeHome > 0,
                onTrue    = (q) => {
                    q.addUpdate({'monthlytakehome': {value: securityService.encryptValue(monthlyTakeHome), cfsqltype: 'varchar'}})
                }
            )
            .when(
                condition = settings.keyExists('updated'),
                onTrue    = (q) => {
                    q.addUpdate({'settings': q.raw('cast(''#serializeJSON(settings)#'' as jsonb)')})
                }
            )
            .update();

        cacheStorage.clearByKeySnippet(keySnippet = 'user_#id#');
        return;
    }

    /**
     * Create and send a verification code email to the user
     */
    public void function sendVerificationCode(required numeric userid) {
        // Generate 8-character verification code
        var verificationCode = left(replace(createUUID(), '-', '', 'all'), 8).uCase();

        // Store hashed code
        var sent = q
            .from('users')
            .returning('email')
            .where('id', '=', {value: userid, cfsqltype: 'numeric'})
            .update({
                verificationcode    : {value: generateBcryptPassword(verificationCode), cfsqltype: 'varchar'},
                verificationsentdate: {value: now(), cfsqltype: 'datetime'}
            });

        // Send the email with how long until the code expires
        var expires = dateAdd('n', getVerificationLifespan(), now());

        emailService.sendVerificationEmail(
            to                   = sent.result.email,
            code                 = verificationcode,
            expires              = expires,
            verificationLifeSpan = getVerificationLifespan()
        );

        cacheStorage.clearByKeySnippet(keySnippet = 'user_#userid#');
        return;
    }

    /**
     * Update and mark a user was verified and update their role to USER
     */
    public void function markVerified(required numeric userid) {
        q.from('users')
            .where('id', '=', {value: userid, cfsqltype: 'numeric'})
            .update({'verified': {value: true, cfsqltype: 'boolean'}, 'security_level': {value: 10, cfsqltype: 'numeric'}});

        cacheStorage.clearByKeySnippet(keySnippet = 'user_#userid#');
        updateLastLogin(userid = userid);
        return;
    }

    /**
     * Returns true if this is a successful code for the supplied user
     *
     * @userid user pk
     * @code   code emailed to user
     */
    public boolean function findByVerificationCode(required numeric userid, required string code) {
        // Load user by id
        var base = q
            .from('users')
            .where('id', '=', {value: userid, cfsqltype: 'numeric'})
            .first();

        // Invalid id
        if(!base.keyExists('id')) {
            throw(nessage = 'User not found', type = 'UserNotFound');
            return false;
        }

        // Already verified
        if(base.verified) {
            throw(nessage = 'User already verified', type = 'UserAlreadyVerified');
            return false;
        }

        // Check the code
        if(
            !base.keyExists('verificationCode')
            || !bcrypt.checkPassword(candidate = code, bCryptHash = base.verificationCode)
        ) {
            throw(nessage = 'User not found', type = 'UserNotFound');
            return false;
        }

        // Make sure code has not expired
        if(dateDiff('n', base.verificationSentDate, now()) > verificationLifespan) {
            throw(nessage = 'Code has expired', type = 'UserNotFound');
            return false;
        }

        return true;
    }

    /**
     * Returns pagination data struct and
     * records for the current page
     */
    public struct function paginate(
        required numeric page,
        required numeric records,
        required string search   = '',
        required string orderCol = '',
        required string orderDir = ''
    ) {
        /**
         * Base Query
         */
        var base = q
            .from('users')
            .where((q1) => {
                q1.whereLike(q.raw('lower(email)'), {value: '%#lCase(search)#%', cfsqltype: 'varchar'})
                    .when(
                        condition = isDate(search),
                        onTrue    = (q2) => {
                            q2.orWhere(
                                'lastlogin',
                                '=',
                                {value: search, cfsqltype: 'timestamp'}
                            );
                        },
                        withoutScoping = true
                    )
                    .when(
                        condition = isNumeric(search),
                        onTrue    = (q2) => {
                            q2.orWhere(
                                'security_level',
                                '=',
                                {value: search, cfsqltype: 'numeric'}
                            );
                        },
                        withoutScoping = true
                    );
            });

        /**
         * Calculate the filtered total and number of records
         */
        var filteredRecords = base.select(['id']).count();

        /**
         * Perform total info query and data query in parallel
         */
        var offset         = (page - 1) * records;
        var asyncTotalInfo = async.newFuture(() => {
            return getTotalInfo();
        });
        var asyncData = async.newFuture(() => {
            return base
                .when(
                    orderCol.len() && orderDir.len(),
                    (q1) => {
                        q1.orderBy(orderCol, '#orderDir# nulls last');
                    },
                    (q1) => {
                        q1.orderBy('lastlogin', 'desc nulls last');
                    }
                )
                .limit(records)
                .offset(offset)
                .select([
                    'id',
                    'email',
                    'security_level',
                    'verified',
                    'lastlogin'
                ])
                .get()
                .each(
                    (value) => {
                        // Format lastlogin to ensure consistent timestamp format
                        if(!isNull(value.lastlogin)) {
                            value.lastlogin = dateTimeFormat(value.lastlogin, 'yyyy-mm-dd HH:nn:ss');
                        }
                        // Map security_level -> permission
                        value.security_level = this.roleMap[value.security_level];
                        value.verified       = value.verified == 1;
                    },
                    true,
                    50
                );
        });

        var results = async
            .newFuture()
            .all(asyncTotalInfo, asyncData)
            .get();
        var totalInfo = results[1];
        var data      = results[2];

        return {
            pagination: {
                totalRecords   : totalInfo.count,
                filteredRecords: filteredRecords,
                offset         : offset,
                page           : parseNumber(page)
            },
            results: {users: data}
        };
    }

    /**
     * Get the total count of all users
     */
    private struct function getTotalInfo() {
        var cacheKey = 'user.getTotalInfo';
        var total    = cacheStorage.get(cacheKey);
        if(isNull(total)) {
            var result = queryExecute('select count(id) as count from users', {});
            total      = {count: result.count};
            cacheStorage.set(cacheKey, total);
        }
        return total;
    }

}
