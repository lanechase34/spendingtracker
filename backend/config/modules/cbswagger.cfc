component {

    /**
	 * CBSwagger Configuration
	 * https://github.com/coldbox-modules/cbswagger
	 */
    function configure() {
        return {
            // The route prefix to search.  Routes beginning with this prefix will be determined to be api routes
            routes       : ['api'],
            // Any routes to exclude
            excludeRoutes: [],
            // The default output format: json or yml
            defaultFormat: 'json',
            // A convention route, relative to your app root, where request/response samples are stored ( e.g. resources/apidocs/responses/[module].[handler].[action].[HTTP Status Code].json )
            samplesPath  : 'resources/apidocs',
            // Information about your API
            info         : {
                // A title for your API
                title         : 'SpendingTracker API',
                // A description of your API
                description   : '',
                // A terms of service URL for your API
                termsOfService: '',
                // The contact email address
                contact       : {
                    name : 'Chase Lane',
                    url  : '',
                    email: 'contact@chaselane.dev'
                },
                // A url to the License of your API
                license: {name: 'Apache 2.0', url: 'https://www.apache.org/licenses/LICENSE-2.0.html'},
                // The version of your API
                version: '1.0.0'
            },
            // Tags
            tags        : [],
            // https://swagger.io/specification/#externalDocumentationObject
            externalDocs: {description: '', url: ''},
            // https://swagger.io/specification/#serverObject
            servers     : [{url: 'https://chaselane.dev/spendingtracker', description: 'Production Server'}],
            // An element to hold various schemas for the specification.
            // https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.0.md#componentsObject
            components  : {
                // Define your security schemes here
                // https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.0.md#securitySchemeObject
                securitySchemes: {
                    ApiKeyAuth: {
                        'type'       : 'apiKey',
                        'description': 'JWT API Key',
                        'name'       : 'x-auth-token',
                        'in'         : 'header'
                    },
                    bearerAuth: {
                        'type'        : 'http',
                        'scheme'      : 'bearer',
                        'bearerFormat': 'JWT'
                    }
                }
            }

            // A default declaration of Security Requirement Objects to be used across the API.
            // https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.0.md#securityRequirementObject
            // Only one of these requirements needs to be satisfied to authorize a request
            // Individual operations may set their own requirements with `@security`
            // "security" : [
            //	{ "APIKey" : [] },
            //	{ "UserSecurity" : [] }
            // ]
        };
    }

}
