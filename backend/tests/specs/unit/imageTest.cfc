component extends="tests.resources.baseTest" {

    property name="uploadPath" inject="coldbox:setting:uploadPath";

    function beforeAll() {
        super.beforeAll();
        imageService = getInstance('Helpers@ImageMagick');
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
                        expect(() => {
                            imageService.verifyImageMagick()
                        }).notToThrow();
                    });

                    it('Validate identity of .jpg image', () => {
                        var path = fetchAndWriteImg('https://picsum.photos/seed/test/200/200', 'jpg');

                        /**
                         * Validate identity of this image
                         */
                        expect(imageService.identify(path = path)).toBe('JPEG');
                    });

                    it('Can convert a .jpeg to .webp', () => {
                        var path = fetchAndWriteImg('https://picsum.photos/seed/test/200/200', 'jpeg');

                        /**
                         * Validate identity of this image
                         */
                        expect(imageService.identify(path = path)).toBe('JPEG');

                        /**
                         * Convert to webp
                         */
                        expect(() => {
                            imageService.convert(
                                path       = '#path#',
                                outputPath = '#left(path, path.len() - 4)#webp',
                                quality    = 10
                            )
                        }).notToThrow();

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
                        expect(imageService.identify(path = path)).toBe('HEIC');

                        /**
                         * Convert to webp
                         */
                        expect(() => {
                            imageService.convert(
                                path       = '#path#',
                                outputPath = '#left(path, path.len() - 4)#webp',
                                quality    = 10
                            )
                        }).notToThrow();

                        /**
                         * Both JPEG and WEBP will now exist
                         */
                        expect(fileExists(path)).toBeTrue();
                        expect(fileExists('#left(path, path.len() - 4)#webp')).toBeTrue();
                    });
                },
                '',
                false,
                application.cbController.getSetting('environment') == 'test'
            );
        });
    }

}
