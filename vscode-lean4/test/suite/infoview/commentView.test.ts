import * as assert from 'assert';
import { Position, Range, Selection, TextDocument, TextEditor, EndOfLine } from 'vscode';
import { extractCommentString } from '../../../src/infoview';

// Mock TextDocument
class MockTextDocument implements TextDocument {
    uri: any;
    fileName: string;
    isUntitled: boolean = false;
    languageId: string = 'lean4';
    version: number = 1;
    isDirty: boolean = false;
    isClosed: boolean = false;
    eol: EndOfLine = EndOfLine.LF;
    lineCount: number;
    private lines: string[];

    constructor(content: string) {
        this.lines = content.split('\n');
        this.lineCount = this.lines.length;
        this.fileName = 'mockfile.lean'; // Keep a default filename
    }

    save(): Thenable<boolean> { throw new Error('Method not implemented.'); }
    getText(range?: Range): string {
        if (!range) return this.lines.join('\n');
        let text = '';
        for (let i = range.start.line; i <= range.end.line; i++) {
            const line = this.lines[i];
            const startChar = i === range.start.line ? range.start.character : 0;
            const endChar = i === range.end.line ? range.end.character : line.length;
            text += line.substring(startChar, endChar) + (i < range.end.line ? '\n' : '');
        }
        return text;
    }
    lineAt(lineOrPosition: number | Position): any {
        const line = typeof lineOrPosition === 'number' ? lineOrPosition : lineOrPosition.line;
        const text = this.lines[line];
        return {
            lineNumber: line,
            text,
            range: new Range(new Position(line, 0), new Position(line, text.length)),
            firstNonWhitespaceCharacterIndex: text.search(/\S|$/),
            isEmptyOrWhitespace: text.trim().length === 0,
        };
    }
    offsetAt(position: Position): number { throw new Error('Method not implemented.'); }
    positionAt(offset: number): Position { throw new Error('Method not implemented.'); }
    validateRange(range: Range): Range { throw new Error('Method not implemented.'); }
    validatePosition(position: Position): Position { throw new Error('Method not implemented.'); }
    getWordRangeAtPosition(position: Position, regex?: RegExp): Range | undefined { throw new Error('Method not implemented.'); }
}

// Mock TextEditor
class MockTextEditor {
    document: TextDocument;
    selection: Selection;
    selections: Selection[] = [];
    visibleRanges: Range[] = [];
    options: any = {};
    viewColumn: any = {};

    constructor(doc: TextDocument, selection: Selection) {
        this.document = doc;
        this.selection = selection;
        this.selections = [selection];
    }

    edit(callback: (editBuilder: any) => void, options?: { undoStopBefore: boolean; undoStopAfter: boolean; }): Thenable<boolean> { throw new Error('Method not implemented.'); }
    insertSnippet(snippet: any, location?: Range | Position | readonly Range[] | readonly Position[], options?: { undoStopBefore: boolean; undoStopAfter: boolean; }): Thenable<boolean> { throw new Error('Method not implemented.'); }
    setDecorations(decorationType: any, rangesOrOptions: Range[] | any): void { throw new Error('Method not implemented.'); }
    revealRange(range: Range, revealType?: any): void { throw new Error('Method not implemented.'); }
    show(column?: any): void { throw new Error('Method not implemented.'); }
    hide(): void { throw new Error('Method not implemented.'); }
}


