import Box from '@mui/material/Box';
import ButtonGroup from '@mui/material/ButtonGroup';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import InputAdornment from '@mui/material/InputAdornment';
import OutlinedInput from '@mui/material/OutlinedInput';
import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import DeleteButton from 'components/DeleteButton';
import LazyDatePicker from 'components/LazyDatePicker';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import type { ChangeEvent } from 'react';
import { memo, useState } from 'react';
import type { ExpenseDataRow } from 'types/Expense.type';
import type { SelectOptionType } from 'types/SelectOption.type';
import { maxFileSize, validExtensions, validMimeTypes } from 'utils/receiptDefaults';
import type { ErrorField } from 'validators/validateExpenseRow';
import { getErrorFor } from 'validators/validateExpenseRow';
import { validateFile } from 'validators/validateFile';

import CategorySelect from './CategorySelect';
import ReceiptUpload from './ReceiptUpload';

interface BulkImportRowProps {
    row: ExpenseDataRow;
    rowId: string;
    onRowChange: (id: string, updatedRow: ExpenseDataRow) => void;
    onDelete: (rowId: string | number) => void;
    error: ErrorField[];
}

/**
 * Table row in the BulkImport Dialog
 */
function BulkImportRow({ row, rowId, onRowChange, onDelete, error }: BulkImportRowProps) {
    // Local state to prevent re-renders
    const [localRow, setLocalRow] = useState<ExpenseDataRow>(row);

    /**
     * Update local state and parent's ref
     */
    const updateCell = (field: string, value: string | number | Date | null) => {
        setLocalRow((prev: ExpenseDataRow) => {
            const updatedRow = { ...prev, [field]: value };

            onRowChange(rowId, updatedRow);
            return updatedRow;
        });
    };

    const updateCategory = (value: string | number | null) => {
        setLocalRow((prev: ExpenseDataRow) => {
            const updatedRow = { ...prev };
            if (typeof value === 'number') {
                updatedRow.categoryid = value;
                updatedRow.category = null;
            } else {
                updatedRow.category = value;
                updatedRow.categoryid = null;
            }

            onRowChange(rowId, updatedRow);
            return updatedRow;
        });
    };

    const updateReceipt = (event: ChangeEvent<HTMLInputElement>) => {
        // Validate the file
        const file = event.target.files?.[0] ?? null;
        const { file: validated, error } = validateFile(file, validMimeTypes, maxFileSize);

        setLocalRow((prev: ExpenseDataRow) => {
            // Create new row object with updated receipt and error status
            const updatedRow = { ...prev, receipt: validated, receiptError: error };

            onRowChange(rowId, updatedRow);
            return updatedRow;
        });
    };

    const amountError = getErrorFor('amount', error);
    const descriptionError = getErrorFor('description', error);
    const categoryError = getErrorFor('category', error);
    return (
        <TableRow key={`expense_${rowId}`} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
            <TableCell>
                <LazyDatePicker
                    label=""
                    value={dayjs(localRow.date).isValid() ? dayjs(localRow.date) : null}
                    onChange={(newValue: Dayjs | null) => {
                        if (!newValue) return;
                        updateCell('date', newValue.format('MM/DD/YYYY'));
                    }}
                    minDate={dayjs().subtract(1, 'year')}
                    maxDate={dayjs().add(1, 'year')}
                />
            </TableCell>
            <TableCell>
                <FormControl variant="outlined" error={Boolean(amountError)} fullWidth>
                    <OutlinedInput
                        id={`expense_${rowId}_amount`}
                        startAdornment={<InputAdornment position="start">$</InputAdornment>}
                        fullWidth
                        required
                        value={localRow.amount ?? ''}
                        onChange={(e) => {
                            // Keep 0 so it fails as non-positive rather than as missing
                            const amount = parseFloat(e.target.value);
                            updateCell('amount', Number.isNaN(amount) ? null : amount);
                        }}
                        error={Boolean(amountError)}
                    />
                    {amountError && <FormHelperText>{amountError}</FormHelperText>}
                </FormControl>
            </TableCell>
            <TableCell>
                <TextField
                    id={`expense_${rowId}_description`}
                    variant="outlined"
                    required
                    fullWidth
                    value={localRow.description}
                    onChange={(e) => {
                        updateCell('description', e.target.value);
                    }}
                    error={Boolean(descriptionError)}
                    helperText={descriptionError}
                />
            </TableCell>
            <TableCell>
                <CategorySelect
                    handleCategorySelectChange={(_event, option: SelectOptionType | null) => {
                        updateCategory(option?.value ?? null);
                    }}
                    error={Boolean(categoryError)}
                    helperText={categoryError}
                />
            </TableCell>
            <TableCell align="center">
                <Box sx={{ display: 'flex', width: '100%' }}>
                    <ButtonGroup orientation="horizontal" variant="outlined" sx={{ width: '100%' }}>
                        <ReceiptUpload
                            selectedReceipt={localRow.receipt ?? null}
                            error={localRow.receiptError ?? null}
                            validExtensions={validExtensions}
                            handleReceiptChange={(e: ChangeEvent<HTMLInputElement>) => {
                                updateReceipt(e);
                            }}
                            variant="outlined"
                            textInline={true}
                        />

                        <DeleteButton rowId={rowId} onClick={onDelete} variant="outlined" />
                    </ButtonGroup>
                </Box>
            </TableCell>
        </TableRow>
    );
}

/**
 * Cache entire rendered output based on props
 * If props don't change (shallow comparison), cached value will be used
 */
export default memo(BulkImportRow);
