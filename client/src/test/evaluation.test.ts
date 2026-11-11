import * as assert from 'assert';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import {
	activateExtension,
	captureErrorMessages,
	closeAllEditors,
	cursorAt,
	FakeSclang,
	fixturePath,
	isProcessAlive,
	lineOf,
	nowExecutingPathCommand,
	openFixture,
	openUntitled,
	setSclangPath,
	sleep,
	waitFor,
} from './helper';

// SuperCollider string literal, as the extension must write it
function scString(value: string): string {
	return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function printed(text: string) {
	return { text, print: true };
}

async function stopSclang(): Promise<void> {
	await vscode.commands.executeCommand('supercollider.stopSclang');
}

// The fake sclang is a POSIX shell script, so these suites do not run on Windows
suite('Code evaluation (fake sclang)', () => {
	let fake: FakeSclang | undefined;
	const sclang = () => fake as FakeSclang;
	const blocksPath = nowExecutingPathCommand(scString(fixturePath('blocks.scd')));
	const freqBlock = '(\nvar freq = 440;\nfreq.postln;\n)';
	const nestedBlock = '(\nvar nested = (1 + 2);\nnested.postln;\n)';

	suiteSetup(async function () {
		if (process.platform === 'win32') {
			this.skip();
		}
		await activateExtension();
		await stopSclang();
		fake = new FakeSclang();
		await setSclangPath(fake.executable);
		await fake.start();
	});

	suiteTeardown(async () => {
		await stopSclang();
		await setSclangPath(undefined);
		fake?.dispose();
	});

	teardown(closeAllEditors);

	suite('sclang process', () => {
		test('starts sclang with "-i vscode"', () => {
			assert.deepStrictEqual(sclang().args(), ['-i', 'vscode']);
		});

		test('"Start Language" does not start a second sclang', async () => {
			const pid = sclang().pid() as number;
			await vscode.commands.executeCommand('supercollider.startSclang');
			await sleep(500);
			assert.strictEqual(sclang().pid(), pid);
			assert.ok(isProcessAlive(pid));
		});
	});

	suite('Execute Block', () => {
		test('sends the current line when the cursor is not in a block', async () => {
			const document = await openFixture('blocks.scd');
			const commands = await sclang().executeBlock(document, cursorAt(lineOf(document, '"single line"'), 3));
			assert.deepStrictEqual(commands, [blocksPath, printed('"single line".postln;')]);
		});

		test('sends the whole block when the cursor is inside it', async () => {
			const document = await openFixture('blocks.scd');
			const commands = await sclang().executeBlock(document, cursorAt(lineOf(document, 'freq.postln;'), 2));
			assert.deepStrictEqual(commands, [blocksPath, printed(freqBlock)]);
		});

		test('sends the whole block when the cursor is on its opening parenthesis', async () => {
			const document = await openFixture('blocks.scd');
			const commands = await sclang().executeBlock(document, cursorAt(lineOf(document, 'var freq') - 1, 0));
			assert.deepStrictEqual(commands, [blocksPath, printed(freqBlock)]);
		});

		test('sends the whole block when the cursor is after its closing parenthesis', async () => {
			const document = await openFixture('blocks.scd');
			const commands = await sclang().executeBlock(document, cursorAt(lineOf(document, 'freq.postln;') + 1, 1));
			assert.deepStrictEqual(commands, [blocksPath, printed(freqBlock)]);
		});

		test('sends the outer block when the cursor is inside nested parentheses', async () => {
			const document = await openFixture('blocks.scd');
			const line = lineOf(document, 'var nested');
			const character = document.lineAt(line).text.indexOf('1 + 2');
			const commands = await sclang().executeBlock(document, cursorAt(line, character));
			assert.deepStrictEqual(commands, [blocksPath, printed(nestedBlock)]);
		});

		test('sends only the line for "(...).postln", which is not a block', async () => {
			const document = await openFixture('blocks.scd');
			const commands = await sclang().executeBlock(document, cursorAt(lineOf(document, '(1..5)'), 0));
			assert.deepStrictEqual(commands, [blocksPath, printed('(1..5).postln;')]);
		});

		test('sends the selected text', async () => {
			const document = await openFixture('blocks.scd');
			const line = lineOf(document, 'freq.postln;');
			const selection = new vscode.Selection(line, 0, line, 'freq.postln;'.length);
			const commands = await sclang().executeBlock(document, selection);
			assert.deepStrictEqual(commands, [blocksPath, printed('freq.postln;')]);
		});

		test('trims whitespace around the selected text', async () => {
			const document = await openFixture('blocks.scd');
			const line = lineOf(document, '"single line"');
			const commands = await sclang().executeBlock(document, new vscode.Selection(line, 0, line + 1, 0));
			assert.deepStrictEqual(commands, [blocksPath, printed('"single line".postln;')]);
		});

		test('sends nothing for an empty line', async () => {
			const document = await openFixture('blocks.scd');
			const emptyLine = lineOf(document, '"single line"') + 1;
			assert.strictEqual(document.lineAt(emptyLine).text, '');
			const from = sclang().commands().length;
			const editor = await vscode.window.showTextDocument(document);
			editor.selection = cursorAt(emptyLine);
			await vscode.commands.executeCommand('supercollider.executeBlock');
			// A second evaluation shows that the first one sent nothing
			await sclang().executeBlock(document, cursorAt(emptyLine - 1));
			await sleep(200);
			assert.deepStrictEqual(sclang().commands().slice(from), [blocksPath, printed('"single line".postln;')]);
		});
	});

	suite('Current file path (thisProcess.nowExecutingPath)', () => {
		test('a saved file sends its path before the code, without printing it', async () => {
			const document = await openFixture('blocks.scd');
			const [pathCommand] = await sclang().executeBlock(document, cursorAt(lineOf(document, '"single line"')));
			assert.deepStrictEqual(pathCommand, {
				text: `thisProcess.nowExecutingPath = "${fixturePath('blocks.scd')}";`,
				print: false,
			});
		});

		test('an unsaved file sends nil', async () => {
			const document = await openUntitled('1 + 1;');
			const commands = await sclang().executeBlock(document, cursorAt(0));
			assert.deepStrictEqual(commands, [nowExecutingPathCommand('nil'), printed('1 + 1;')]);
		});

		test('escapes backslashes and double quotes in the path', async () => {
			const base = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-path-'));
			try {
				const dir = path.join(base, 'we"ird\\dir é');
				fs.mkdirSync(dir);
				const file = path.join(dir, 'x.scd');
				fs.writeFileSync(file, '2 + 2;\n');
				const document = await vscode.workspace.openTextDocument(file);
				const commands = await sclang().executeBlock(document, cursorAt(0));
				assert.deepStrictEqual(commands, [
					{ text: `thisProcess.nowExecutingPath = "${base}/we\\"ird\\\\dir é/x.scd";`, print: false },
					printed('2 + 2;'),
				]);
			} finally {
				await closeAllEditors();
				fs.rmSync(base, { recursive: true, force: true });
			}
		});
	});

	suite('Server commands', () => {
		for (const [command, code] of [
			['supercollider.bootServer', 's.boot;'],
			['supercollider.rebootServer', 's.reboot;'],
			['supercollider.killServer', 's.quit;'],
			['supercollider.stopAllSounds', 'CmdPeriod.run;'],
		]) {
			test(`${command} sends "${code}"`, async () => {
				const commands = await sclang().executeCommand(command);
				assert.deepStrictEqual(commands, [nowExecutingPathCommand('nil'), printed(code)]);
			});
		}
	});

	suite('Stop and restart', () => {
		test('"Stop Language" terminates sclang', async () => {
			const pid = sclang().pid() as number;
			await stopSclang();
			await waitFor(() => !isProcessAlive(pid), 'sclang to exit');
		});

		test('"Execute Block" starts sclang when it is not running', async () => {
			const oldPid = sclang().pid() as number;
			await stopSclang();
			await waitFor(() => !isProcessAlive(oldPid), 'sclang to exit');
			const document = await openFixture('blocks.scd');
			const commands = await sclang().executeBlock(document, cursorAt(lineOf(document, '"single line"')));
			assert.deepStrictEqual(commands, [blocksPath, printed('"single line".postln;')]);
			const newPid = sclang().pid() as number;
			assert.notStrictEqual(newPid, oldPid);
			assert.ok(isProcessAlive(newPid));
		});
	});
});

suite('sclang start-up errors', () => {
	suiteSetup(async () => {
		await activateExtension();
		await stopSclang();
	});

	teardown(async () => {
		await stopSclang();
		await setSclangPath(undefined);
	});

	async function startAndCaptureError(sclangPath: string): Promise<string> {
		await setSclangPath(sclangPath);
		const capture = captureErrorMessages();
		try {
			await vscode.commands.executeCommand('supercollider.startSclang');
			return (await waitFor(() => capture.messages[0], 'an error message'));
		} finally {
			capture.restore();
		}
	}

	test('shows an error when sclangPath points to a missing file', async () => {
		const missing = path.join(os.tmpdir(), 'supercollider-vscode-no-such-dir', 'sclang');
		const message = await startAndCaptureError(missing);
		assert.ok(message.startsWith(`Could not find sclang executable at the configured path: ${missing}.`), message);
	});

	test('shows an error when sclang cannot be started', async () => {
		const message = await startAndCaptureError('supercollider-vscode-missing-sclang');
		assert.ok(message.startsWith('Failed to start sclang (supercollider-vscode-missing-sclang)'), message);
		assert.ok(message.includes('The executable was not found.'), message);
	});
});

// Under WSL, the extension can run the Windows sclang.exe, which needs Windows paths
suite('sclang.exe on Linux (WSL)', () => {
	let fake: FakeSclang | undefined;

	suiteSetup(async function () {
		if (process.platform !== 'linux') {
			this.skip();
		}
		await activateExtension();
		await stopSclang();
		fake = new FakeSclang('sclang.exe');
		await setSclangPath(fake.executable);
		await fake.start();
	});

	suiteTeardown(async () => {
		await stopSclang();
		await setSclangPath(undefined);
		fake?.dispose();
	});

	teardown(closeAllEditors);

	test('sends the path from "wslpath -w", or the Linux path when wslpath fails', async () => {
		const file = fixturePath('blocks.scd');
		let expected: string;
		try {
			expected = execFileSync('wslpath', ['-w', file], { encoding: 'utf8' }).trim();
		} catch {
			expected = file;
		}
		const document = await openFixture('blocks.scd');
		const [pathCommand] = await (fake as FakeSclang).executeBlock(document, cursorAt(lineOf(document, '"single line"')));
		assert.deepStrictEqual(pathCommand, nowExecutingPathCommand(scString(expected)));
	});
});
