import { useReducer } from 'react';
import type { ExpenseDataRow } from 'types/Expense.type';
import type { ErrorField } from 'validators/validateExpenseRow';
import type { ErroredExpense } from 'types/BulkImport.type';

export interface BulkImportState {
    loading: boolean; // loading CSV data
    saving: boolean; // saving refined data
    loadedExpenses: Record<string, ExpenseDataRow>; // loaded expenses from CSV
    rowOrder: string[]; // array of row uuids, this parent object will force re-render of child rows
    showImportDialog: boolean;
    errors: Record<string, ErrorField[]>; // map rowid to errors
    importErrors: ErroredExpense[];
}

export type BulkImportAction =
    | { type: 'SET_LOADING'; payload: boolean }
    | { type: 'SET_SAVING'; payload: boolean }
    | { type: 'SET_SHOWIMPORTDIALOG'; payload: boolean }
    | { type: 'SET_ERRORS'; payload: Record<string, ErrorField[]> }
    | { type: 'SET_LOADEDEXPENSES'; payload: Record<string, ExpenseDataRow> }
    | { type: 'SET_ROWORDER'; payload: string[] }
    | { type: 'DELETE_ROW'; id: string }
    | { type: 'SET_IMPORTERRORS'; payload: ErroredExpense[] }
    | { type: 'CLEAR_IMPORTERRORS' };

/**
 * Reducer to manage the various state of bulk importing
 */
function reducer(state: BulkImportState, action: BulkImportAction): BulkImportState {
    switch (action.type) {
        case 'SET_LOADING':
            return { ...state, loading: action.payload };
        case 'SET_SAVING':
            return { ...state, saving: action.payload };
        case 'SET_LOADEDEXPENSES':
            return { ...state, loadedExpenses: action.payload };
        case 'SET_ERRORS':
            return { ...state, errors: action.payload };
        case 'SET_SHOWIMPORTDIALOG':
            return { ...state, showImportDialog: action.payload };
        case 'SET_ROWORDER':
            return { ...state, rowOrder: action.payload };
        case 'DELETE_ROW':
            return {
                ...state,
                rowOrder: state.rowOrder.filter((id: string) => id !== action.id),
            };
        case 'SET_IMPORTERRORS':
            return { ...state, importErrors: action.payload };
        case 'CLEAR_IMPORTERRORS':
            return { ...state, importErrors: [] };
        default:
            return state;
    }
}

export function useBulkImportReducer() {
    const [state, dispatch] = useReducer(reducer, {
        loading: false,
        saving: false,
        loadedExpenses: {},
        rowOrder: [],
        showImportDialog: false,
        errors: {},
        importErrors: [],
    });

    return { state, dispatch };
}
