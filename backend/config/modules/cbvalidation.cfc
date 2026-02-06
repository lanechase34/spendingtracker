component {

    function configure() {
        // Category Handler
        var categoryHandler = {
            'category.view': {
                page: {
                    required: true,
                    type    : 'numeric',
                    min     : 1
                },
                records: {
                    required: true,
                    type    : 'numeric',
                    min     : 10,
                    max     : 100
                },
                search: {
                    required: false,
                    type    : 'string',
                    size    : '1..50'
                }
            }
        };

        // Expense Handler
        var expenseHandler = {
            'expense.view': {
                startDate: {required: true, type: 'date'},
                endDate  : {
                    required : true,
                    type     : 'date',
                    dateRange: {}
                },
                page: {
                    required: true,
                    type    : 'numeric',
                    min     : 1
                },
                records: {
                    required: true,
                    type    : 'numeric',
                    min     : 10,
                    max     : 100
                },
                search: {
                    required: false,
                    type    : 'string',
                    size    : '1..50'
                },
                orderCol: {
                    required: false,
                    type    : 'string',
                    size    : '1..25',
                    udf     : (value, target) => {
                        if(!isSimpleValue(value)) return false;
                        return ['date', 'amount', 'description', 'category'].contains(lCase(value));
                    }
                },
                orderDir: {
                    required: false,
                    type    : 'string',
                    size    : '3..4',
                    udf     : (value, target) => {
                        if(!isSimpleValue(value)) return false;
                        return ['asc', 'desc'].contains(lCase(value));
                    },
                    udfMessage: 'orderDir must be asc or desc'
                }
            },
            'expense.save': {
                date: {
                    required           : true,
                    type               : 'date',
                    afterOrEqual       : dateFormat(dateAdd('yyyy', -1, now()), 'short'),
                    afterOrEqualMessage: 'Date cannot be older than 1 year ago ({afterOrEqual})'
                },
                amount: {
                    required    : true,
                    type        : 'numeric',
                    range       : '0..999999',
                    rangeMessage: 'Amount needs to be a valid, positive number'
                },
                description: {
                    required: true,
                    type    : 'string',
                    size    : '3..500'
                },
                receipt   : {required: false, type: 'string'},
                categoryid: {
                    requiredif   : {category: ''},
                    type         : 'numeric',
                    min          : 1,
                    categorycheck: {pk: true}
                },
                category: {
                    requiredif   : {categoryid: ''},
                    type         : 'string',
                    size         : '3..30',
                    categorycheck: {pk: false} // check that this is a unique category being added
                }
            },
            'expense.remove': {
                id: {
                    required: true,
                    type    : 'numeric',
                    min     : 1
                }
            },
            'expense.receipt': {
                id: {
                    required: true,
                    type    : 'numeric',
                    min     : 1
                }
            },
            'expense.import': {},
            expenseDataRow  : {
                date: {
                    required           : true,
                    type               : 'date',
                    afterOrEqual       : dateFormat(dateAdd('yyyy', -1, now()), 'short'),
                    afterOrEqualMessage: 'Date cannot be older than 1 year ago ({afterOrEqual})'
                },
                amount: {
                    required    : true,
                    type        : 'numeric',
                    range       : '0..999999',
                    rangeMessage: 'Amount needs to be a valid, positive number'
                },
                description: {
                    required: true,
                    type    : 'string',
                    size    : '3..500'
                }
            },
            'expense.bulksave': {} // stub, validation handled in validator
        };

        // Bulk Save Endpoint (array of expense save)
        expenseHandler['expense.bulksavehandler'] = {
            'expenses.*.id': {
                required: true,
                type    : 'string',
                size    : '5..100'
            },
            'expenses.*.date'       : expenseHandler['expense.save'].date,
            'expenses.*.amount'     : expenseHandler['expense.save'].amount,
            'expenses.*.description': expenseHandler['expense.save'].description,
            'expenses.*.receipt'    : expenseHandler['expense.save'].receipt,
            'expenses.*.categoryid' : expenseHandler['expense.save'].categoryid,
            'expenses.*.category'   : expenseHandler['expense.save'].category
        };

        // Income Handler
        var incomeHandler = {
            'income.view': {
                startDate: {
                    required    : true,
                    type        : 'date',
                    regex       : '[0-9]{4}-[0-9]{2}',
                    regexMessage: 'The date must be in the format of YYYY-MM'
                },
                endDate: {
                    required    : true,
                    type        : 'date',
                    regex       : '[0-9]{4}-[0-9]{2}',
                    regexMessage: 'The date must be in the format of YYYY-MM',
                    dateRange   : {}
                }
            },
            'income.save': {
                date: {
                    required    : true,
                    type        : 'date',
                    regex       : '[0-9]{4}-[0-9]{2}',
                    regexMessage: 'The date must be in the format of YYYY-MM',
                    after       : '01/01/2024',
                    after       : '01/01/2024',
                    before      : '01/01/2075'
                },
                pay: {
                    required: true,
                    type    : 'numeric',
                    range   : '0..99999'
                },
                extra: {
                    required: true,
                    type    : 'numeric',
                    range   : '0..99999'
                }
            }
        };

        // Subscription Handler
        var subscriptionHandler = {
            'subscription.view': {
                page: {
                    required: true,
                    type    : 'numeric',
                    min     : 1
                },
                records: {
                    required: true,
                    type    : 'numeric',
                    min     : 10,
                    max     : 100
                },
                search: {
                    required: false,
                    type    : 'string',
                    size    : '1..50'
                },
                orderCol: {
                    required: false,
                    type    : 'string',
                    size    : '1..25',
                    udf     : (value, target) => {
                        if(!isSimpleValue(value)) return false;
                        return [
                            'nextchargedate',
                            'amount',
                            'description',
                            'category'
                        ].contains(lCase(value));
                    }
                },
                orderDir: {
                    required: false,
                    type    : 'string',
                    size    : '3..4',
                    udf     : (value, target) => {
                        if(!isSimpleValue(value)) return false;
                        return ['asc', 'desc'].contains(lCase(value));
                    },
                    udfMessage: 'orderDir must be asc or desc'
                },
                interval: {
                    required: false,
                    type    : 'string',
                    size    : '1',
                    udf     : (value, target) => {
                        return ['Y', 'M', ''].contains(value);
                    },
                    udfMessage: 'Value must be Y (Year), M (Month), or blank.'
                }
            },
            'subscription.save': {
                date: {
                    required           : true,
                    type               : 'date',
                    afterOrEqual       : dateFormat(dateAdd('yyyy', -1, now()), 'short'),
                    afterOrEqualMessage: 'Date cannot be older than 1 year ago ({afterOrEqual})'
                },
                amount: {
                    required    : true,
                    type        : 'numeric',
                    range       : '0..999999',
                    rangeMessage: 'Amount needs to be a valid, positive number'
                },
                description: {
                    required: true,
                    type    : 'string',
                    size    : '1..500'
                },
                interval: {
                    required: true,
                    type    : 'string',
                    udf     : (value, target) => {
                        if(!value.len()) return true;
                        return ['Y', 'M'].contains(value);
                    },
                    udfMessage: 'Value must be Y (Year) or M (Month).'
                },
                receipt   : {required: false, type: 'string'},
                categoryid: {
                    requiredif   : {category: ''},
                    type         : 'numeric',
                    min          : 1,
                    categorycheck: {pk: true}
                },
                category: {
                    requiredif   : {categoryid: ''},
                    type         : 'string',
                    size         : '3..30',
                    categorycheck: {pk: false} // check that this is a unique category being added
                }
            },
            'subscription.remove': {
                id: {
                    required: true,
                    type    : 'numeric',
                    min     : 1
                }
            },
            'subscription.toggle': {
                id: {
                    required: true,
                    type    : 'numeric',
                    min     : 1
                },
                active: {required: true, type: 'boolean'}
            }
        };

        var userBase = {
            email: {
                required: true,
                type    : 'email',
                size    : '5..255'
            },
            password: {
                required: true,
                type    : 'string',
                size    : '10..256'
            }
        };

        // Authentication Handler
        var authHandler = {
            'auth.login': {
                email     : userBase.email,
                password  : userBase.password,
                rememberMe: {required: true, type: 'boolean'}
            },
            'auth.logout'  : {},
            'auth.register': {
                email: {
                    required           : true,
                    type               : 'email',
                    size               : '5..255',
                    uniqueDatabaseField: {table: 'users', column: 'email'}
                },
                password: userBase.password,
                salary  : {
                    required: true,
                    type    : 'numeric',
                    min     : 1
                },
                monthlyTakeHome: {
                    required: true,
                    type    : 'numeric',
                    min     : 1
                }
            },
            'auth.generateCSRF': {},
            'auth.verify'      : {
                verificationCode: {
                    required: true,
                    type    : 'string',
                    size    : '8'
                }
            },
            'auth.resendVerificationCode': {}
        };

        // User handler
        var userHandler = {
            'user.getprofile'   : {},
            'user.updateprofile': {
                password: {
                    required: false,
                    type    : 'string',
                    size    : '10..256'
                },
                salary: {
                    required: false,
                    type    : 'numeric',
                    min     : 1
                },
                monthlyTakeHome: {
                    required: false,
                    type    : 'numeric',
                    min     : 1
                }
            },
            'user.view': {
                page: {
                    required: true,
                    type    : 'numeric',
                    min     : 1
                },
                records: {
                    required: true,
                    type    : 'numeric',
                    min     : 10,
                    max     : 100
                },
                search: {
                    required: false,
                    type    : 'string',
                    size    : '1..50'
                },
                orderCol: {
                    required: false,
                    type    : 'string',
                    size    : '1..25',
                    udf     : (value, target) => {
                        if(!isSimpleValue(value)) return false;
                        return [
                            'email',
                            'security_level',
                            'verified',
                            'lastlogin'
                        ].contains(lCase(value));
                    }
                },
                orderDir: {
                    required: false,
                    type    : 'string',
                    size    : '3..4',
                    udf     : (value, target) => {
                        if(!isSimpleValue(value)) return false;
                        return ['asc', 'desc'].contains(lCase(value));
                    },
                    udfMessage: 'orderDir must be asc or desc'
                }
            }
        };

        // Widget Handler
        var widgetBase = {
            startDate: {required: true, type: 'date'},
            endDate  : {
                required : true,
                type     : 'date',
                dateRange: {}
            }
        };

        var widgetHandler = {
            'widget.stackedbarchart': widgetBase,
            'widget.donutchart'     : widgetBase,
            'widget.linechart'      : {
                startDate: {
                    required: true,
                    type    : 'date',
                    udf     : (value, target, metadata) => {
                        if(!isDate(value)) return false;
                        return month(value) == 1;
                    },
                    udfMessage: 'The startDate must be January'
                },
                endDate: {
                    required : true,
                    type     : 'date',
                    dateRange: {
                        datePart: 'd',
                        maxRange: 364,
                        minRange: 364
                    },
                    udf: (value, target) => {
                        if(!isDate(value)) return false;
                        return month(value) == 12;
                    },
                    udfMessage: 'The endDate must be December'
                }
            }
        };

        // Admin handler
        var adminHandler = {
            'admin.viewaudits': {
                startDate: {required: true, type: 'date'},
                endDate  : {
                    required : true,
                    type     : 'date',
                    dateRange: {}
                },
                page: {
                    required: true,
                    type    : 'numeric',
                    min     : 1
                },
                records: {
                    required: true,
                    type    : 'numeric',
                    min     : 10,
                    max     : 100
                },
                search: {
                    required: false,
                    type    : 'string',
                    size    : '1..50'
                },
                orderCol: {
                    required: false,
                    type    : 'string',
                    size    : '1..25',
                    udf     : (value, target) => {
                        if(!isSimpleValue(value)) return false;
                        return [
                            'created',
                            'ip',
                            'urlpath',
                            'method',
                            'agent',
                            'statuscode',
                            'delta',
                            'email'
                        ].contains(lCase(value));
                    }
                },
                orderDir: {
                    required: false,
                    type    : 'string',
                    size    : '3..4',
                    udf     : (value, target) => {
                        if(!isSimpleValue(value)) return false;
                        return ['asc', 'desc'].contains(lCase(value));
                    },
                    udfMessage: 'orderDir must be asc or desc'
                }
            },
            'admin.viewbugs': {
                startDate: {required: true, type: 'date'},
                endDate  : {
                    required : true,
                    type     : 'date',
                    dateRange: {}
                },
                page: {
                    required: true,
                    type    : 'numeric',
                    min     : 1
                },
                records: {
                    required: true,
                    type    : 'numeric',
                    min     : 10,
                    max     : 100
                },
                search: {
                    required: false,
                    type    : 'string',
                    size    : '1..50'
                },
                orderCol: {
                    required: false,
                    type    : 'string',
                    size    : '1..25',
                    udf     : (value, target) => {
                        if(!isSimpleValue(value)) return false;
                        return [
                            'created',
                            'ip',
                            'urlpath',
                            'method',
                            'agent',
                            'detail',
                            'email'
                        ].contains(lCase(value));
                    }
                },
                orderDir: {
                    required: false,
                    type    : 'string',
                    size    : '3..4',
                    udf     : (value, target) => {
                        if(!isSimpleValue(value)) return false;
                        return ['asc', 'desc'].contains(lCase(value));
                    },
                    udfMessage: 'orderDir must be asc or desc'
                }
            },
            'admin.metrics'  : {},
            'admin.cachedata': {},
            'admin.taskdata' : {}
        };

        // Generics
        var generic = {
            'echo.warmup'           : {},
            'echo.healthcheck'      : {},
            'echo.status'           : {},
            'echo.invalidhttpmethod': {},
            'echo.invalidevent'     : {},
            'echo.onmissingaction'  : {},
            'echo.onexception'      : {},
            'echo.unauthorized'     : {},
            'echo.missingtemplate'  : {},
            'jwt.refreshtoken'      : {}
        };

        var result = {};
        result.append(categoryHandler);
        result.append(expenseHandler);
        result.append(incomeHandler);
        result.append(subscriptionHandler);
        result.append(authHandler);
        result.append(userHandler);
        result.append(widgetHandler);
        result.append(adminHandler);
        result.append(generic);
        return {sharedConstraints: result};
    }

}