suite('Comment Extraction Tests', () => {

    function createMocks(content: string, cursorLine: number, cursorChar: number): { editor: TextEditor, position: Position } {
        const document = new MockTextDocument(content);
        const position = new Position(cursorLine, cursorChar);
        const selection = new Selection(position, position);
        // We cast to `any` then to `TextEditor` to satisfy the type checker,
        // as MockTextEditor doesn't fully implement TextEditor.
        const editor = new MockTextEditor(document, selection) as any as TextEditor;
        return { editor, position };
    }

    test('No comment', () => {
        const { editor, position } = createMocks('def x := 1', 0, 0);
        assert.strictEqual(extractCommentString(editor, position), '');
    });

    test('Single-line comment: basic', () => {
        const { editor, position } = createMocks('-- This is a comment', 0, 5);
        assert.strictEqual(extractCommentString(editor, position), 'This is a comment');
    });

    test('Single-line comment: cursor at start of comment', () => {
        const { editor, position } = createMocks('--This is a comment', 0, 2);
        assert.strictEqual(extractCommentString(editor, position), 'This is a comment');
    });

    test('Single-line comment: leading whitespace', () => {
        const { editor, position } = createMocks('  -- This is a comment', 0, 7);
        assert.strictEqual(extractCommentString(editor, position), 'This is a comment');
    });

    test('Single-line comment: empty comment', () => {
        const { editor, position } = createMocks('--', 0, 2);
        assert.strictEqual(extractCommentString(editor, position), '');
    });

    test('Single-line comment: empty comment with space', () => {
        const { editor, position } = createMocks('-- ', 0, 3);
        assert.strictEqual(extractCommentString(editor, position), '');
    });

    test('Single-line comment: code before comment', () => {
        const { editor, position } = createMocks('def x := 1 -- comment', 0, 15);
        assert.strictEqual(extractCommentString(editor, position), 'comment');
    });

    test('Single-line comment: cursor on code part before comment', () => {
        const { editor, position } = createMocks('def x := 1 -- comment', 0, 3);
        assert.strictEqual(extractCommentString(editor, position), '');
    });

    test('Block comment: single line /- ... -/', () => {
        const { editor, position } = createMocks('/- This is a block comment -/', 0, 10);
        assert.strictEqual(extractCommentString(editor, position), 'This is a block comment');
    });

    test('Block comment: single line, cursor at start /- ...-/', () => {
        const { editor, position } = createMocks('/-This is a block comment-/', 0, 2);
        assert.strictEqual(extractCommentString(editor, position), 'This is a block comment');
    });

    test('Block comment: single line, empty /- -/', () => {
        const { editor, position } = createMocks('/- -/', 0, 3);
        assert.strictEqual(extractCommentString(editor, position), '');
    });

    test('Block comment: single line, empty with space /-  -/', () => {
        const { editor, position } = createMocks('/-  -/', 0, 4);
        assert.strictEqual(extractCommentString(editor, position), '');
    });

    test('Block comment: multi-line, cursor on first line', () => {
        const content = '/- Block\n   comment -/';
        const { editor, position } = createMocks(content, 0, 5);
        assert.strictEqual(extractCommentString(editor, position), 'Block\n   comment');
    });

    test('Block comment: multi-line, cursor on middle line', () => {
        const content = '/- \n  Line 2\n-/';
        const { editor, position } = createMocks(content, 1, 5);
        assert.strictEqual(extractCommentString(editor, position), 'Line 2');
    });

    test('Block comment: multi-line, cursor on last line', () => {
        const content = '/- Block\n   comment -/';
        const { editor, position } = createMocks(content, 1, 5);
        assert.strictEqual(extractCommentString(editor, position), 'Block\n   comment');
    });

    test('Block comment: multi-line, complex content', () => {
        const content = '/- \n  * Item 1\n  * Item 2\n-/';
        const { editor, position } = createMocks(content, 1, 5); // cursor on "* Item 1"
        assert.strictEqual(extractCommentString(editor, position), '* Item 1\n  * Item 2');
    });

    test('Block comment: multi-line, cursor on opening /- line', () => {
        const content = '/- First line\nSecond line\n-/';
        const { editor, position } = createMocks(content, 0, 1); // Cursor on /-*
        assert.strictEqual(extractCommentString(editor, position), 'First line\nSecond line');
    });

    test('Block comment: multi-line, cursor on closing -/ line', () => {
        const content = '/- First line\nSecond line\n-/';
        const { editor, position } = createMocks(content, 2, 1); // Cursor on -*/
        assert.strictEqual(extractCommentString(editor, position), 'First line\nSecond line');
    });

    test('Block comment: unterminated start, cursor on start line', () => {
        const { editor, position } = createMocks('/- This comment is not closed', 0, 5);
        assert.strictEqual(extractCommentString(editor, position), 'This comment is not closed');
    });

    test('Block comment: unterminated start, cursor on subsequent line (should not find)', () => {
        const content = '/- This comment is not closed\nThis is a new line';
        const { editor, position } = createMocks(content, 1, 5);
        assert.strictEqual(extractCommentString(editor, position), '');
    });

    test('Block comment: only closing tag (should not find)', () => {
        const { editor, position } = createMocks('def x := 1\n -/', 1, 2);
        assert.strictEqual(extractCommentString(editor, position), '');
    });

    test('Block comment: cursor outside, before', () => {
        const content = 'def x := 1\n/- comment -/';
        const { editor, position } = createMocks(content, 0, 3);
        assert.strictEqual(extractCommentString(editor, position), '');
    });

    test('Block comment: cursor outside, after', () => {
        const content = '/- comment -/\ndef y := 2';
        const { editor, position } = createMocks(content, 1, 3);
        assert.strictEqual(extractCommentString(editor, position), '');
    });

    test('Nested block comments (behavior is best-effort, current logic might pick innermost or outermost)', () => {
        const content = '/- outer /-\n  inner\n-/ outer part -/';
        // Cursor on "inner"
        const { editor, position } = createMocks(content, 1, 3);
        // Current logic will likely extract "inner\n-/ outer part" because it finds the first / - and last - /
        // A more robust parser would be needed for true nesting. This test documents current behavior.
        // Based on the current implementation, it will find the first `/-` on line 0,
        // and the last `-/` on line 2.
        assert.strictEqual(extractCommentString(editor, position), 'outer /-\n  inner\n-/ outer part');
    });

    test('Multiple block comments, cursor in first', () => {
        const content = '/- first comment -/\ndef x := 1\n/- second comment -/';
        const { editor, position } = createMocks(content, 0, 5);
        assert.strictEqual(extractCommentString(editor, position), 'first comment');
    });

    test('Multiple block comments, cursor in second', () => {
        const content = '/- first comment -/\ndef x := 1\n/- second comment -/';
        const { editor, position } = createMocks(content, 2, 5);
        assert.strictEqual(extractCommentString(editor, position), 'second comment');
    });

    test('Line comment inside block comment (should be treated as part of block comment)', () => {
        const content = '/-\n  -- this is a line comment style\n  inside a block\n-/';
        const { editor, position } = createMocks(content, 1, 6); // cursor on "-- this is..."
        assert.strictEqual(extractCommentString(editor, position), '-- this is a line comment style\n  inside a block');
    });

});
