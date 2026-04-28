component extends="tests.resources.baseTest" {

    property name="uploadPath" inject="coldbox:setting:uploadPath";

    function beforeAll() {
        super.beforeAll();
        imageService = getInstance('services.image');
    }

    function afterAll() {
        super.afterAll();
    }

    function run() {
        describe('Image Service Test', () => {
            beforeEach(() => {
                setup();
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

                    it('Validate identity of .jpg image', () => {
                        var path = fetchAndWriteImg('https://picsum.photos/seed/test/200/200', 'jpg');

                        /**
                         * Validate identity of this image
                         */
                        expect(imageService.validIdentify(path = path)).toBeTrue();
                    });

                    it('Can convert a .jpeg to .webp', () => {
                        var path = fetchAndWriteImg('https://picsum.photos/seed/test/200/200', 'jpeg');

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

                    it('Can convert a .heic to .webp', () => {
                        var path = fetchAndWriteImg(
                            'https://raw.githubusercontent.com/nokiatech/heif_conformance/master/conformance_files/C001.heic',
                            'heic'
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
