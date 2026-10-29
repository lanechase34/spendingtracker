import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExceptionDetail from 'components/ExceptionDetail';

const exception = {
    exception: {
        type: 'expression',
        Message: 'Variable [AMOUNT] does not exist',
        StackTrace: 'lucee.runtime.exp.ExpressionException\n\tat handlers.expenses.save(expenses.cfc:42)',
        TagContext: [
            { template: '/app/handlers/expenses.cfc', line: 42, codePrintPlain: '41: var x = 1;\n42: return amount;' },
            { template: '/app/models/Expense.cfc', line: 7, codePrintPlain: '7: validate();' },
        ],
    },
    validationResult: ['amount is required', 'date is invalid'],
};

const blob = (value: unknown = exception) => JSON.stringify(value);

describe('<ExceptionDetail />', () => {
    describe('Parsing', () => {
        it.each([
            ['invalid JSON', '{not json'],
            ['an empty string', ''],
            ['a missing exception key', blob({ message: 'oops' })],
            ['a wrongly typed field', blob({ exception: { ...exception.exception, Message: 42 } })],
        ])('Should show a fallback for %s', (_label, value) => {
            render(<ExceptionDetail blob={value} />);

            expect(screen.getByText('Unable to parse exception details.')).toBeInTheDocument();
        });

        it('Should render an exception with only the required fields', () => {
            const { TagContext: _tags, ...minimal } = exception.exception;
            render(<ExceptionDetail blob={blob({ exception: minimal })} />);

            expect(screen.getByText('Variable [AMOUNT] does not exist')).toBeInTheDocument();
            expect(screen.queryByText('Validation Errors')).not.toBeInTheDocument();
        });
    });

    describe('Summary', () => {
        it('Should show the type and message', () => {
            render(<ExceptionDetail blob={blob()} />);

            expect(screen.getByText('Exception Details')).toBeInTheDocument();
            expect(screen.getByText('expression')).toBeInTheDocument();
            expect(screen.getByText('Variable [AMOUNT] does not exist')).toBeInTheDocument();
        });

        it('Should list each validation error', () => {
            render(<ExceptionDetail blob={blob()} />);

            expect(screen.getByText('Validation Errors')).toBeInTheDocument();
            expect(screen.getByText('- amount is required')).toBeInTheDocument();
            expect(screen.getByText('- date is invalid')).toBeInTheDocument();
        });

        it('Should hide the validation section when the list is empty', () => {
            render(<ExceptionDetail blob={blob({ ...exception, validationResult: [] })} />);

            expect(screen.queryByText('Validation Errors')).not.toBeInTheDocument();
        });
    });

    describe('Tabs', () => {
        it('Should show the stack trace by default', () => {
            render(<ExceptionDetail blob={blob()} />);

            expect(screen.getByRole('tab', { name: 'Stack Trace' })).toHaveAttribute('aria-selected', 'true');
            expect(screen.getByText(/at handlers\.expenses\.save/)).toBeInTheDocument();
        });

        it('Should list each template and line in the code context tab', async () => {
            const user = userEvent.setup();
            render(<ExceptionDetail blob={blob()} />);

            await user.click(screen.getByRole('tab', { name: 'Code Context' }));

            expect(screen.queryByText(/at handlers\.expenses\.save/)).not.toBeInTheDocument();
            const first = screen.getByRole('button', { name: '/app/handlers/expenses.cfc - line 42' });
            expect(screen.getByRole('button', { name: '/app/models/Expense.cfc - line 7' })).toBeInTheDocument();

            await user.click(first);
            expect(screen.getByText(/42: return amount;/)).toBeVisible();
        });

        it('Should show nothing in code context when there is no tag context', async () => {
            const { TagContext: _tags, ...minimal } = exception.exception;
            const user = userEvent.setup();
            render(<ExceptionDetail blob={blob({ exception: minimal })} />);

            await user.click(screen.getByRole('tab', { name: 'Code Context' }));

            expect(screen.queryByRole('button', { name: /line/ })).not.toBeInTheDocument();
        });

        it('Should show the parsed JSON in the raw tab', async () => {
            const user = userEvent.setup();
            render(<ExceptionDetail blob={blob()} />);

            await user.click(screen.getByRole('tab', { name: 'Raw' }));

            const raw = screen.getByText(/"Message": "Variable \[AMOUNT\] does not exist"/);
            expect(raw.textContent).toContain(JSON.stringify(exception, null, 2));
        });

        it('Should drop unknown fields from the raw view', async () => {
            const user = userEvent.setup();
            render(<ExceptionDetail blob={blob({ ...exception, secret: 'internal' })} />);

            await user.click(screen.getByRole('tab', { name: 'Raw' }));

            expect(screen.queryByText(/internal/)).not.toBeInTheDocument();
        });
    });

    it('Should copy the stack trace to the clipboard', async () => {
        const user = userEvent.setup();
        const writeText = jest.spyOn(navigator.clipboard, 'writeText');
        render(<ExceptionDetail blob={blob()} />);

        const stackTrace = screen.getByText(/at handlers\.expenses\.save/);
        await user.click(within(stackTrace).getByRole('button'));

        expect(writeText).toHaveBeenCalledWith(exception.exception.StackTrace);
    });
});
