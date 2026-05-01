component extends="tests.resources.baseTest" {

    function beforeAll() {
        super.beforeAll();
    }

    function afterAll() {
        super.afterAll();
    }

    function run() {
        describe('PostgreSQL Behavior Integration', () => {
            beforeEach(() => {
                setup();
            });

            it('Should populate local.result with generated keys for all 3 inserted records', () => {
                var q = queryExecute(
                    '
                    INSERT INTO 
                    users (email, monthlytakehome, password, salary, security_level, verified) 
                    VALUES 
                    (''test_#createUUID()#@gmail.com'', ''Wm3HI+wrB7gb+xjvPG9P8Q=='', ''$2a$04$xFcFb/vtl0tR8HIjGeNzduEXybTUTbhMzQVCD5i7jg2L9dmCs4f.S'', ''PoJND2tAmK/EcUIkUcp4VA=='', 0, false),
                    (''test_#createUUID()#@gmail.com'', ''Wm3HI+wrB7gb+xjvPG9P8Q=='', ''$2a$04$xFcFb/vtl0tR8HIjGeNzduEXybTUTbhMzQVCD5i7jg2L9dmCs4f.S'', ''PoJND2tAmK/EcUIkUcp4VA=='', 0, false),
                    (''test_#createUUID()#@gmail.com'', ''Wm3HI+wrB7gb+xjvPG9P8Q=='', ''$2a$04$xFcFb/vtl0tR8HIjGeNzduEXybTUTbhMzQVCD5i7jg2L9dmCs4f.S'', ''PoJND2tAmK/EcUIkUcp4VA=='', 0, false) 
                    RETURNING id, email, created
                    ',
                    {},
                    {result: 'local.result'}
                );

                // result variable should exist and be a struct
                expect(local).toHaveKey('result');
                expect(local.result).toBeStruct();

                // generated keys should be present
                expect(local.result).toHaveKey('id');
                expect(local.result).toHaveKey('email');
                expect(local.result).toHaveKey('created');

                // id should be an array of 3 numeric values
                expect(local.result.id).toBeString();
                expect(listToArray(local.result.id, ',')).toHaveLength(3);

                listToArray(local.result.id, ',').each((insertedId) => {
                    expect(insertedId).toBeNumeric();
                });

                // email and created arrays should also have 3 entries
                expect(local.result.email).toBeString();
                expect(listToArray(local.result.email, ',')).toHaveLength(3);

                expect(local.result.created).toBeString();
                expect(listToArray(local.result.created, ',')).toHaveLength(3);
            });

            it('Should populate result with generated keys for all 3 inserted records using QB', () => {
                var q        = getInstance('provider:QueryBuilder@qb');
                var inserted = q
                    .from('users')
                    .returning(['id', 'email', 'created'])
                    .insert([
                        {
                            'email'          : 'test_#createUUID()#@gmail.com',
                            'monthlytakehome': 'Wm3HI+wrB7gb+xjvPG9P8Q==',
                            'password'       : '$2a$04$xFcFb/vtl0tR8HIjGeNzduEXybTUTbhMzQVCD5i7jg2L9dmCs4f.S',
                            'salary'         : 'PoJND2tAmK/EcUIkUcp4VA==',
                            'security_level' : 0,
                            'verified'       : false
                        },
                        {
                            'email'          : 'test_#createUUID()#@gmail.com',
                            'monthlytakehome': 'Wm3HI+wrB7gb+xjvPG9P8Q==',
                            'password'       : '$2a$04$xFcFb/vtl0tR8HIjGeNzduEXybTUTbhMzQVCD5i7jg2L9dmCs4f.S',
                            'salary'         : 'PoJND2tAmK/EcUIkUcp4VA==',
                            'security_level' : 0,
                            'verified'       : false
                        },
                        {
                            'email'          : 'test_#createUUID()#@gmail.com',
                            'monthlytakehome': 'Wm3HI+wrB7gb+xjvPG9P8Q==',
                            'password'       : '$2a$04$xFcFb/vtl0tR8HIjGeNzduEXybTUTbhMzQVCD5i7jg2L9dmCs4f.S',
                            'salary'         : 'PoJND2tAmK/EcUIkUcp4VA==',
                            'security_level' : 0,
                            'verified'       : false
                        }
                    ]);

                // result variable should exist and be a struct
                expect(inserted).toHaveKey('result');
                expect(inserted.result).toBeStruct();

                // generated keys should be present
                expect(inserted.result).toHaveKey('id');
                expect(inserted.result).toHaveKey('email');
                expect(inserted.result).toHaveKey('created');

                // id should be an array of 3 numeric values
                expect(inserted.result.id).toBeString();
                expect(listToArray(inserted.result.id, ',')).toHaveLength(3);

                listToArray(inserted.result.id, ',').each((insertedId) => {
                    expect(insertedId).toBeNumeric();
                });

                // email and created arrays should also have 3 entries
                expect(inserted.result.email).toBeString();
                expect(listToArray(inserted.result.email, ',')).toHaveLength(3);

                expect(inserted.result.created).toBeString();
                expect(listToArray(inserted.result.created, ',')).toHaveLength(3);
            });
        });
    }

}
