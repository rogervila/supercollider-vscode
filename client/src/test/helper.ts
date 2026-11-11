import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

export const EXTENSION_ID = 'rogervila.supercollider-vscode';
export const FIXTURE_DIR = path.resolve(__dirname, '../../testFixture');

export function fixturePath(name: string): string {
	return path.join(FIXTURE_DIR, name);
}

export async function activateExtension(): Promise<vscode.Extension<unknown>> {
	const extension = vscode.extensions.getExtension(EXTENSION_ID);
	assert.ok(extension, `Extension ${EXTENSION_ID} not found`);
	await extension.activate();
	return extension;
}

export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

// Call probe until it returns a truthy value, and return that value
export async function waitFor<T>(
	probe: () => T | Promise<T>,
	description: string,
	timeoutMs = 5000
): Promise<NonNullable<T>> {
	const deadline = Date.now() + timeoutMs;
	for (;;) {
		const value = await probe();
		if (value) {
			return value as NonNullable<T>;
		}
		if (Date.now() > deadline) {
			throw new Error(`Timed out after ${timeoutMs} ms waiting for ${description}`);
		}
		await sleep(50);
	}
}

export async function setSclangPath(value: string | undefined): Promise<void> {
	await vscode.workspace
		.getConfiguration('supercollider')
		.update('sclangPath', value, vscode.ConfigurationTarget.Global);
}

export async function openFixture(name: string): Promise<vscode.TextDocument> {
	const document = await vscode.workspace.openTextDocument(fixturePath(name));
	await vscode.window.showTextDocument(document);
	return document;
}

export async function openUntitled(content: string): Promise<vscode.TextDocument> {
	const document = await vscode.workspace.openTextDocument({ language: 'supercollider', content });
	await vscode.window.showTextDocument(document);
	return document;
}

// Close all editors without save prompts (untitled documents are dirty)
export async function closeAllEditors(): Promise<void> {
	for (let i = 0; i < 50 && vscode.window.visibleTextEditors.length > 0; i++) {
		await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
	}
}

// Index of the first line that contains text
export function lineOf(document: vscode.TextDocument, text: string): number {
	for (let line = 0; line < document.lineCount; line++) {
		if (document.lineAt(line).text.includes(text)) {
			return line;
		}
	}
	throw new Error(`No line contains ${JSON.stringify(text)}`);
}

export function cursorAt(line: number, character = 0): vscode.Selection {
	return new vscode.Selection(line, character, line, character);
}

// Replace vscode.window.showErrorMessage to record the messages that the extension shows
export function captureErrorMessages(): { messages: string[]; restore: () => void } {
	const target = vscode.window as unknown as { showErrorMessage: (message: string) => Thenable<unknown> };
	const original = target.showErrorMessage;
	const messages: string[] = [];
	target.showErrorMessage = (message: string) => {
		messages.push(message);
		return Promise.resolve(undefined);
	};
	return { messages, restore: () => { target.showErrorMessage = original; } };
}

export function isProcessAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch (err) {
		return (err as NodeJS.ErrnoException).code === 'EPERM';
	}
}

// One command that sclang received on stdin. print is true when the command
// ends with 0x0c (execute and print the result), false when it ends with
// 0x1b (execute silently).
export interface SclangCommand {
	text: string;
	print: boolean;
}

// The silent command that the extension sends before each evaluation
export function nowExecutingPathCommand(scValue: string): SclangCommand {
	return { text: `thisProcess.nowExecutingPath = ${scValue};`, print: false };
}

// A fake sclang executable (a POSIX shell script). It records its arguments,
// its process id and every byte that the extension writes to its stdin.
export class FakeSclang {
	readonly dir: string;
	readonly executable: string;

	constructor(executableName = 'sclang') {
		this.dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fake-sclang-'));
		fs.mkdirSync(path.join(this.dir, 'bin'));
		this.executable = path.join(this.dir, 'bin', executableName);
		const quote = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`;
		const script = [
			'#!/bin/sh',
			`printf '%s\\n' "$@" > ${quote(this.file('args'))}`,
			`echo $$ > ${quote(this.file('pid'))}`,
			`exec cat >> ${quote(this.file('stdin'))}`,
			'',
		].join('\n');
		fs.writeFileSync(this.executable, script, { mode: 0o755 });
	}

	private file(name: string): string {
		return path.join(this.dir, name);
	}

	private read(name: string): string | undefined {
		return fs.existsSync(this.file(name)) ? fs.readFileSync(this.file(name), 'utf8') : undefined;
	}

	// Arguments of the last start
	args(): string[] | undefined {
		return this.read('args')?.split('\n').filter((arg) => arg !== '');
	}

	// Process id of the last start
	pid(): number | undefined {
		const text = this.read('pid')?.trim();
		return text ? Number(text) : undefined;
	}

	// All commands received since the fake was created, over all starts
	commands(): SclangCommand[] {
		const commands: SclangCommand[] = [];
		let text = '';
		for (const char of this.read('stdin') ?? '') {
			if (char === '\x1b' || char === '\x0c') {
				commands.push({ text, print: char === '\x0c' });
				text = '';
			} else {
				text += char;
			}
		}
		return commands;
	}

	// Run "SuperCollider: Start Language" and wait until the fake runs
	async start(): Promise<number> {
		fs.rmSync(this.file('pid'), { force: true });
		await vscode.commands.executeCommand('supercollider.startSclang');
		return waitFor(() => this.pid(), 'fake sclang to start');
	}

	// Wait for count new commands after the first `from` commands, and return them
	async waitForCommands(from: number, count: number): Promise<SclangCommand[]> {
		const commands = await waitFor(() => {
			const all = this.commands();
			return all.length >= from + count ? all : undefined;
		}, `${count} sclang command(s)`);
		return commands.slice(from);
	}

	// Run "Execute Block" in document with the given cursor or selection.
	// Return the commands that reach sclang (normally 2: the path, then the code).
	async executeBlock(document: vscode.TextDocument, selection: vscode.Selection, count = 2): Promise<SclangCommand[]> {
		const from = this.commands().length;
		const editor = await vscode.window.showTextDocument(document);
		editor.selection = selection;
		await vscode.commands.executeCommand('supercollider.executeBlock');
		return this.waitForCommands(from, count);
	}

	// Run a command that is not tied to an editor, such as "Boot Server"
	async executeCommand(command: string, count = 2): Promise<SclangCommand[]> {
		const from = this.commands().length;
		await vscode.commands.executeCommand(command);
		return this.waitForCommands(from, count);
	}

	dispose(): void {
		fs.rmSync(this.dir, { recursive: true, force: true });
	}
}
