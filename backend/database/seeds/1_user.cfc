component extends="base" {

    function run(qb, mockdata) {
        var securityService = getSecurityService();

        qb.table('users')
            .insert([
                {
                    'email'               : 'test1@gmail.com',
                    'password'            : 'mypassword',
                    'security_level'      : 50,
                    'salary'              : securityService.encryptValue(80000),
                    'monthlytakehome'     : securityService.encryptValue(4000),
                    'verified'            : true,
                    'verificationsentdate': createDate(2000, 1, 1),
                    'verificationcode'    : 'asdfasdf'
                },
                {
                    'email'               : 'test2@gmail.com',
                    'password'            : 'mypassword',
                    'security_level'      : 10,
                    'salary'              : securityService.encryptValue(60000),
                    'monthlytakehome'     : securityService.encryptValue(3000),
                    'verified'            : true,
                    'verificationsentdate': createDate(2000, 1, 1),
                    'verificationcode'    : 'asdfasdf'
                },
                {
                    'email'               : 'test3@gmail.com',
                    'password'            : 'mypassword',
                    'security_level'      : 10,
                    'salary'              : securityService.encryptValue(100000),
                    'monthlytakehome'     : securityService.encryptValue(5666.66),
                    'verified'            : true,
                    'verificationsentdate': createDate(2000, 1, 1),
                    'verificationcode'    : 'asdfasdf'
                },
                {
                    'email'               : 'test4@gmail.com',
                    'password'            : 'mypassword',
                    'security_level'      : 10,
                    'salary'              : securityService.encryptValue(100000),
                    'monthlytakehome'     : securityService.encryptValue(5666.66),
                    'verified'            : true,
                    'verificationsentdate': createDate(2000, 1, 1),
                    'verificationcode'    : 'asdfasdf'
                },
                {
                    'email'               : 'test5@gmail.com',
                    'password'            : 'mypassword',
                    'security_level'      : 10,
                    'salary'              : securityService.encryptValue(100000),
                    'monthlytakehome'     : securityService.encryptValue(5666.66),
                    'verified'            : true,
                    'verificationsentdate': createDate(2000, 1, 1),
                    'verificationcode'    : 'asdfasdf'
                },
                {
                    'email'               : 'test6@gmail.com',
                    'password'            : 'mypassword',
                    'security_level'      : 10,
                    'salary'              : securityService.encryptValue(100000),
                    'monthlytakehome'     : securityService.encryptValue(5666.66),
                    'verified'            : false,
                    'verificationsentdate': createDate(2000, 1, 1),
                    'verificationcode'    : 'asdfasdf'
                },
                {
                    'email'               : 'test7@gmail.com',
                    'password'            : 'mypassword',
                    'security_level'      : 0,
                    'salary'              : securityService.encryptValue(100000),
                    'monthlytakehome'     : securityService.encryptValue(5666.66),
                    'verified'            : false,
                    'verificationsentdate': createDate(2000, 1, 1),
                    'verificationcode'    : 'asdfasdf'
                },
                {
                    'email'               : 'test8@gmail.com',
                    'password'            : 'mypassword',
                    'security_level'      : 0,
                    'salary'              : securityService.encryptValue(100000),
                    'monthlytakehome'     : securityService.encryptValue(5666.66),
                    'verified'            : false,
                    'verificationsentdate': createDate(2000, 1, 1),
                    'verificationcode'    : 'asdfasdf'
                }
            ]);
    }

}
