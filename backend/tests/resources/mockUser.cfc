component extends="coldbox.system.testing.BaseTestCase" {

    property name="cbauth"      inject="provider:authenticationService@cbauth";
    property name="jwtService"  inject="provider:JwtService@cbsecurity";
    property name="q"           inject="provider:QueryBuilder@qb";
    property name="userService" inject="services.user";

    /**
     * Make a mock user for testing
     * Returns the mock userObj
     */
    public component function make(
        string email            = '',
        string password         = '',
        boolean verified        = true,
        numeric security_level  = 10,
        numeric salary          = 12,
        numeric monthlyTakeHome = 1
    ) {
        var uEmail    = email.len() ? email : 'TEST_#left(createUUID().replace('-', '', 'all'), 10)#@gmail.com';
        var uPassword = password.len() ? password : createUUID();

        userService.register(
            email           = uEmail,
            password        = uPassword,
            salary          = salary,
            monthlyTakeHome = monthlyTakeHome
        );

        var user = userService.retrieveUserByUsername(uEmail);
        expect(user.getId()).toBeNumeric().toBeGTE(1);

        // Bypass verification step and set to verified
        var securityLevel = arguments.verified ? arguments.security_level : 0;
        q.from('users')
            .where(
                'id',
                '=',
                {value: user.getId(), cfsqltype: 'numeric'}
            )
            .when(
                condition = verified,
                onTrue    = (q) => {
                    q.addUpdate({'verified': {value: true, cfsqltype: 'boolean'}})
                }
            )
            .addUpdate({'security_level': {value: securityLevel, cfsqltype: 'numeric'}})
            .update();

        return userService.retrieveUserByUsername(uEmail);
    }

    /**
     * Login the user and return a valid JWT
     */
    public string function login(required component userObj) {
        expect(cbauth.isLoggedIn()).toBeFalse();

        var event = post(route = '/api/v1/login', params = {email: userObj.getEmail(), password: createUUID()});

        var response = event.getResponse();
        expect(response.getStatusCode()).toBe(200);
        expect(response.getError()).toBeFalse();
        expect(response.getMessages()[1]).toInclude('Bearer token');

        // Verify we receive an auth token
        expect(response.getData()).toHaveKey('access_token');

        // Validate the JWT
        var token   = response.getData().access_token;
        var decoded = jwtService.decode(token);

        expect(decoded.sub).toBe(userObj.getId());

        // Make sure token expiration is set correctly
        expect(decoded.exp).toBeGTE(
            dateAdd(
                'n',
                jwtService.getSettings().jwt.expiration,
                decoded.iat
            )
        );

        return token;
    }

    /**
     * GET CSRF token from /csrf
     */
    public string function getCSRF(required string jwt) {
        var event = get(route = '/api/v1/csrf', headers = {'x-auth-token': jwt});

        var response = event.getResponse();
        expect(response.getStatusCode()).toBe(200);
        expect(response.getError()).toBeFalse();
        expect(response.getMessages()[1]).toInclude('CSRF token created and it expires in ');

        // Verify we receive the CSRF token
        expect(response.getData()).toHaveKey('csrf_token');
        return response.getData().csrf_token;
    }

    /**
     * Logout and invalidate the user's JWT
     */
    public void function logout(required component userObj, required string jwt) {
        expect(cbauth.isLoggedIn()).toBeTrue();

        var event = post(route = '/api/v1/security/logout', headers = {'x-auth-token': jwt});

        var response = event.getResponse();
        expect(response.getStatusCode()).toBe(200);
        expect(response.getError()).toBeFalse();
        expect(response.getMessages()[1]).toInclude('Successfully logged out');

        expect(cbauth.isLoggedIn()).toBeFalse();
        return;
    }

    /**
     * Delete the mock user and any associated data
     */
    public void function delete(required component userObj) {
        directoryDelete(userObj.getDir(), true);
        return;

        // skipping db deletes for now
        q.from('audit')
            .where(
                'userid',
                '=',
                {value: userObj.getId(), cfsqltype: 'numeric'}
            )
            .delete();
        q.from('bug')
            .where(
                'userid',
                '=',
                {value: userObj.getId(), cfsqltype: 'numeric'}
            )
            .delete();
        q.from('expense')
            .where(
                'userid',
                '=',
                {value: userObj.getId(), cfsqltype: 'numeric'}
            )
            .delete();
        q.from('subscription')
            .where(
                'userid',
                '=',
                {value: userObj.getId(), cfsqltype: 'numeric'}
            )
            .delete();
        q.from('category')
            .where(
                'userid',
                '=',
                {value: userObj.getId(), cfsqltype: 'numeric'}
            )
            .delete();
        q.from('income')
            .where(
                'userid',
                '=',
                {value: userObj.getId(), cfsqltype: 'numeric'}
            )
            .delete();
        q.from('users')
            .where(
                'id',
                '=',
                {value: userObj.getId(), cfsqltype: 'numeric'}
            )
            .delete();
        return;
    }

}
