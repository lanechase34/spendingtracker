component extends="tests.resources.baseTest" {

    property name="uploadPath" inject="coldbox:setting:uploadPath";

    function beforeAll() {
        super.beforeAll();
    }

    function afterAll() {
        super.afterAll();
    }

    function run() {
        describe('Image Service Test', () => {
            beforeEach(() => {
                setup();

                imageService = getInstance('services.image');
            });

            it('Service can be created', () => {
                expect(imageService).toBeComponent();
            });

            /**
             * Skip this suite in test environment (imagemagick not set up)
             */
            describe(
                'Verify imagemagick functionality',
                () => {
                    it('Can verify image magick is functioning', () => {
                        var verify = imageService.verifyImageMagick();
                        expect(verify).toBe(true);
                    });

                    it('Validate identity of JPG image', () => {
                        var path = fetchAndWriteImg(
                            'https://upload.wikimedia.org/wikipedia/commons/1/16/HDRI_Sample_Scene_Balls_%28JPEG-HDR%29.jpg',
                            'jpg'
                        );

                        /**
                         * Validate identity of this image
                         */
                        expect(imageService.validIdentify(path = path)).toBeTrue();
                    });

                    it('Can convert a jpeg to webp', () => {
                        var path = fetchAndWriteImg(
                            'https://upload.wikimedia.org/wikipedia/commons/f/f6/Sample_0.JPEG',
                            'jpeg'
                        );

                        /**
                         * Validate identity of this image
                         */
                        expect(imageService.validIdentify(path = path)).toBeTrue();

                        /**
                         * Convert to webp
                         */
                        expect(imageService.convertToWebp(path = path, quality = 10)).toBeTrue();

                        /**
                         * Both JPEG and WEBP will now exist
                         */
                        expect(fileExists(path)).toBeTrue();
                        expect(fileExists('#left(path, path.len() - 4)#webp')).toBeTrue();
                    });
                },
                '',
                application.cbController.getSetting('environment') == 'test'
            );
        });
    }

}
