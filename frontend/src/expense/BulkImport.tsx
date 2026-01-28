import BulkImportControls from './BulkImportControls';
import BulkImportDialog from './BulkImportDialog';
import { useBulkImportReducer } from 'reducers/useBulkImport';
import useToastContext from 'hooks/useToastContext';
import useFileUpload from 'hooks/useFileUpload';
import useAuthFetch from 'hooks/useAuthFetch';
import { useCallback, useRef } from 'react';
import type { ExpenseDataRow } from 'types/Expense.type';
import useExpenseContext from 'hooks/useExpenseContext';
import { validateExpenseRow } from 'validators/validateExpenseRow';
import type { ErrorField } from 'validators/validateExpenseRow';
import { clearCategoryCache } from 'utils/categoryCache';
import { ImportResponseSchema } from 'types/BulkImport.type';
import type { ImportedExpense } from 'types/BulkImport.type';
import { useInvalidateWidgets } from 'hooks/useInvalidateWidgets';

/**
 * Bulk Import widget to process CSV file upload
 * And show table style form for refinement of data and submitting
 */
export default function BulkImport() {
    /**
     * State is managed in reducer
     */
    const { state, dispatch } = useBulkImportReducer();

    const authFetch = useAuthFetch();
    const { showToast } = useToastContext();
    const { refetch: refetchExpenses } = useExpenseContext();
    const invalidateWidgets = useInvalidateWidgets();

    /**
     * Collect edits user makes here but this does not re-render rows
     * Map row uuid -> expense row data
     */
    const editedExpensesRef = useRef<Record<string, ExpenseDataRow>>({});

    /**
     * CSV Upload Field
     */
    const csvUpload = useFileUpload({
        validMimeTypes: ['text/csv'],
        maxFileSize: 50 * 1024 * 1024,
    });

    const { reset: resetUpload } = csvUpload;

    /**
     * Submit CSV for processing
     */
    const handleProcessCsv = async () => {
        if (state.loading || !csvUpload.value) return;

        dispatch({ type: 'SET_LOADING', payload: true });
        dispatch({ type: 'SET_SHOWIMPORTDIALOG', payload: true });

        const formData = new FormData();
        formData.append('expenseFile', csvUpload.value);

        try {
            const response = await authFetch({
                url: '/spendingtracker/api/v1/expenses/import',
                method: 'POST',
                body: formData,
            });
            if (!response) return;

            const rawJson: unknown = await response.json();

            // Validate response
            const valid = ImportResponseSchema.safeParse(rawJson);
            if (!valid.success || valid.data.error) {
                const messages = valid.data?.messages ?? ['Server Error. Please try again.'];
                throw new Error(messages[0]);
            }

            const result = valid.data;

            // Add a UUID for each valid row
            const processedExpenses = result.data.imported;
            const expensesWithUUID = processedExpenses.map((row: ImportedExpense) => ({
                ...row,
                date: row.date,
                id: crypto.randomUUID(),
            }));

            const map: Record<string, ExpenseDataRow> = {};
            const order: string[] = [];
            expensesWithUUID.forEach((row) => {
                map[row.id] = row;
                order.push(row.id);
            });

            editedExpensesRef.current = { ...map };

            dispatch({ type: 'SET_LOADEDEXPENSES', payload: map });
            dispatch({ type: 'SET_ROWORDER', payload: order });

            // Update any rows that errored
            const rowErrors = result.data.errored;
            dispatch({ type: 'SET_IMPORTERRORS', payload: rowErrors });
        } catch (err: unknown) {
            const errorInfo = err as { name?: string; message?: string };
            console.error('Network error:', err);
            showToast(errorInfo?.message ?? 'Server Error. Please try again.', 'error');
            dispatch({ type: 'SET_SHOWIMPORTDIALOG', payload: false });
        } finally {
            dispatch({ type: 'SET_LOADING', payload: false });
        }
    };

    /**
     * Clear all import errors
     */
    const handleClearImportErrors = useCallback(() => {
        dispatch({ type: 'CLEAR_IMPORTERRORS' });
    }, [dispatch]);

    /**
     * Bulk Dialog Actions
     */
    const resetDialog = useCallback(() => {
        // Close dialog
        dispatch({ type: 'SET_SHOWIMPORTDIALOG', payload: false });

        // Reset the form
        resetUpload();
        dispatch({ type: 'SET_LOADEDEXPENSES', payload: {} });
        dispatch({ type: 'SET_ROWORDER', payload: [] });
        dispatch({ type: 'SET_ERRORS', payload: {} });
    }, [dispatch, resetUpload]);

    // This callback MUST NOT depend on state, this solely uses the REF
    const handleRowChange = useCallback((rowId: string, updatedRow: ExpenseDataRow) => {
        editedExpensesRef.current[rowId] = updatedRow;
    }, []);

    const handleDelete = useCallback(
        (rowId: string | number) => {
            delete editedExpensesRef.current[rowId];
            dispatch({ type: 'DELETE_ROW', id: `${rowId}` });
        },
        [dispatch]
    );

    const handleClose = useCallback(() => resetDialog(), [resetDialog]);

    /**
     * Submit processed data to bulk endpoint
     */
    const handleBulkSave = async () => {
        if (state.saving || !Object.keys(editedExpensesRef.current).length) return;

        dispatch({ type: 'SET_SAVING', payload: true });

        /**
         * Validate each row
         */
        const allRows = Object.values(editedExpensesRef.current);
        const validationErrors: Record<string, ErrorField[]> = {};
        allRows.forEach((row: ExpenseDataRow) => {
            const rowErrors = validateExpenseRow(row);
            if (rowErrors.length > 0) {
                validationErrors[row.id!] = rowErrors;
            }
        });

        if (Object.keys(validationErrors).length > 0) {
            dispatch({ type: 'SET_ERRORS', payload: validationErrors });
            showToast(`${Object.keys(validationErrors).length} invalid rows. Please correct issues.`, 'error');
            dispatch({ type: 'SET_SAVING', payload: false });
            return;
        }

        /**
         * Build the data packet
         * Send expenses array as json string (without receipt data)
         * Send receipts as multi-part form data - each using array index for key
         */
        const formData = new FormData();
        formData.append(
            'expenses',
            JSON.stringify(
                allRows.map((row: ExpenseDataRow) => ({
                    ...row,
                    receipt: undefined, // remove receipt info
                    receiptError: undefined,
                }))
            )
        );
        allRows.forEach((row: ExpenseDataRow) => {
            if (row.receipt) {
                formData.append(`receipt_${row.id}`, row.receipt);
            }
        });

        try {
            const response = await authFetch({
                url: '/spendingtracker/api/v1/expenses/bulk',
                method: 'POST',
                body: formData,
            });

            if (!response) return;
            if (!response.ok) throw new Error('Server error');
            showToast('Expenses imported successfully!', 'success');

            dispatch({ type: 'SET_SAVING', payload: false });

            // Refetch expense list
            await refetchExpenses();

            // Refetch Widgets
            invalidateWidgets();

            // Flush category select cache
            clearCategoryCache();

            // Reset dialog
            resetDialog();
        } catch (err: unknown) {
            console.error('Network error:', err);
            showToast('Server Error. Some records failed to save. Please try again.', 'error');
            dispatch({ type: 'SET_SAVING', payload: false });
        }
    };

    return (
        <>
            <BulkImportControls
                csvFile={csvUpload.value}
                onCsvChange={csvUpload.handleChange}
                onProcess={handleProcessCsv}
            />
            <BulkImportDialog
                open={state.showImportDialog}
                loading={state.loading}
                saving={state.saving}
                rowOrder={state.rowOrder}
                loadedExpenses={state.loadedExpenses}
                importErrors={state.importErrors}
                clearImportErrors={handleClearImportErrors}
                onClose={handleClose}
                onBulkSave={handleBulkSave}
                onRowChange={handleRowChange}
                onDelete={handleDelete}
                errors={state.errors}
            />
        </>
    );
}
