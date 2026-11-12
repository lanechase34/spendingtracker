component extends="base" hint="Expense Endpoints" secured="User,Admin" {

    this.allowedMethods = {
        view          : "GET",
        save          : "POST",
        remove        : "DELETE",
        receipt       : "GET",
        importCsv     : "POST",
        bulkSave      : "POST",
        export        : "POST",
        exportReceipts: "POST"
    };

    property name="categoryService" inject="services.category";
    property name="expenseService"  inject="services.expense";

    /**
     * Paginated view for expenses
     *
     * @summary         List Expenses
     * @tags            Expense
     * @security        ApiKeyAuth
     * @hint            Returns a paginated list of expenses, optionally filtered by date range, search, and ordering.
     * @param-startDate { "name": "startDate", "in": "query", "required": true,  "schema": { "type": "string", "format": "date", "example": "2025-01-01" } }
     * @param-endDate   { "name": "endDate", "in": "query", "required": true,  "schema": { "type": "string", "format": "date", "example": "2025-12-31" }, "description": "Must be on or after startDate and at most 365 days after it." }
     * @param-page      { "in": "query", "required": true,  "schema": { "type": "integer", "minimum": 1, "example": 1 } }
     * @param-records   { "in": "query", "required": true,  "schema": { "type": "integer", "minimum": 10, "maximum": 100, "example": 25 } }
     * @param-search    { "in": "query", "required": false, "schema": { "type": "string", "maxLength": 50 } }
     * @param-orderCol  { "name": "orderCol", "in": "query", "required": false, "schema": { "type": "string", "enum": ["date","amount","description","category"] } }
     * @param-orderDir  { "name": "orderDir", "in": "query", "required": false, "schema": { "type": "string", "enum": ["asc","desc"] } }
     * @response-200    ~expense/view/response.json
     * @response-400    ~errors/400.json
     * @response-401    ~errors/401.json
     */
    function view(event, rc, prc) {
        prc.data = expenseService.paginate(
            startDate = rc.startDate,
            endDate   = rc.endDate,
            userid    = prc.userid,
            page      = rc.page,
            records   = rc.records,
            search    = rc?.search ?: "",
            orderCol  = rc?.orderCol ?: "",
            orderDir  = rc?.orderDir ?: ""
        );

        event
            .getResponse()
            .setDataWithPagination(
                data          = prc.data,
                resultsKey    = "results",
                paginationKey = "pagination"
            )
            .setStatusCode(200);
    }

    /**
     * Save a new expense
     *
     * @summary      Save Expense
     * @tags         Expense
     * @security     [ { "ApiKeyAuth": [], "CSRFToken": [] } ]
     * @hint         Creates a new expense record. Provide either categoryid for an existing category or category name to create a new one. Optionally attach a receipt image.
     * @requestBody  ~expense/save/requestBody.json
     * @response-200 ~expense/save/response.json
     * @response-400 ~errors/400.json
     * @response-401 ~errors/401.json
     * @response-415 { "description": "Invalid receipt upload." }
     */
    function save(event, rc, prc) {
        // Create category if needed
        prc.categoryid = (rc.keyExists("categoryid") && isNumeric(rc.categoryid))
         ? parseNumber(rc.categoryid)
         : categoryService.save(name = ucFirst(rc.category), userid = prc.userid);

        expenseService.save(
            date        = rc.date,
            amount      = rc.amount,
            description = rc.description,
            categoryid  = prc.categoryid,
            receipt     = prc.receipt,
            userid      = prc.userid
        );

        event
            .getResponse()
            .setMessages(["Successfully saved expense."])
            .setStatusCode(200);
    }

    /**
     * Delete an expense
     *
     * @summary      Delete Expense
     * @tags         Expense
     * @security     [ { "ApiKeyAuth": [], "CSRFToken": [] } ]
     * @hint         Deletes an expense record and its associated receipt if one exists.
     * @param-id     { "in": "path", "required": true, "schema": { "type": "integer", "minimum": 1, "example": 42 } }
     * @response-200 ~expense/remove/response.json
     * @response-401 ~errors/401.json
     * @response-404 { "description": "Expense not found." }
     */
    function remove(event, rc, prc) {
        prc.success = expenseService.delete(
            id      = rc.id,
            userDir = prc.userDir,
            userid  = prc.userid
        );

        if(prc.success) {
            event
                .getResponse()
                .setMessages(["Successfully deleted expense."])
                .setStatusCode(200);
        }
        else {
            event
                .getResponse()
                .setErrorMessage("Not found.")
                .setStatusCode(404);
        }
    }

    /**
     * View an expense receipt
     *
     * @summary      Get Receipt
     * @tags         Expense
     * @security     ApiKeyAuth
     * @hint         Returns the receipt image attached to an expense as an inline webp image.
     * @param-id     { "in": "path", "required": true, "schema": { "type": "integer", "minimum": 1, "example": 42 } }
     * @response-200 { "description": "Receipt image returned inline.", "content": { "image/webp": { "schema": { "type": "string", "format": "binary" } } } }
     * @response-401 ~errors/401.json
     * @response-404 { "description": "Receipt not found." }
     */
    function receipt(event, rc, prc) {
        prc.receipt = expenseService.getReceipt(
            id      = rc.id,
            userDir = prc.userDir,
            userid  = prc.userid
        );

        event
            .sendFile(
                file        = prc.receipt,
                mimeType    = "image/webp",
                disposition = "inline"
            )
            .noRender();
    }

    /**
     * Parse and validate expenses from a CSV file
     *
     * @summary      Import Expenses
     * @tags         Expense
     * @security     [ { "ApiKeyAuth": [], "CSRFToken": [] } ]
     * @hint         Parses and validates a CSV file of expenses. Nothing is saved - valid rows are returned for review, then saved with Bulk Save Expenses. The header row must be exactly Date,Amount,Description, with at most 200 data rows. Each row follows the Save Expense rules for date, amount, and description.
     * @requestBody  ~expense/import/requestBody.json
     * @response-200 ~expense/import/response.json
     * @response-400 { "description": "No .csv file uploaded in the expenseFile multipart field, file larger than 5 MB or not readable as CSV, header row does not match Date,Amount,Description exactly, or more than 200 data rows." }
     * @response-401 ~errors/401.json
     */
    function importCsv(event, rc, prc) {
        prc.result = expenseService.importUpload(formField = "expenseFile");
        if(!prc.result.valid) {
            event
                .getResponse()
                .setErrorMessage(prc.result.message)
                .setStatusCode(400);
        }
        else {
            event
                .getResponse()
                .setData({imported: prc.result.data, errored: prc.result.errors})
                .setStatusCode(200);
        }
    }

    /**
     * Bulk save an array of expenses
     *
     * @summary      Bulk Save Expenses
     * @tags         Expense
     * @security     [ { "ApiKeyAuth": [], "CSRFToken": [] } ]
     * @hint         Saves multiple expenses in a single request. Each expense must include id, date, amount, description, and either categoryid or category. Each expense can upload a receipt in a form field named receipt_{id}. Rows whose receipt is invalid are skipped and reported. The other rows are still saved.
     * @requestBody  ~expense/bulkSave/requestBody.json
     * @response-200 ~expense/bulkSave/response.json
     * @response-400 ~expense/bulkSave/response.400.json
     * @response-401 ~errors/401.json
     */
    function bulkSave(event, rc, prc) {
        // The expenses object is a json string of array of expense rows
        if(!rc.keyExists("expenses") || !isJSON(rc.expenses)) {
            event
                .getResponse()
                .setErrorMessage("Invalid Parameters.")
                .setStatusCode(400);
            return;
        }

        rc.expenses = deserializeJSON(rc.expenses);

        // Rows come from an import, so bulk save takes no more rows than an import can return
        if(!isArray(rc.expenses) || !rc.expenses.len()) {
            event
                .getResponse()
                .setErrorMessage("Invalid Parameters.")
                .setStatusCode(400);
            return;
        }
        if(rc.expenses.len() > expenseService.getMaxRows()) {
            event
                .getResponse()
                .setErrorMessage("Too many expenses. Please limit to a maximum of #expenseService.getMaxRows()# rows")
                .setStatusCode(400);
            return;
        }

        prc.validation = validate(target = rc, constraints = "expense.bulksavehandler");
        if(prc.validation.hasErrors()) {
            event
                .getResponse()
                .setErrorMessage("Invalid Parameters. #prc.validation.getAllErrors().toList("; ")#")
                .setStatusCode(400);
            return;
        }
        else {
            var categoryMap = {};
            var errors      = {};

            /**
             * Loop over expenses, keep track of new categories we make because we could have multiple of the 
             * same category being requested
             *
             * Validate each expense's receipt - keep track of all errors (map array index -> error)
             */
            rc.expenses.each(
                (expense) => {
                    var currCategoryId = "";
                    var currReceipt    = "";

                    // Check if receipt exists
                    if(rc.keyExists("receipt_#expense.id#")) {
                        try {
                            currReceipt = expenseService.receiptUpload(
                                formField = "receipt_#expense.id#", // dynamic form field generated
                                userDir   = prc.userDir
                            );
                        }
                        catch(any e) {
                            // silence any errors
                        }

                        if(!currReceipt.len()) {
                            errors["expense_#expense.id#"] = "Invalid receipt upload.";
                            continue;
                        }
                    }

                    // From here on a failure leaves the uploaded receipt unreferenced
                    try {
                        // Category ID
                        if(expense.keyExists("categoryid") && isNumeric(expense.categoryid)) {
                            currCategoryId = parseNumber(expense.categoryid);
                        }
                        // New Category
                        else {
                            // Lock so we don't double create the category
                            var safeCategory = ucFirst(lCase(expense.category));

                            lock name="categoryMap_#safeCategory#_#prc.userid#" type="exclusive" timeout="10" {
                                // Not yet created
                                if(!categoryMap.keyExists(safeCategory)) {
                                    // Create the new category
                                    currCategoryId            = categoryService.save(name = safeCategory, userid = prc.userid);
                                    categoryMap[safeCategory] = currCategoryId;
                                }
                                // Already created
                                else {
                                    currCategoryId = categoryMap[safeCategory];
                                }
                            }
                        }

                        // Save
                        expenseService.save(
                            date        = expense.date,
                            amount      = expense.amount,
                            description = expense.description,
                            categoryid  = currCategoryId,
                            receipt     = currReceipt,
                            userid      = prc.userid
                        );
                    }
                    catch(any e) {
                        // The row never saved, so nothing references its receipt - don't leave it on disk
                        expenseService.deleteReceiptIfUnused(
                            receipt = currReceipt,
                            userid  = prc.userid,
                            userDir = prc.userDir
                        );
                        rethrow;
                    }
                },
                true,
                getSetting("maxThreads")
            );

            event
                .getResponse()
                .setData(errors)
                .setMessages([errors.count() ? "Error saving expenses" : "Successfully saved expenses"])
                .setStatusCode(errors.count() ? 400 : 200)
                .setError(errors.count());
        }
    }

    /**
     * Export expenses to a CSV file
     *
     * @summary      Export Expenses
     * @tags         Expense
     * @security     [ { "ApiKeyAuth": [], "CSRFToken": [] } ]
     * @hint         Exports all expenses within the given date range as a downloadable CSV file with date, amount, description, and category columns. Limited to one export per minute.
     * @requestBody  ~expense/export/requestBody.json
     * @response-200 { "description": "CSV file download, sent as an attachment named expenses_{startDate}_to_{endDate}.csv.", "content": { "text/csv": { "schema": { "type": "string", "format": "binary" } } } }
     * @response-400 ~errors/400.json
     * @response-401 ~errors/401.json
     * @response-429 ~errors/429.json
     */
    function export(event, rc, prc) {
        prc.csvString = expenseService.csvExport(
            startDate = rc.startDate,
            endDate   = rc.endDate,
            userid    = prc.userid
        );

        prc.fileName = "expenses_#dateFormat(rc.startDate, "yyyy-mm-dd")#_to_#dateFormat(rc.endDate, "yyyy-mm-dd")#.csv";

        event
            .renderData(
                type        = "text",
                data        = prc.csvString,
                contentType = "text/csv",
                encoding    = "utf-8",
                statusCode  = 200,
                statusText  = "OK"
            )
            .setHTTPHeader(name = "Content-Disposition", value = "attachment; filename=""#prc.fileName#""");
    }

    /**
     * Export receipts to a ZIP file
     *
     * @summary      Export Receipts
     * @tags         Expense
     * @security     [ { "ApiKeyAuth": [], "CSRFToken": [] } ]
     * @hint         Exports all receipts attached to expenses within the given date range as a downloadable ZIP file. Limited to one export every 3 minutes.
     * @requestBody  ~expense/exportReceipts/requestBody.json
     * @response-200 { "description": "ZIP file download containing all receipts in the date range, sent as an attachment named receipts_{startDate}_to_{endDate}.zip.", "content": { "application/zip": { "schema": { "type": "string", "format": "binary" } } } }
     * @response-400 { "description": "Validation failed, or too many receipts to export at once." }
     * @response-401 ~errors/401.json
     * @response-404 { "description": "No receipts found in the given date range." }
     * @response-429 ~errors/429.json
     */
    function exportReceipts(event, rc, prc) {
        try {
            prc.filePath = expenseService.receiptExport(
                startDate = rc.startDate,
                endDate   = rc.endDate,
                userid    = prc.userid,
                userdir   = prc.userDir
            );

            event.sendFile(
                file        = prc.filePath,
                name        = "receipts_#dateFormat(rc.startDate, "yyyy-mm-dd")#_to_#dateFormat(rc.endDate, "yyyy-mm-dd")#.zip",
                disposition = "attachment",
                mimeType    = "application/zip",
                deleteFile  = true
            );
        }
        catch(NoReceiptsFound e) {
            event
                .getResponse()
                .setErrorMessage(e.message)
                .setStatusCode(404);
        }
        catch(TooManyReceipts e) {
            event
                .getResponse()
                .setErrorMessage(e.message)
                .setStatusCode(400);
        }
        catch(ZipError e) {
            rethrow; // rethrow error to log bug
        }
    }

}
