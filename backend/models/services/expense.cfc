component singleton accessors="true" {

    property name="async"              inject="asyncManager@coldbox";
    property name="basePath"           inject="coldbox:setting:basePath";
    property name="cacheStorage"       inject="cachebox:coldboxStorage";
    property name="imageService"       inject="Helpers@ImageMagick";
    property name="q"                  inject="provider:QueryBuilder@qb";
    property name="maxThreads"         inject="coldbox:setting:maxThreads";
    property name="securityService"    inject="services.security";
    property name="spreadsheetService" inject="Spreadsheet@spreadsheet-cfml";
    property name="validationManager"  inject="ValidationManager@cbvalidation";

    /**
     * Expense Import CSV format
     */
    property name="headers"           type="array";
    property name="maxRows"           type="numeric";
    property name="maxImportFileSize" type="numeric";
    function init() {
        setHeaders(["Date", "Amount", "Description"]);
        setMaxRows(200); // limit to 200 rows for performance - bulk save uses the same limit
        setMaxImportFileSize(5 * 1024 * 1024); // 5mb
    }

    /**
     * Returns pagination data struct and
     * records for the current page
     */
    public struct function paginate(
        required date startDate,
        required date endDate,
        required numeric userid,
        required numeric page,
        required numeric records,
        string search   = "",
        string orderCol = "",
        string orderDir = ""
    ) {
        /**
         * Base Query
         */
        var base = q
            .from("expense")
            .join(
                "category",
                "expense.categoryid",
                "=",
                "category.id"
            )
            .where("expense.userid", "=", userid)
            .andWhereBetween(
                "expense.date",
                {value: startDate, cfsqltype: "date"},
                {value: endDate, cfsqltype: "date"}
            )
            .andWhere((q1) => {
                q1.whereLike(q.raw("lower(expense.description)"), {value: "%#lCase(search)#%", cfsqltype: "varchar"})
                    .orWhereLike(q.raw("lower(category.name)"), {value: "%#lCase(search)#%", cfsqltype: "varchar"})
                    .when(
                        condition = isDate(search),
                        onTrue    = (q2) => {
                            q2.orWhere(
                                "expense.date",
                                "=",
                                {value: search, cfsqltype: "date"}
                            );
                        },
                        withoutScoping = true
                    );
            });

        /**
         * Calculated the filtered total expense sum and the number of records
         */
        var filtered        = base.select(["expense.id", "expense.amount"]).get();
        var filteredRecords = filtered.len();

        /**
         * Perform total info query and data query in parallel
         */
        var offset           = (page - 1) * records;
        var asyncFilteredSum = async.newFuture(() => {
            var curr = filtered.reduce((prev, record) => {
                return prev + securityService.decryptValue(record.amount, "numeric");
            }, 0);
            return securityService.intToFloat(curr);
        });

        var asyncTotalInfo = async.newFuture(() => {
            return getTotalInfo(
                startDate = startDate,
                endDate   = endDate,
                userid    = userid
            );
        });

        var asyncData = async.newFuture(() => {
            // Amount sorting must be performed after loading all rows into memory
            var isAmountSort = orderCol == "amount" && orderDir.len();
            var cacheKey     = "userid=#userid#|expense.paginate|orderCol=amount|startDate=#startDate#|endDate=#endDate#|search=#search#";
            var rows         = isAmountSort ? duplicate(cacheStorage.get(cacheKey)) : null;

            if(isNull(rows)) {
                var fullQuery = base
                    .when(
                        // Only apply DB-level ordering when NOT sorting by amount
                        condition = !isAmountSort && orderCol.len() && orderDir.len(),
                        onTrue    = (q1) => {
                            q1.orderBy(orderCol, orderDir).orderBy("expense.id", orderDir);
                        },
                        onFalse = (q1) => {
                            if(!isAmountSort) {
                                q1.orderBy("expense.date", "desc").orderBy("expense.id", "desc");
                            }
                        }
                    )
                    .select([
                        "expense.id",
                        "expense.date",
                        "expense.amount",
                        "expense.description",
                        "category.name as category"
                    ])
                    .selectRaw("expense.receipt is not null as receipt");

                // For amount sorting, fetch ALL filtered rows so we can perform sorting in memory
                if(!isAmountSort) {
                    fullQuery = fullQuery.limit(records).offset(offset);
                }

                rows = fullQuery.get();

                rows = rows.map(
                    (value) => {
                        value.date          = dateFormat(value.date, "yyyy-mm-dd");
                        var amountDecrypted = securityService.decryptValue(value.amount, "numeric"); // raw cents int
                        value.amount        = securityService.intToFloat(amountDecrypted);

                        // Need the int cents value to sort
                        if(isAmountSort) {
                            value.amountDecrypted = amountDecrypted;
                        }

                        return value;
                    },
                    true,
                    maxThreads
                );

                if(isAmountSort) {
                    cacheStorage.set(cacheKey, rows);
                    // Work on a deep copy so sort/delete never mutates the cached structs
                    rows = duplicate(rows);
                }
            }

            if(isAmountSort) {
                // Perform amount sort using int cents
                rows.sort((a, b) => {
                    return orderDir == "asc"
                     ? a.amountDecrypted - b.amountDecrypted
                     : b.amountDecrypted - a.amountDecrypted;
                });

                // Slice the correct page from the fully sorted result
                var rowCount = rows.len();
                if(rowCount && offset < rowCount) {
                    var startPosition = offset + 1; // slice offset is 1-based
                    var remaining     = rowCount - offset; // how many elements remaining after startPosition

                    var length = min(remaining, records); // clamp the records returned to not go out of bounds
                    rows       = rows.slice(startPosition, length);
                }
                else {
                    rows = [];
                }

                // Clean up the temp field
                rows = rows.map((value) => {
                    value.delete("amountDecrypted");
                    return value;
                });
            }

            return rows;
        });

        var results = async
            .newFuture()
            .all(asyncFilteredSum, asyncTotalInfo, asyncData)
            .get();

        var filteredSum = results[1];
        var totalInfo   = results[2];
        var data        = results[3];

        return {
            pagination: {
                totalRecords   : totalInfo.count,
                filteredRecords: filteredRecords,
                offset         : offset,
                page           : parseNumber(page)
            },
            results: {
                expenses   : data,
                totalSum   : totalInfo.amount,
                filteredSum: filteredSum
            }
        };
    }

    /**
     * Get the total count of records and total amount spent on all expenses in the date range
     */
    private struct function getTotalInfo(
        required date startDate,
        required date endDate,
        required numeric userid
    ) {
        var cacheKey = "userid=#userid#|expense.getTotalInfo|startDate=#startDate#|endDate=#endDate#";
        var total    = cacheStorage.get(cacheKey);
        if(isNull(total)) {
            var result = queryExecute(
                "
                select amount
                from expense
                where userid = :userid
                and date between :startDate and :endDate
                ",
                {
                    userid   : {value: userid, cfsqltype: "numeric"},
                    startDate: {value: startDate, cfsqltype: "date"},
                    endDate  : {value: endDate, cfsqltype: "date"}
                }
            );

            // Decrypt and sum amounts
            var totalAmount = result.reduce((prev, row) => {
                return prev + securityService.decryptValue(row.amount, "numeric");
            }, 0);

            total = {count: result.recordCount(), amount: securityService.intToFloat(totalAmount)};

            cacheStorage.set(cacheKey, total);
        }
        return total;
    }

    /**
     * Saves an expense record
     * Optional subscriptionid if this expense was charged from subscription
     */
    public void function save(
        required date date,
        required numeric amount,
        required string description,
        required numeric categoryid,
        required string receipt,
        required numeric userid,
        numeric subscriptionid = -1
    ) {
        var data = {
            date       : {value: date, cfsqltype: "date"},
            amount     : {value: securityService.encryptValue(amount), cfsqltype: "varchar"},
            description: {value: description, cfsqltype: "varchar"},
            categoryid : {value: categoryid, cfsqltype: "numeric"},
            receipt    : receipt,
            userid     : {value: userid, cfsqltype: "numeric"}
        };

        if(subscriptionid > 0) {
            data.subscriptionid = {value: subscriptionid, cfsqltype: "numeric"};
        }

        q.from("expense").insert(data);

        // Clear user expense cache
        cacheStorage.clearByKeySnippet(keySnippet = "userid=#userid#|expense");
        cacheStorage.clearByKeySnippet(keySnippet = "userid=#userid#|widget");
        return;
    }

    /**
     * Delete an expense by the supplied id (pk)
     *
     * @return true on success
     */
    public boolean function delete(
        required numeric id,
        required string userDir,
        required numeric userid
    ) {
        var qResult = q
            .from("expense")
            .returning(["receipt"])
            .where("id", "=", {value: id, cfsqltype: "numeric"})
            .andWhere(
                "userid",
                "=",
                {value: userid, cfsqltype: "numeric"}
            )
            .delete();

        var success = qResult.result.recordCount == 1;

        if(success) {
            // A subscription's receipt is shared with every expense it charged - only delete the file once nothing uses it
            deleteReceiptIfUnused(
                receipt = qResult.result?.receipt ?: "",
                userid  = userid,
                userDir = userDir
            );

            // Clear user expense cache
            cacheStorage.clearByKeySnippet(keySnippet = "userid=#userid#|expense");
            cacheStorage.clearByKeySnippet(keySnippet = "userid=#userid#|widget");
        }

        return success;
    }

    /**
     * Return the expense's receipt
     */
    public string function getReceipt(
        required numeric id,
        required string userDir,
        required numeric userid,
        boolean return404 = true
    ) {
        var receiptRecord = q
            .from("expense")
            .where("id", "=", {value: id, cfsqltype: "numeric"})
            .andWhere(
                "userid",
                "=",
                {value: userid, cfsqltype: "numeric"}
            )
            .select(["receipt"])
            .first();

        // Make sure record and file exists
        if(
            !receiptRecord.keyExists("receipt") // Not a valid record
            || isNull(receiptRecord.receipt) // Record never had a receipt
            || !receiptRecord.receipt.len() // Invalid receipt
            || !fileExists(
                getReceiptPath(receipt = receiptRecord.receipt, userDir = userDir) // Check the receipt still exists
            )
        ) {
            return return404 ? "#getBasePath()#/views/404.webp" : "";
        }

        return getReceiptPath(receipt = receiptRecord.receipt, userDir = userDir);
    }

    /**
     * Delete a receipt file once no expense or subscription of the user references it
     * A subscription and every expense it charged share one receipt file, so a delete can't assume it owns the file
     * Also used to clean up a receipt that was uploaded for a save that then failed
     *
     * @receipt Receipt name (server generated) - empty is a no-op
     * @userid  Owner of the receipt
     * @userDir Owner's upload directory
     *
     * @return true if the file was deleted
     */
    public boolean function deleteReceiptIfUnused(
        required string receipt,
        required numeric userid,
        required string userDir
    ) {
        // Receipt names are generated server side - refuse anything that could leave the user's directory
        if(!receipt.len() || !userDir.len() || !reFind("^[A-Za-z0-9-]+$", receipt)) {
            return false;
        }

        var references = 0;
        for(var table in ["expense", "subscription"]) {
            references += q
                .from(table)
                .where(
                    "userid",
                    "=",
                    {value: userid, cfsqltype: "numeric"}
                )
                .andWhere(
                    "receipt",
                    "=",
                    {value: receipt, cfsqltype: "varchar"}
                )
                .count();
        }

        var path = getReceiptPath(receipt = receipt, userDir = userDir);
        if(references || !fileExists(path)) {
            return false;
        }

        fileDelete(path);
        return true;
    }

    /**
     * Gets the absolute path of receipt supplied in the userdir
     */
    private string function getReceiptPath(required string receipt, required string userDir) {
        return "#userDir#/#receipt#.webp";
    }

    /**
     * Import an expense CSV uploaded in a multipart form field
     * The file must come from a real upload
     *
     * @formField The multipart form field holding the .csv
     *
     * @return same struct as processExpenseData
     */
    public struct function importUpload(required string formField) {
        var invalid = {
            valid  : false,
            message: "Error loading file. Please use the template provided",
            data   : [],
            errors : []
        };

        // Each import gets its own temp directory, so concurrent imports never see each other's files
        var tempDir = "#getTempDirectory()#/expense-import-#lCase(createUUID())#";
        directoryCreate(tempDir);

        try {
            // cffile only accepts an actual uploaded file part - it throws for any other kind of value
            // Result must be local - this service is a singleton
            var upload = {};
            try {
                cffile(
                    action       = "upload",
                    fileField    = formField,
                    destination  = tempDir,
                    nameConflict = "makeUnique",
                    result       = "local.upload"
                );
            }
            catch(any e) {
                return invalid;
            }

            // Browsers report .csv with several mime types (text/csv, application/vnd.ms-excel, none) - check the extension instead
            if(lCase(upload.serverFileExt) != "csv") {
                return invalid;
            }

            if(upload.fileSize > getMaxImportFileSize()) {
                invalid.message = "Error file is too large. Please limit to a maximum of #getMaxImportFileSize() / 1024 / 1024#mb";
                return invalid;
            }

            return processExpenseData("#upload.serverDirectory#/#upload.serverFile#");
        }
        finally {
            if(directoryExists(tempDir)) {
                directoryDelete(tempDir, true);
            }
        }
    }

    /**
     * Process an expense file imported by user
     * Only ever call this with a path the server chose (see importUpload) - never a path from the request
     * Validate the headers and columns
     *
     * Headers should be [Date, Amount, Description]
     * Column Types [date, numeric, string]
     *
     * @expenseFile .csv file
     *
     * @return data array of structs of valid rows
     */
    public struct function processExpenseData(required string expenseFile) {
        var result = {
            valid  : true,
            message: "",
            data   : [],
            errors : []
        };

        // Attempt to import the file
        try {
            var csvData = spreadsheetService
                .readCsv(expenseFile)
                .intoAnArray()
                .withFirstRowIsHeader()
                .withAllowMissingColumnNames(false)
                .withDelimiter(",")
                .execute();
        }
        catch(any e) {
            result.valid   = false;
            result.message = "Error loading file. Please use the template provided";
        }

        if(!result.valid) return result;

        // Check column headers
        for(var i = 1; i <= getHeaders().len(); i++) {
            if(
                arrayLen(csvData.columns) < getHeaders().len()
                || getHeaders()[i] != csvData.columns[i]
            ) {
                result.valid   = false;
                result.message = "Please verify columns match exactly: #getHeaders().toList(", ")#";
                break;
            }
        }

        if(!result.valid) return result;

        if(csvData.data.len() > getMaxRows()) {
            result.valid   = false;
            result.message = "Error file contains too many rows. Please limit to a maximum of #getMaxRows()# rows";
            return result;
        }

        // Import the data and verify the types for each
        csvData.data.each((row, index) => {
            try {
                var rowData = {
                    date       : row[1],
                    amount     : row[2],
                    description: row[3]
                };

                /**
                 * Validate each row
                 */
                var validation = validationManager.validate(target = rowData, constraints = "expenseDataRow");
                if(!validation.hasErrors()) {
                    rowData.amount = parseNumber(rowData.amount); // Safely parse amount as number after validating
                    result.data.append(rowData);
                }
                else {
                    // +1 for header row
                    result.errors.append({row: index + 1, message: validation.getAllErrors().toList("; ")});
                }
            }
            catch(any e) {
                result.errors.append({row: index + 1, message: "Error importing row. Please try again."});
            }
        });

        return result;
    }

    /**
     * Export data to csv between the startdate, enddate range
     * for the supplied user
     *
     * Returns the csv as string
     */
    public string function csvExport(
        required date startDate,
        required date endDate,
        required numeric userid
    ) {
        var totalInfo = getTotalInfo(
            startDate = startDate,
            endDate   = endDate,
            userid    = userid
        );

        var records = paginate(
            startDate = startDate,
            endDate   = endDate,
            userid    = userid,
            page      = 1,
            records   = totalInfo.count
        ).results.expenses;

        records.each(
            (expense) => {
                expense.delete("id");
                expense.delete("receipt");
            },
            true,
            maxThreads
        );

        return spreadsheetService
            .writeCsv()
            .fromData(records)
            .withStructKeysAsHeader()
            .execute();
    }

    /**
     * Returns all expenses that have a receipt with the receipt's filename
     */
    private array function getWithReceipt(
        required date startDate,
        required date endDate,
        required numeric userid
    ) {
        return q
            .from("expense")
            .where("expense.userid", "=", userid)
            .andWhereBetween(
                "expense.date",
                {value: startDate, cfsqltype: "date"},
                {value: endDate, cfsqltype: "date"}
            )
            .andWhereNotNull("expense.receipt")
            .select([
                "expense.id",
                "expense.receipt",
                "expense.date",
                "expense.description"
            ])
            .get();
    }

    /**
     * Export receipt images between the startdate, enddate range
     * for the supplied user in a zip file
     */
    public string function receiptExport(
        required date startDate,
        required date endDate,
        required numeric userid,
        required string userDir
    ) {
        // Get all expenses with receipt in date range
        var expensesWithReceipt = getWithReceipt(
            startDate = startDate,
            endDate   = endDate,
            userid    = userid
        );

        // No receipts
        if(!expensesWithReceipt.len()) {
            throw(message = "No Receipts found within date range.", type = "NoReceiptsFound");
        }

        // Over 100 receipts, too large
        if(expensesWithReceipt.len() > 100) {
            throw(
                message = "Too many receipts within date range. Maximum of 100 allowed per export.",
                type    = "TooManyReceipts"
            );
        }

        // Only receipts whose file is still on disk - a missing file would fail the whole zip
        var receipts = expensesWithReceipt.filter((expense) => {
            return fileExists(getReceiptPath(receipt = expense.receipt, userDir = userDir));
        });

        if(!receipts.len()) {
            throw(message = "No Receipts found within date range.", type = "NoReceiptsFound");
        }

        // Unique per export, so two exports of the same range never write the same file
        var filePath = getTempDirectory() & "receipts_#userid#_#lCase(createUUID())#.zip";

        // Attempt to create zip file
        try {
            cfzip(
                action    = "zip",
                file      = filePath,
                overwrite = true
            ) {
                receipts.each((expense) => {
                    var safeDesc = reReplace(expense.description, "[\\/:*?""<>|]", "_", "all");

                    // The expense id keeps names unique - subscription charges share a date and description
                    var fileName = "#dateFormat(expense.date, "yyyy-mm-dd")#_#left(safeDesc, 50)#_#expense.id#.webp";
                    cfzipparam(
                        source    = getReceiptPath(receipt = expense.receipt, userDir = userDir),
                        entryPath = fileName
                    );
                });
            }
        }
        catch(any e) {
            throw(message = "Error aggregating receipts. Please try again later.", type = "ZipError")
        }

        return filePath;
    }

    /**
     * Upload a multi-part for containing a receipt image in the form field
     * Validates the image, orients it upright, and converts to a resized webp in a single pass
     *
     * @formField The multipart form field
     * @userDir   The user's upload directory
     *
     * @return The UUID of the converted image
     */
    public string function receiptUpload(required string formField, required string userDir) {
        // Keep extensions and maxFileSize in sync with frontend
        return imageService.validateUpload(
            formField   = formField,
            outputs     = [{uploadDir: userDir, type: "webp"}],
            extensions  = "png,jpg,jpeg,webp,heic",
            maxFileSize = 10 * 1024 * 1024, // 10mb
            autoOrient  = true,
            quality     = 50,
            resize      = 750
        );
    }

}
