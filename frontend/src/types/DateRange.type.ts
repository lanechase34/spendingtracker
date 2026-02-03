// Union type of string literals
// These are valid 'quick' date ranges to be selected
export type DateRangeType =
    | 'this-week'
    | 'last-week'
    | 'this-month'
    | 'last-month'
    | 'this-year'
    | 'last-year'
    | 'custom';
