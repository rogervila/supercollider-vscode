import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { activateExtension, closeAllEditors, openUntitled, waitFor } from './helper';

// Completion items at position, from all providers
async function completionsAt(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.CompletionItem[]> {
	const list = await vscode.commands.executeCommand<vscode.CompletionList>(
		'vscode.executeCompletionItemProvider', document.uri, position);
	return list.items;
}

function labelOf(item: vscode.CompletionItem): string {
	return typeof item.label === 'string' ? item.label : item.label.label;
}

// Text of all hovers at position, from all providers
async function hoverTextAt(document: vscode.TextDocument, position: vscode.Position): Promise<string> {
	const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
		'vscode.executeHoverProvider', document.uri, position);
	return hovers
		.flatMap((hover) => hover.contents)
		.map((content) => (typeof content === 'string' ? content : content.value))
		.join('\n');
}

// Edits made by editor commands reach the extension host asynchronously
async function expectText(document: vscode.TextDocument, expected: string): Promise<void> {
	try {
		await waitFor(() => document.getText() === expected, `text ${JSON.stringify(expected)}`, 2000);
	} catch {
		assert.strictEqual(document.getText(), expected);
	}
}

suite('Language configuration', () => {
	suiteSetup(activateExtension);
	teardown(closeAllEditors);

	test('"Toggle Line Comment" uses //', async () => {
		const document = await openUntitled('SinOsc.ar(440);');
		await vscode.commands.executeCommand('editor.action.commentLine');
		await expectText(document, '// SinOsc.ar(440);');
	});

	test('"Toggle Block Comment" uses /* */', async () => {
		const document = await openUntitled('SinOsc.ar(440);');
		const editor = await vscode.window.showTextDocument(document);
		editor.selection = new vscode.Selection(0, 0, 0, document.lineAt(0).text.length);
		await vscode.commands.executeCommand('editor.action.blockComment');
		await expectText(document, '/* SinOsc.ar(440); */');
	});

	for (const [open, close] of [['(', ')'], ['[', ']'], ['{', '}'], ['"', '"']]) {
		test(`typing ${open} inserts ${close}`, async () => {
			const document = await openUntitled('');
			await vscode.commands.executeCommand('type', { text: open });
			await expectText(document, open + close);
		});
	}
});

// The language client only handles saved files (document selector scheme "file")
suite('Language server', () => {
	let dir: string;
	let fileCount = 0;

	async function openFile(content: string): Promise<vscode.TextDocument> {
		const file = path.join(dir, `test${++fileCount}.scd`);
		fs.writeFileSync(file, content);
		const document = await vscode.workspace.openTextDocument(file);
		await vscode.window.showTextDocument(document);
		return document;
	}

	suiteSetup(async () => {
		await activateExtension();
		dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-language-server-'));
	});

	suiteTeardown(() => {
		fs.rmSync(dir, { recursive: true, force: true });
	});

	teardown(closeAllEditors);

	// The language server starts in the background, so retry until it answers
	const serverTimeout = 15000;

	for (const [prefix, label, kind] of [
		['SinO', 'SinOsc', vscode.CompletionItemKind.Class],
		['postl', 'postln', vscode.CompletionItemKind.Method],
		['thisP', 'thisProcess', vscode.CompletionItemKind.Keyword],
	] as const) {
		test(`completes "${prefix}" with ${label}`, async () => {
			const document = await openFile(prefix);
			const item = await waitFor(async () => (await completionsAt(document, new vscode.Position(0, prefix.length)))
				.find((candidate) => labelOf(candidate) === label && candidate.kind === kind),
			`completion ${label}`, serverTimeout);
			assert.match(item.detail ?? '', /^SuperCollider (class|method|keyword)$/);
		});
	}

	test('shows documentation when hovering a class', async () => {
		const document = await openFile('SinOsc.ar(440);');
		const text = await waitFor(() => hoverTextAt(document, new vscode.Position(0, 2)), 'hover', serverTimeout);
		assert.ok(text.includes('**SinOsc** - Sine wave oscillator'), text);
	});

	test('shows documentation when hovering a method', async () => {
		const document = await openFile('"Hello".postln;');
		const text = await waitFor(() => hoverTextAt(document, new vscode.Position(0, 10)), 'hover', serverTimeout);
		assert.ok(text.includes('**postln** - Post to console with newline'), text);
	});

	test('shows no hover for unknown words', async () => {
		const document = await openFile('SinOsc.ar(notAKnownWord);');
		// Wait until the server answers for a known word, then ask for the unknown one
		await waitFor(() => hoverTextAt(document, new vscode.Position(0, 2)), 'hover', serverTimeout);
		assert.strictEqual(await hoverTextAt(document, new vscode.Position(0, 13)), '');
	});
});
