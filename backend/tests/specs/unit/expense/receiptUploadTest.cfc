component extends="tests.resources.baseTest" {

    function beforeAll() {
        super.beforeAll();
    }

    function afterAll() {
        super.afterAll();
    }

    function run() {
        describe("expenseService.receiptUpload", () => {
            beforeEach(() => {
                setup();

                mockImageService = createEmptyMock("ImageMagickHelpers.models.services.image");

                // Fresh, non-singleton instance so the mocked property does not leak into other specs
                expenseService = createMock("models.services.expense");
                expenseService.$property(propertyName = "imageService", mock = mockImageService);
            });

            it("Returns the UUID from validateUpload", () => {
                mockImageService.$("validateUpload", "3f2a9c1e4b7d4a6c9e1f2a3b4c5d6e7f");

                var result = expenseService.receiptUpload(formField = "receipt", userDir = "/tmp/user");

                expect(result).toBe("3f2a9c1e4b7d4a6c9e1f2a3b4c5d6e7f");
            });

            it("Uploads in a single pass with auto orientation, quality, and resize", () => {
                mockImageService.$("validateUpload", createUUID());
                mockImageService.$("convert");

                expenseService.receiptUpload(formField = "receipt", userDir = "/tmp/user");

                expect(mockImageService.$count("validateUpload")).toBe(1);
                expect(mockImageService.$count("convert")).toBe(0); // no second lossy re-encode

                var args = mockImageService.$callLog().validateUpload[1];
                expect(args.autoOrient).toBeTrue();
                expect(args.quality).toBe(50);
                expect(args.resize).toBe(750);
                expect(args.outputs).toBe([{uploadDir: "/tmp/user", type: "webp"}]);
            });

            it("Enforces the same extensions and file size limit as the frontend", () => {
                mockImageService.$("validateUpload", createUUID());

                expenseService.receiptUpload(formField = "receipt", userDir = "/tmp/user");

                var args = mockImageService.$callLog().validateUpload[1];
                expect(args.extensions).toBe("png,jpg,jpeg,webp,heic");
                expect(args.maxFileSize).toBe(10 * 1024 * 1024);
            });

            it("Reads the receipt from the supplied form field", () => {
                mockImageService.$("validateUpload", createUUID());

                // Bulk import uses dynamic receipt_<id> form fields
                expenseService.receiptUpload(formField = "receipt_123", userDir = "/tmp/user");

                expect(mockImageService.$callLog().validateUpload[1].formField).toBe("receipt_123");
            });

            it("Propagates upload validation failures", () => {
                mockImageService.$(
                    method         = "validateUpload",
                    throwException = true,
                    throwType      = "ImageMagick.UploadValidationException",
                    throwMessage   = "Image is too large - it can be at most 100 megapixels."
                );

                expect(() => {
                    expenseService.receiptUpload(formField = "receipt", userDir = "/tmp/user");
                }).toThrow("ImageMagick.UploadValidationException");
            });
        });
    }

}
