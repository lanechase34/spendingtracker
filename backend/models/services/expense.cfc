component singleton accessors="true" {

    property name="async"              inject="asyncManager@coldbox";
    property name="cacheStorage"       inject="cachebox:coldboxStorage";
    property name="q"                  inject="provider:QueryBuilder@qb";
    property name="securityService"    inject="services.security";
    property name="spreadsheetService" inject="Spreadsheet@spreadsheet-cfml";
    property name="validationManager"  inject="ValidationManager@cbvalidation";

    /**
     * Expense Import CSV format
     */
    property name="headers" type="array";
    function init() {
        setHeaders(['Date', 'Amount', 'Description']);
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
        required string search   = '',
        required string orderCol = '',
        required string orderDir = ''
    ) {
        /**
         * Base Query
         */
        var base = q
            .from('expense')
            .join(
                'category',
                'expense.categoryid',
                '=',
                'category.id'
            )
            .where('expense.userid', '=', userid)
            .andWhereBetween(
                'expense.date',
                {value: startDate, cfsqltype: 'date'},
                {value: endDate, cfsqltype: 'date'}
            )
            .andWhere((q1) => {
                q1.whereLike(q.raw('lower(expense.description)'), {value: '%#lCase(search)#%', cfsqltype: 'varchar'})
                    .orWhereLike(q.raw('lower(category.name)'), {value: '%#lCase(search)#%', cfsqltype: 'varchar'})
                    .when(
                        condition = isDate(search),
                        onTrue    = (q2) => {
                            q2.orWhere(
                                'expense.date',
                                '=',
                                {value: search, cfsqltype: 'date'}
                            );
                        },
                        withoutScoping = true
                    );
            });

        /**
         * Calculated the filtered total expense sum and the number of records
         */
        var filtered        = base.select(['expense.id', 'expense.amount']).get();
        var filteredRecords = filtered.len();

        /**
         * Perform total info query and data query in parallel
         */
        var offset           = (page - 1) * records;
        var asyncFilteredSum = async.newFuture(() => {
            var curr = 0;
            filtered.each((record) => {
                curr += securityService.decryptValue(record.amount, 'numeric');
            });
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
            return base
                .when(
                    orderCol.len() && orderDir.len(),
                    (q1) => {
                        q1.orderBy(orderCol, orderDir);
                    },
                    (q1) => {
                        q1.orderBy('expense.date', 'desc');
                    }
                )
                .limit(records)
                .offset(offset)
                .select([
                    'expense.id',
                    'expense.date',
                    'expense.amount',
                    'expense.description',
                    'category.name as category'
                ])
                .selectRaw('expense.receipt is not null as receipt')
                .get()
                .each(
                    (value) => {
                        // lucee? pulls 'date' column back as 'timestamp' -> format to remove any timestamp identifier
                        value.date   = dateFormat(value.date, 'yyyy-mm-dd');
                        value.amount = securityService.intToFloat(securityService.decryptValue(value.amount, 'numeric'));
                    },
                    true,
                    50
                );
        });

        var results = async
            .newFuture()
            .all(asyncFilteredSum, asyncTotalInfo, asyncData)
            .get();

        var filteredSum = results[1];
        var totalInfo   = results[2];
        var data        = results[3];

        // If sorting by amount, sort the decrypted data
        if(orderCol == 'expense.amount' && orderDir.len()) {
            data.sort((a, b) => {
                return orderDir == 'asc' ? compare(a.amount, b.amount) : compare(b.amount, a.amount);
            });
        }

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
        var cacheKey = 'userid=#userid#|expense.getTotalInfo|startDate=#startDate#|endDate=#endDate#';
        var total    = cacheStorage.get(cacheKey);
        if(isNull(total)) {
            var result = queryExecute(
                '
                select amount
                from expense
                where userid = :userid
                and date between :startDate and :endDate
                ',
                {
                    userid   : {value: userid, cfsqltype: 'numeric'},
                    startDate: {value: startDate, cfsqltype: 'date'},
                    endDate  : {value: endDate, cfsqltype: 'date'}
                }
            );

            // Decrypt and sum amounts
            var totalAmount = 0;
            result.each((row) => {
                totalAmount += securityService.decryptValue(row.amount, 'numeric');
            });

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
            date       : {value: date, cfsqltype: 'date'},
            amount     : {value: securityService.encryptValue(amount), cfsqltype: 'varchar'},
            description: {value: description, cfsqltype: 'varchar'},
            categoryid : {value: categoryid, cfsqltype: 'numeric'},
            receipt    : receipt,
            userid     : {value: userid, cfsqltype: 'numeric'}
        };

        if(subscriptionid > 0) {
            data.subscriptionid = {value: subscriptionid, cfsqltype: 'numeric'};
        }

        q.from('expense').insert(data);

        // Clear user expense cache
        cacheStorage.clearByKeySnippet(keySnippet = 'userid=#userid#|expense');
        cacheStorage.clearByKeySnippet(keySnippet = 'userid=#userid#|widget');
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
            .from('expense')
            .where('id', '=', {value: id, cfsqltype: 'numeric'})
            .andWhere(
                'userid',
                '=',
                {value: userid, cfsqltype: 'numeric'}
            )
            .delete();

        var success = qResult.result.recordCount == 1;

        if(success) {
            // If this expense had a receipt and was not charged by a subscription, delete it
            if(
                qResult.result.keyExists('receipt')
                && qResult.result.receipt.len()
                && !qResult.result.keyExists('subscriptionid')
            ) {
                fileDelete(getReceiptPath(receipt = qResult.result.receipt, userDir = userDir));
            }

            // Clear user expense cache
            cacheStorage.clearByKeySnippet(keySnippet = 'userid=#userid#|expense');
            cacheStorage.clearByKeySnippet(keySnippet = 'userid=#userid#|widget');
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
            .from('expense')
            .where('id', '=', {value: id, cfsqltype: 'numeric'})
            .andWhere(
                'userid',
                '=',
                {value: userid, cfsqltype: 'numeric'}
            )
            .select(['receipt'])
            .first();

        // Make sure record and file exists
        if(
            !receiptRecord.keyExists('receipt') || !receiptRecord.receipt.len() || !fileExists(
                getReceiptPath(receipt = receiptRecord.receipt, userDir = userDir)
            )
        ) {
            return return404 ? '#application.cbController.getSetting('uploadPath')#/404.webp' : '';
        }

        return getReceiptPath(receipt = receiptRecord.receipt, userDir = userDir);
    }

    /**
     * Gets the absolute path of receipt supplied in the userdir
     */
    private string function getReceiptPath(required string receipt, required string userDir) {
        return '#userDir#/#receipt#.webp';
    }

    /**
     * Process an expense file imported by user
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
            message: '',
            data   : [],
            errors : []
        };

        // Attempt to import the file
        try {
            var import = spreadsheetService
                .readCsv(expenseFile)
                .intoAnArray()
                .withFirstRowIsHeader()
                .withAllowMissingColumnNames(false)
                .withDelimiter(',')
                .execute();
        }
        catch(any e) {
            result.valid   = false;
            result.message = 'Error loading file. Please use the template provided';
        }

        if(!result.valid) return result;

        // Check column headers
        var columns = import.columns;
        for(var i = 1; i <= getHeaders().len(); i++) {
            if(arrayLen(columns) < getHeaders().len() || getHeaders()[i] != columns[i]) {
                result.valid   = false;
                result.message = 'Please verify columns match exactly: #getHeaders().toList(', ')#';
                break;
            }
        }

        if(!result.valid) return result;

        // Import the data and verify the types for each
        import.data.each((row, index) => {
            try {
                var rowData = {
                    date       : row[1],
                    amount     : row[2],
                    description: row[3]
                };

                /**
                 * Validate each row
                 */
                var validation = validationManager.validate(target = rowData, constraints = 'expenseDataRow');
                if(!validation.hasErrors()) {
                    rowData.amount = parseNumber(rowData.amount); // Safely parse amount as number after validating
                    result.data.append(rowData);
                }
                else {
                    // +1 for header row
                    result.errors.append({row: index + 1, message: validation.getAllErrors().toList('; ')});
                }
            }
            catch(any e) {
            }
        });

        return result;
    }

}
