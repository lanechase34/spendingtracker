component extends="tests.resources.baseTest" {

    function beforeAll() {
        super.beforeAll();

        mockUser       = getInstance("tests.resources.mockuser");
        expenseService = getInstance("services.expense");
    }

    function afterAll() {
        super.afterAll();
    }

    /**
     * Write a stand-in receipt file into the user's dir and return its name
     * The zip doesn't read the image, so any bytes will do
     */
    private string function writeReceipt(required component user) {
        var receipt = createUUID().replace("-", "", "all");
        fileWrite("#user.getDir()#/#receipt#.webp", "receipt #receipt#");
        return receipt;
    }

    /**
     * Entry names inside a zip file
     */
    private array function zipEntries(required string zipPath) {
        cfzip(
            action = "list",
            file   = zipPath,
            name   = "local.entries"
        );
        return valueArray(entries, "name");
    }

    function run() {
        describe("expenseService.receiptExport", () => {
            beforeEach(() => {
                setup();
                user      = mockUser.make();
                startDate = dateAdd("d", -7, now());
                endDate   = now();
                zipPath   = "";
            });

            afterEach(() => {
                if(zipPath.len() && fileExists(zipPath)) {
                    fileDelete(zipPath);
                }
                mockUser.delete(user);
            });

            it("Gives receipts with the same date and description their own entries", () => {
                // Subscription charges share a date and description - the duplicate entry used to fail the whole zip
                for(var i = 1; i <= 3; i++) {
                    expenseHelper.mock(
                        userid      = user.getId(),
                        count       = 1,
                        date        = now(),
                        description = "Streaming",
                        categoryid  = 1,
                        receipt     = writeReceipt(user)
                    );
                }

                zipPath = expenseService.receiptExport(
                    startDate = startDate,
                    endDate   = endDate,
                    userid    = user.getId(),
                    userDir   = user.getDir()
                );

                var entries = zipEntries(zipPath);
                expect(entries.len()).toBe(3);
                expect(
                    entries
                        .reduce((acc, name) => acc.listAppend(name), "")
                        .listRemoveDuplicates()
                        .listLen()
                ).toBe(3);
            });

            it("Skips expenses whose receipt file is missing instead of failing", () => {
                expenseHelper.mock(
                    userid      = user.getId(),
                    count       = 1,
                    date        = now(),
                    description = "Has a file",
                    categoryid  = 1,
                    receipt     = writeReceipt(user)
                );
                expenseHelper.mock(
                    userid      = user.getId(),
                    count       = 1,
                    date        = now(),
                    description = "File is gone",
                    categoryid  = 1,
                    receipt     = createUUID().replace("-", "", "all")
                );

                zipPath = expenseService.receiptExport(
                    startDate = startDate,
                    endDate   = endDate,
                    userid    = user.getId(),
                    userDir   = user.getDir()
                );

                var entries = zipEntries(zipPath);
                expect(entries.len()).toBe(1);
                expect(entries[1]).toInclude("Has a file");
            });

            it("Throws NoReceiptsFound when no receipt file exists", () => {
                expenseHelper.mock(
                    userid      = user.getId(),
                    count       = 1,
                    date        = now(),
                    description = "File is gone",
                    categoryid  = 1,
                    receipt     = createUUID().replace("-", "", "all")
                );

                expect(() => {
                    expenseService.receiptExport(
                        startDate = startDate,
                        endDate   = endDate,
                        userid    = user.getId(),
                        userDir   = user.getDir()
                    );
                }).toThrow("NoReceiptsFound");
            });
        });

        describe("expenseService.deleteReceiptIfUnused", () => {
            beforeEach(() => {
                setup();
                user = mockUser.make();
            });

            afterEach(() => {
                mockUser.delete(user);
            });

            it("Deletes a receipt nothing references", () => {
                var receipt = writeReceipt(user);

                expect(
                    expenseService.deleteReceiptIfUnused(
                        receipt = receipt,
                        userid  = user.getId(),
                        userDir = user.getDir()
                    )
                ).toBeTrue();
                expect(fileExists("#user.getDir()#/#receipt#.webp")).toBeFalse();
            });

            it("Keeps a receipt an expense still references", () => {
                var receipt = writeReceipt(user);
                expenseHelper.mock(
                    userid      = user.getId(),
                    count       = 1,
                    date        = now(),
                    description = "Uses the receipt",
                    categoryid  = 1,
                    receipt     = receipt
                );

                expect(
                    expenseService.deleteReceiptIfUnused(
                        receipt = receipt,
                        userid  = user.getId(),
                        userDir = user.getDir()
                    )
                ).toBeFalse();
                expect(fileExists("#user.getDir()#/#receipt#.webp")).toBeTrue();
            });

            it("Is a no-op for an empty receipt", () => {
                expect(
                    expenseService.deleteReceiptIfUnused(
                        receipt = "",
                        userid  = user.getId(),
                        userDir = user.getDir()
                    )
                ).toBeFalse();
            });

            it("Refuses a receipt name that could leave the user's directory", () => {
                // A file one level up that would be hit by a "../" name
                var outside = "#user.getDir()#/../receipt_guard_#createUUID()#.webp";
                fileWrite(outside, "do not delete");

                try {
                    var name = "../" & listFirst(getFileFromPath(outside), ".");
                    expect(
                        expenseService.deleteReceiptIfUnused(
                            receipt = name,
                            userid  = user.getId(),
                            userDir = user.getDir()
                        )
                    ).toBeFalse();
                    expect(fileExists(outside)).toBeTrue();
                }
                finally {
                    if(fileExists(outside)) fileDelete(outside);
                }
            });
        });
    }

}
