component singleton accessors="true" {

    property name="async"           inject="asyncManager@coldbox";
    property name="auditService"    inject="services.audit";
    property name="cacheStorage"    inject="cachebox:coldboxStorage";
    property name="q"               inject="provider:QueryBuilder@qb";
    property name="populator"       inject="wirebox:populator";
    property name="bcrypt"          inject="@BCrypt";
    property name="emailService"    inject="services.email";
    property name="incomeService"   inject="services.income";
    property name="requestService"  inject="coldbox:requestService";
    property name="securityService" inject="services.security";

    property name="impersonation"        inject="coldbox:setting:impersonation";
    property name="maxThreads"           inject="coldbox:setting:maxThreads";
    property name="uploadPath"           inject="coldbox:setting:uploadPath";
    property name="verificationCooldown" inject="coldbox:setting:verificationCooldown";
    property name="verificationLifespan" inject="coldbox:setting:verificationLifespan";

    this.roleMap = {
        "0" : "UNVERIFIED",
        "5" : "PENDING2FA",
        "10": "USER",
        "50": "ADMIN"
    };

    this.userCols = [
        "id",
        "email",
        "password",
        "lastlogin",
        "security_level",
        "verified",
        "verificationsentdate",
        "settings",
        "salary",
        "monthlytakehome",
        "totp_enabled",
        "password_changed_at"
    ];

    // Columns the admin user table may sort by
    this.orderCols = [
        "email",
        "security_level",
        "verified",
        "lastlogin"
    ];
    this.orderDirs = ["asc", "desc"];

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
        // 1. Check this is a valid user and the password
        // Unknown accounts still pay for a bcrypt check so response time does not reveal which emails exist
        var user       = retrieveUserByUserName(username);
        var passwordOk = checkHash(password, user.isLoaded() ? user.getPassword() : "");
        if(!user.isLoaded() || !(impersonation || passwordOk)) {
            return false;
        }

        // 2. Check that they are verified
        if(!user.getVerified()) {
            // throw special exception to be caught
            throw(message = "User not verified", type = "VerificationException");
        }

        // 2FA users haven't logged in yet - lastlogin is updated once their code is verified
        if(!user.getTotp_Enabled()) {
            updateLastLogin(userid = user.getId());
        }
        return true;
    }

    /**
     * Check a plaintext value against a bcrypt hash
     * A missing or malformed hash is still checked against a dummy hash, so every failure takes about as long
     *
     * @candidate The plaintext value
     * @hash      The stored bcrypt hash, empty if there is none
     */
    private boolean function checkHash(required string candidate, required string hash) {
        if(hash.len()) {
            try {
                return bcrypt.checkPassword(candidate = candidate, bCryptHash = hash);
            }
            catch(any e) {
                // Not a valid bcrypt hash - fall through to the dummy check
            }
        }

        checkDummyPassword(candidate);
        return false;
    }

    /**
     * Check a password against a bcrypt hash no account has - as slow as checking a real one, and always false
     * Used wherever a login fails without a hash to check, so every failure takes about as long
     *
     * @password The plaintext password
     */
    private void function checkDummyPassword(required string password) {
        if(!variables.keyExists("dummyPasswordHash")) {
            variables.dummyPasswordHash = securityService.generateBcryptPassword(createUUID());
        }

        bcrypt.checkPassword(candidate = password, bCryptHash = variables.dummyPasswordHash);
    }

    /**
     * Returns true if the password matches the user's current password
     * Used to confirm sensitive changes like setting a new password
     *
     * @id       user pk
     * @password plaintext password to check
     */
    public boolean function checkCurrentPassword(required numeric id, required string password) {
        var base = q
            .from("users")
            .where("id", "=", {value: id, cfsqltype: "numeric"})
            .select(["password"])
            .first();

        return checkHash(password, base.password ?: "");
    }

    /**
     * Fire a new future (non-blocking) to update the last login column
     */
    public void function updateLastLogin(required numeric userid) {
        async.newFuture(() => {
            q.from("users")
                .where("id", "=", {value: userid, cfsqltype: "numeric"})
                .update({lastlogin: {value: now(), cfsqltype: "timestamp"}});
        });
    }

    /**
     * Refine the raw query database fields to useable information
     *
     * @userData struct returned from querybuilder on user
     */
    private struct function refineUserFields(required struct userData) {
        if(!userData.keyExists("id")) {
            return userData;
        }

        // Build user dir and make sure it exists
        userData.dir = "#uploadPath#/#userData.id#";

        // Make sure dir exists
        if(!directoryExists(userData.dir)) {
            directoryCreate(userData.dir);
        }

        // Decrypt fields
        userData.salary          = securityService.intToFloat(securityService.decryptValue(userData.salary, "numeric"));
        userData.monthlytakehome = securityService.intToFloat(
            securityService.decryptValue(userData.monthlytakehome, "numeric")
        );
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
            .from("users")
            .where("email", "=", lCase(username))
            .select(this.userCols)
            .first();

        var user = populator.populateFromStruct(new (), refineUserFields(base));

        /**
         * Valid user, store in cache
         */
        if(user.isLoaded()) {
            user.setPermissions(this.roleMap[user.getSecurityLevel()]);
            cacheStorage.set("user_#user.getId()#", user);
        }

        return user;
    }

    /**
     * Retrieve a user by id (pk)
     *
     * @id           pk
     * @checkPending boolean to check the jwt_payload for if this should be a pending2fa token
     *
     * @return userObj that implements JWTSubject
     */
    public userObj function retrieveUserById(required numeric id, boolean checkPending = true) {
        var prc = requestService.getContext().getPrivateCollection();

        // Check if there is a custom scope set in the incoming JWT payload
        // If so, we need to use this for the user's permission
        if(checkPending && prc.keyExists("jwt_payload") && (prc.jwt_payload?.scope ?: "") == "Pending2FA") {
            var pendingUser = new ();
            pendingUser.setId(arguments.id);
            pendingUser.setPermissions("Pending2FA");
            return pendingUser;
        }

        var cacheKey = "user_#id#";
        var user     = cacheStorage.get(cacheKey);
        if(isNull(user)) {
            var base = q
                .from("users")
                .where("id", "=", {value: id, cfsqltype: "numeric"})
                .select(this.userCols)
                .first();

            var user = populator.populateFromStruct(new (), refineUserFields(base));

            // Token for an account that no longer exists - same exception cbsecurity uses, never cache it
            if(!user.isLoaded()) {
                throw(message = "The user was not found by the user service", type = "InvalidTokenUser");
            }

            user.setPermissions(this.roleMap[user.getSecurityLevel()]);
            cacheStorage.set(cacheKey, user);
        }

        return user;
    }

    /**
     * Registers a new user
     * The caller always gets the same result - whether the email already had an account only goes to that inbox
     *
     * New email             -> create the account and email a verification code
     * Existing, verified    -> email the owner that someone tried to register, change nothing
     * Existing, unverified  -> take the new password/salary and email a fresh code (unless in cooldown)
     *                          Only the inbox owner can verify, and verifying needs the latest password,
     *                          so nobody can claim an email before its owner does
     */
    public void function register(
        required string email,
        required string password,
        required numeric salary,
        required numeric monthlyTakeHome
    ) {
        email = lCase(email);

        // Hash before branching so every path takes about as long
        var hashedPassword = securityService.generateBcryptPassword(password);

        var existing = q
            .from("users")
            .where(
                "email",
                "=",
                {value: email, cfsqltype: "varchar"}
            )
            .select(["id", "verified", "verificationsentdate"])
            .first();

        if(existing.keyExists("id")) {
            if(existing.verified) {
                // Match the bcrypt work of hashing a new account's verification code
                securityService.generateBcryptPassword(generateVerificationCode());
                return;
            }

            q.from("users")
                .where(
                    "id",
                    "=",
                    {value: existing.id, cfsqltype: "numeric"}
                )
                .update({
                    password       : {value: hashedPassword, cfsqltype: "varchar"},
                    salary         : {value: securityService.encryptValue(salary), cfsqltype: "varchar"},
                    monthlytakehome: {value: securityService.encryptValue(monthlyTakeHome), cfsqltype: "varchar"}
                });
            cacheStorage.clearByKeySnippet(keySnippet = "user_#existing.id#");

            if(inVerificationCooldown(existing.verificationsentdate ?: "")) {
                securityService.generateBcryptPassword(generateVerificationCode());
            }
            else {
                sendVerificationCode(userid = existing.id);
            }
            return;
        }

        try {
            var qResult = q
                .from("users")
                .returning(["id"])
                .insert({
                    email          : {value: email, cfsqltype: "varchar"},
                    password       : {value: hashedPassword, cfsqltype: "varchar"},
                    security_level : {value: 0, cfsqltype: "numeric"},
                    verified       : {value: false, cfsqltype: "boolean"},
                    salary         : {value: securityService.encryptValue(salary), cfsqltype: "varchar"},
                    monthlytakehome: {value: securityService.encryptValue(monthlyTakeHome), cfsqltype: "varchar"}
                });
        }
        catch(database e) {
            // Unique violation - a concurrent registration just created this email, that one sends the email
            if((e.sqlState ?: "") == "23505") {
                return;
            }
            rethrow;
        }

        /**
         * Create user directory
         */
        if(!directoryExists("#uploadPath#/#qResult.result.id#")) {
            directoryCreate("#uploadPath#/#qResult.result.id#");
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
        var cacheKey = "user_#id#_data";
        var result   = cacheStorage.get(cacheKey);
        if(isNull(result)) {
            var base = q
                .from("users")
                .where("id", "=", {value: id, cfsqltype: "numeric"})
                .select([
                    "security_level",
                    "salary",
                    "monthlytakehome",
                    "settings",
                    "totp_enabled"
                ])
                .first();

            // Transform result
            result = {
                role           : this.roleMap[base.security_level],
                settings       : deserializeJSON(base.settings.toString()),
                salary         : securityService.intToFloat(securityService.decryptValue(base.salary, "numeric")),
                monthlytakehome: securityService.intToFloat(
                    securityService.decryptValue(base.monthlytakehome, "numeric")
                ),
                totp_enabled: base.totp_enabled
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
        string password         = "",
        numeric salary          = -1,
        numeric monthlyTakeHome = -1,
        struct settings         = {}
    ) {
        q.from("users")
            .where("id", "=", {value: id, cfsqltype: "numeric"})
            .when(
                condition = password.len(),
                onTrue    = (q) => {
                    // password_changed_at revokes every token issued before now (see interceptors.tokenRevocation)
                    var hashedPassword = securityService.generateBcryptPassword(password);
                    return q.addUpdate({
                        "password"           : {value: hashedPassword, cfsqltype: "varchar"},
                        "password_changed_at": {value: now(), cfsqltype: "timestamp"}
                    });
                }
            )
            .when(
                condition = salary > 0,
                onTrue    = (q) => {
                    return q.addUpdate({"salary": {value: securityService.encryptValue(salary), cfsqltype: "varchar"}});
                }
            )
            .when(
                condition = monthlyTakeHome > 0,
                onTrue    = (q) => {
                    return q.addUpdate({"monthlytakehome": {value: securityService.encryptValue(monthlyTakeHome), cfsqltype: "varchar"}});
                }
            )
            .when(
                condition = settings.keyExists("updated"),
                onTrue    = (q) => {
                    settings.delete("updated");
                    return q.addUpdate({"settings": {value: serializeJSON(settings), cfsqltype: "other"}});
                }
            )
            .update();

        cacheStorage.clearByKeySnippet(keySnippet = "user_#id#");
        return;
    }

    /**
     * Create and send a verification code email to the user
     */
    public void function sendVerificationCode(required numeric userid) {
        // Generate 8-character verification code
        var verificationCode = generateVerificationCode();

        // Store hashed code
        var sent = q
            .from("users")
            .returning("email")
            .where("id", "=", {value: userid, cfsqltype: "numeric"})
            .update({
                verificationcode: {
                    value    : securityService.generateBcryptPassword(verificationCode),
                    cfsqltype: "varchar"
                },
                verificationsentdate: {value: now(), cfsqltype: "datetime"}
            });

        // Send the email with how long until the code expires
        var expires = dateAdd("n", getVerificationLifespan(), now());

        emailService.sendVerificationEmail(
            to                   = sent.result.email,
            code                 = verificationcode,
            expires              = expires,
            verificationLifeSpan = getVerificationLifespan()
        );

        cacheStorage.clearByKeySnippet(keySnippet = "user_#userid#");
        return;
    }

    /**
     * Generate a verification code from a CSPRNG
     * Uppercase alphabet without look-alike characters (0/O, 1/I), 8 chars = 40 bits
     */
    private string function generateVerificationCode() {
        var alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        var random   = createObject("java", "java.security.SecureRandom").init();
        var code     = "";
        for(var i = 1; i <= 8; i++) {
            code &= alphabet.mid(random.nextInt(alphabet.len()) + 1, 1);
        }
        return code;
    }

    /**
     * Update and mark a user was verified and update their role to USER
     * The verification code is cleared so it can never be used again
     */
    public void function markVerified(required numeric userid) {
        q.from("users")
            .where("id", "=", {value: userid, cfsqltype: "numeric"})
            .update({
                "verified"        : {value: true, cfsqltype: "boolean"},
                "security_level"  : {value: 10, cfsqltype: "numeric"},
                "verificationcode": {
                    value    : "",
                    cfsqltype: "varchar",
                    null     : true
                }
            });

        cacheStorage.clearByKeySnippet(keySnippet = "user_#userid#");
        updateLastLogin(userid = userid);
        return;
    }

    /**
     * True if a verification code was sent too recently to send another
     *
     * @sentDate when the last code was sent, empty if never
     */
    private boolean function inVerificationCooldown(required any sentDate) {
        return isDate(sentDate) && dateDiff("n", sentDate, now()) <= verificationCooldown;
    }

    /**
     * Load the fields needed to verify an email by the account's email
     * Returns an empty struct if there is no account
     */
    private struct function retrieveVerificationData(required string email) {
        return q
            .from("users")
            .where(
                "email",
                "=",
                {value: lCase(email), cfsqltype: "varchar"}
            )
            .select([
                "id",
                "password",
                "verified",
                "verificationcode",
                "verificationsentdate"
            ])
            .first();
    }

    /**
     * Verify an email with the emailed code, and mark the account verified
     * Needs the account's password as well as the code, so only the person who set the password and owns the inbox can verify
     * Every failure throws the same exception and does the same bcrypt work, so nothing reveals whether the email has an account
     *
     * @email    account email
     * @password account password
     * @code     code emailed to the user
     *
     * @return the verified user's id
     *
     * @throws InvalidVerification wrong email, password or code, or the code expired
     * @throws UserAlreadyVerified the email and password are right but the account is already verified
     */
    public numeric function verifyEmail(
        required string email,
        required string password,
        required string code
    ) {
        var base  = retrieveVerificationData(email);
        var found = base.keyExists("id");

        // Always run both checks - codes are generated uppercase so normalize what the user typed
        var passwordOk = checkHash(password, found ? base.password : "");
        var codeOk     = checkHash(code.trim().uCase(), found ? (base.verificationcode ?: "") : "");
        passwordOk     = found && (impersonation || passwordOk);

        if(passwordOk && base.verified) {
            throw(message = "User already verified", type = "UserAlreadyVerified");
        }

        if(
            !passwordOk
            || !codeOk
            || !isDate(base.verificationsentdate ?: "")
            || dateDiff("n", base.verificationsentdate, now()) > verificationLifespan
        ) {
            throw(message = "Invalid or expired verification code", type = "InvalidVerification");
        }

        markVerified(userid = base.id);
        return base.id;
    }

    /**
     * Resend the verification code to an unverified account
     * Wrong credentials and verified accounts are ignored silently, so the caller can't tell which emails have accounts
     *
     * @email    account email
     * @password account password
     *
     * @return sent | cooldown | ignored
     */
    public string function resendVerificationCode(required string email, required string password) {
        var base       = retrieveVerificationData(email);
        var found      = base.keyExists("id");
        var passwordOk = checkHash(password, found ? base.password : "");

        if(!found || !(impersonation || passwordOk) || base.verified) {
            return "ignored";
        }

        if(inVerificationCooldown(base.verificationsentdate ?: "")) {
            return "cooldown";
        }

        sendVerificationCode(userid = base.id);
        return "sent";
    }

    /**
     * Returns pagination data struct and
     * records for the current page
     */
    public struct function paginate(
        required numeric page,
        required numeric records,
        required string search   = "",
        required string orderCol = "",
        required string orderDir = ""
    ) {
        if(!this.orderCols.containsNoCase(orderCol) || !this.orderDirs.containsNoCase(orderDir)) {
            orderCol = "";
            orderDir = "";
        }

        /**
         * Base Query
         */
        var base = q
            .from("users")
            .where((q1) => {
                q1.whereLike(q.raw("lower(email)"), {value: "%#lCase(search)#%", cfsqltype: "varchar"})
                    .when(
                        condition = isDate(search),
                        onTrue    = (q2) => {
                            q2.orWhere(
                                "lastlogin",
                                "=",
                                {value: search, cfsqltype: "timestamp"}
                            );
                        },
                        withoutScoping = true
                    )
                    .when(
                        condition = isNumeric(search),
                        onTrue    = (q2) => {
                            q2.orWhere(
                                "security_level",
                                "=",
                                {value: search, cfsqltype: "numeric"}
                            );
                        },
                        withoutScoping = true
                    );
            });

        /**
         * Calculate the filtered total and number of records
         */
        var filteredRecords = base.select(["id"]).count();

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
                        q1.orderByRaw("#orderCol# #orderDir# nulls last").orderBy("id", orderDir);
                    },
                    (q1) => {
                        q1.orderByRaw("lastlogin desc nulls last").orderBy("id", "desc");
                    }
                )
                .limit(records)
                .offset(offset)
                .select([
                    "id",
                    "email",
                    "security_level",
                    "verified",
                    "lastlogin"
                ])
                .get()
                .map(
                    (value) => {
                        // Format lastlogin to ensure consistent timestamp format
                        if(!isNull(value.lastlogin)) {
                            value.lastlogin = dateTimeFormat(value.lastlogin, "yyyy-mm-dd HH:nn:ss");
                        }
                        // Map security_level -> permission
                        value.security_level = this.roleMap[value.security_level];
                        value.verified       = !!value.verified;
                        return value;
                    },
                    true,
                    maxThreads
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
        var cacheKey = "user.getTotalInfo";
        var total    = cacheStorage.get(cacheKey);
        if(isNull(total)) {
            var result = queryExecute("select count(id) as count from users", {});
            total      = {count: result.count};
            cacheStorage.set(cacheKey, total);
        }
        return total;
    }

}
