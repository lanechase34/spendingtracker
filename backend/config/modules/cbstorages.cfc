component extends="coldbox.system.FrameworkSupertype" {

    function configure() {
        return {
            cacheStorage: {
                cachename         : 'userRequestStorage', // The CacheBox registered cache to store data in
                timeout           : 60, // The default timeout of the session bucket, defaults to 60
                identifierProvider: () => {
                    // The identifierProvider is a closure/udf that will return a unique identifier according to your rules
                    announce('onIdentifier'); // announce event to SET request.userid = to the IDENTIFIER
                    return 'USER_#request.userid#';
                }
            }
        };
    }

}
