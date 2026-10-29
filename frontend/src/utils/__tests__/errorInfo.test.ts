import { getErrorInfo } from 'utils/errorInfo';

describe('getErrorInfo', () => {
    it('Should read name and message from an Error', () => {
        expect(getErrorInfo(new TypeError('bad type'))).toEqual({ name: 'TypeError', message: 'bad type' });
    });

    it('Should read an AbortError from a DOMException', () => {
        expect(getErrorInfo(new DOMException('aborted', 'AbortError'))).toEqual({
            name: 'AbortError',
            message: 'aborted',
        });
    });

    it('Should read name and message from a plain object', () => {
        expect(getErrorInfo({ name: 'Custom', message: 'oops' })).toEqual({ name: 'Custom', message: 'oops' });
    });

    it.each([
        ['a string', 'boom'],
        ['a number', 42],
        ['null', null],
        ['undefined', undefined],
        ['a boolean', false],
    ])('Should return undefined fields for %s', (_label, value) => {
        expect(getErrorInfo(value)).toEqual({ name: undefined, message: undefined });
    });

    it('Should ignore name and message that are not strings', () => {
        expect(getErrorInfo({ name: 1, message: { text: 'nested' } })).toEqual({
            name: undefined,
            message: undefined,
        });
    });

    it('Should return each field independently', () => {
        expect(getErrorInfo({ message: 'only message' })).toEqual({ name: undefined, message: 'only message' });
        expect(getErrorInfo({ name: 'OnlyName' })).toEqual({ name: 'OnlyName', message: undefined });
    });
});
