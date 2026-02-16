component extends="base" secured="User,Admin" {

    this.allowedMethods = {
        view       : 'GET',
        save       : 'POST',
        remove     : 'DELETE',
        viewReceipt: 'GET',
        import     : 'POST',
        bulkSave   : 'POST'
    };

    property name="categoryService" inject="services.category";
    property name="expenseService"  inject="services.expense";
    property name="imageService"    inject="services.image";

    /**
     * Paginated view for expenses
     *
     * @rc.startDate get expenses in range from start - end
     * @rc.endDate   end                                     
     * @rc.page      page num
     * @rc.records   total records to return
     * @rc.search    (optional) search param
     * @rc.orderCol  (optional) which col to order
     * @rc.orderDir  (optional) order direction
     */
    function view(event, rc, prc) {
        prc.data = expenseService.paginate(
            startDate = rc.startDate,
            endDate   = rc.endDate,
            userid    = prc.userid,
            page      = rc.page,
            records   = rc.records,
            search    = rc?.search ?: '',
            orderCol  = rc?.orderCol ?: '',
            orderDir  = rc?.orderDir ?: ''
        );

        event
            .getResponse()
            .setDataWithPagination(
                data          = prc.data,
                resultsKey    = 'results',
                paginationKey = 'pagination'
            )
            .setStatusCode(200);
    }

    /**
     * Saves a new expense 
     *
     * @rc.date        expense date
     * @rc.amount      dollar amount
     * @rc.description expense description
     * @rc.categoryid  (required if category empty) the pk of category record
     * @rc.category    (required if categoryid empty) the name for a new category
     * @rc.receipt     (optional) image upload
     * @prc.receipt    (transformed from rc.receipt) valid receipt name or empty string
     */
    function save(event, rc, prc) {
        // Create category if needed
        prc.categoryid = (rc.keyExists('categoryid') && isNumeric(rc.categoryid))
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
            .setMessages(['Successfully saved expense.'])
            .setStatusCode(200);
    }

    /**
     * Delete an expense
     *
     * @rc.id pk of expense
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
                .setMessages(['Successfully deleted expense.'])
                .setStatusCode(200);
        }
        else {
            event
                .getResponse()
                .setErrorMessage('Not found.')
                .setStatusCode(404);
        }
    }

    /**
     * View an expense's receipt
     *
     * @rc.id pk of expense
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
                mimeType    = 'image/webp',
                disposition = 'inline'
            )
            .noRender();
    }

    /**
     * Import a user csv file containing Expense data
     * Format of [Date, Amount, Description]
     *
     * @rc.expenseFile csv file
     */
    function import(event, rc, prc) {
        prc.result = expenseService.processExpenseData(rc?.expenseFile ?: '');
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
     * @rc.expenses array of expenses [{date, amount, description, categoryid|category, receipt?}]
     */
    function bulkSave(event, rc, prc) {
        // The expenses object is a json string of array of expense rows
        if(!rc.keyExists('expenses') || !isJSON(rc.expenses)) {
            event
                .getResponse()
                .setErrorMessage('Invalid Parameters.')
                .setStatusCode(400);
        }

        rc.expenses    = deserializeJSON(rc.expenses);
        prc.validation = validate(target = rc, constraints = 'expense.bulksavehandler');
        if(prc.validation.hasErrors()) {
            event
                .getResponse()
                .setErrorMessage('Invalid Parameters. #prc.validation.getAllErrors().toList('; ')#')
                .setStatusCode(400);
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
                    var currCategoryId = '';
                    var currReceipt    = '';

                    // Check if receipt exists
                    if(rc.keyExists('receipt_#expense.id#')) {
                        currReceipt = imageService.validateUpload(
                            formField       = 'receipt_#expense.id#', // dynamic form field generated
                            uploadDirectory = prc.userDir
                        );
                        if(!currReceipt.len()) {
                            errors['expense_#expense.id#'] = 'Invalid receipt upload.';
                            continue;
                        }
                    }

                    // Category ID
                    if(expense.keyExists('categoryid') && isNumeric(expense.categoryid)) {
                        currCategoryId = parseNumber(expense.categoryid);
                    }
                    // New Category, but already created
                    else if(categoryMap.keyExists('#ucFirst(expense.category)#')) {
                        currCategoryId = categoryMap['#ucFirst(expense.category)#'];
                    }
                    // New Category
                    else {
                        // Create the new category
                        currCategoryId = categoryService.save(name = ucFirst(expense.category), userid = prc.userid);

                        // Add to the map
                        categoryMap['#ucFirst(expense.category)#'] = currCategoryId;
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
                },
                true,
                getSetting('maxThreads')
            );

            event
                .getResponse()
                .setData(errors)
                .setMessages([errors.count() ? 'Error saving expenses' : 'Successfully saved expenses'])
                .setStatusCode(errors.count() ? 400 : 200);
        }
    }

    /**
     * Export all expense data within the date range to a csv file
     *
     * @rc.startDate get expenses in range from start - end
     * @rc.endDate   end   
     */
    function export(event, rc, prc) {
        prc.csvString = expenseService.csvExport(
            startDate = rc.startDate,
            endDate   = rc.endDate,
            userid    = prc.userid
        );

        prc.fileName = 'expenses_#dateFormat(rc.startDate, 'yyyy-mm-dd')#_to_#dateFormat(rc.endDate, 'yyyy-mm-dd')#.csv';

        event
            .renderData(
                type        = 'text',
                data        = prc.csvString,
                contentType = 'text/csv',
                encoding    = 'utf-8',
                statusCode  = 200,
                statusText  = 'OK'
            )
            .setHTTPHeader(name = 'Content-Disposition', value = 'attachment; filename="#prc.fileName#"');
    }

    /**
     * Export all receipts attached to expenses in date range to a zip file
     *
     * @rc.startDate get expenses in range from start - end
     * @rc.endDate   end   
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
                name        = 'receipts_#dateFormat(rc.startDate, 'yyyy-mm-dd')#_to_#dateFormat(rc.endDate, 'yyyy-mm-dd')#.zip',
                disposition = 'attachment',
                mimeType    = 'application/zip',
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
