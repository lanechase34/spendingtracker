component extends="base" secured="User,Admin" {

    this.allowedMethods = {
        getProfile   : 'GET',
        updateProfile: 'PATCH',
        view         : 'GET'
    };

    property name="userService" inject="services.user";

    /**
     * Return information about the logged in user
     */
    function getProfile(event, rc, prc) {
        prc.data = userService.retrieveUserDataById(id = prc.userid);
        event
            .getResponse()
            .setData(prc.data)
            .setStatusCode(200);
    }

    /**
     * Save a user's profile settings
     *
     * @rc.password        (optional) new password
     * @rc.salary          (optional) salary
     * @rc.monthlyTakehome (optional) monthly take home
     */
    function updateProfile(event, rc, prc) {
        if(rc.keyExists('settings')) {
            rc.settings         = deserializeJSON(rc.settings);
            rc.settings.updated = true;
        }

        userService.updateProfile(
            id              = prc.userid,
            password        = rc?.password ?: '',
            salary          = rc?.salary ?: -1,
            monthlyTakeHome = rc?.monthlyTakeHome ?: -1,
            settings        = rc?.settings ?: {}
        );

        event
            .getResponse()
            .addMessage('Successfully updated')
            .setStatusCode(200);
    }

    /**
     * Paginated view for users
     *
     * @rc.page     page num
     * @rc.records  total records to return
     * @rc.search   (optional) search param
     * @rc.orderCol (optional) which col to order
     * @rc.orderDir (optional) order direction
     */
    function view(event, rc, prc) secured="Admin" {
        prc.data = userService.paginate(
            userid   = prc.userid,
            page     = rc.page,
            records  = rc.records,
            search   = rc?.search ?: '',
            orderCol = rc?.orderCol ?: '',
            orderDir = rc?.orderDir ?: ''
        );

        event
            .getResponse()
            .setDataWithPagination(
                data          = prc.data,
                resultsKey    = 'results',
                paginationKey = 'pagination'
            )
            .setStatusCode(200);
    }

}
