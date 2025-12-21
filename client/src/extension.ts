/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import {
	ExtensionContext,
	window,
	commands,
	workspace,
	TextEditor,
	TextDocument,
	Position,
	Range,
	OutputChannel
} from 'vscode';

import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind
} from 'vscode-languageclient';

let client: LanguageClient;
let sclangProcess: ChildProcess | null = null;
let sclangOutput: OutputChannel;
let postWindowOutput: OutputChannel;

// Get sclang path from configuration
function getSclangPath(): string {
	const config = workspace.getConfiguration('supercollider');
	return config.get<string>('sclangPath') || 'sclang';
}

// Start sclang process
function startSclang(fallbackToExe: boolean = true): boolean {
	if (sclangProcess && !sclangProcess.killed) {
		sclangOutput.appendLine('[SuperCollider] sclang already running');
		return true;
	}

	let sclangPath = getSclangPath();
    // If we are retrying with .exe
    if (fallbackToExe && sclangPath === 'sclang' && process.platform === 'linux' && !sclangProcess) {
       // We will try the default path first, but if it fails, the error handler will trigger the fallback
       // actually, it's easier to handle this inside the error handler of the first attempt?
       // Let's stick to the configuration path first.
    }

	sclangOutput.appendLine(`[SuperCollider] Starting sclang: ${sclangPath}`);

	try {
        const spawnProcess = (path: string) => {
            const proc = spawn(path, ['-i', 'vscode'], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            proc.on('error', (err) => {
                sclangOutput.appendLine(`[SuperCollider] Error spawning ${path}: ${err.message}`);

                // Fallback logic: if failed on 'sclang' and on linux/WSL, try 'sclang.exe'
                if (path === 'sclang' && fallbackToExe && (process.platform === 'linux' || process.platform === 'win32')) {
                    sclangOutput.appendLine('[SuperCollider] Attempting fallback to sclang.exe...');
                    sclangProcess = spawnProcess('sclang.exe');
                    return;
                }

                window.showErrorMessage(`Failed to start sclang (${path}): ${err.message}. Check supercollider.sclangPath setting.`);
                sclangProcess = null;
            });

            proc.stdout?.on('data', (data: Buffer) => {
                const text = data.toString();
                postWindowOutput.append(text);
                // If we get output, it started successfully
            });

            proc.stderr?.on('data', (data: Buffer) => {
                const text = data.toString();
                postWindowOutput.append(text);
            });

            proc.on('exit', (code) => {
                sclangOutput.appendLine(`[SuperCollider] sclang exited with code ${code}`);
                sclangProcess = null;
            });

            return proc;
        };

		sclangProcess = spawnProcess(sclangPath);

        // We can't guarantee success immediately due to async error reporting of spawn,
        // but we can assume it's "starting".
		sclangOutput.appendLine('[SuperCollider] sclang process spawned, waiting for output...');
		postWindowOutput.show(true);
		return true;
	} catch (err) {
		sclangOutput.appendLine(`[SuperCollider] Failed to start sclang: ${err}`);
		window.showErrorMessage(`Failed to start sclang. Make sure SuperCollider is installed and sclangPath is configured.`);
		return false;
	}
}

// Stop sclang process
function stopSclang(): void {
	if (sclangProcess && !sclangProcess.killed) {
		sclangOutput.appendLine('[SuperCollider] Stopping sclang...');
		sclangProcess.kill();
		sclangProcess = null;
		sclangOutput.appendLine('[SuperCollider] sclang stopped');
	}
}

// Send code to sclang for execution
function executeCode(code: string): void {
	if (!sclangProcess || sclangProcess.killed) {
		if (!startSclang()) {
			return;
		}
		// Wait a bit for sclang to initialize
		setTimeout(() => {
			sendCode(code);
		}, 1000);
	} else {
		sendCode(code);
	}
}

function sendCode(code: string): void {
	if (!sclangProcess || !sclangProcess.stdin) {
		window.showErrorMessage('sclang is not running');
		return;
	}

	// Clean up the code
	const cleanCode = code.trim();
	if (!cleanCode) {
		return;
	}

	postWindowOutput.appendLine(`\n-> ${cleanCode.split('\n')[0]}${cleanCode.includes('\n') ? '...' : ''}`);

	// Send code followed by 0x1b (escape) to execute
	sclangProcess.stdin.write(cleanCode + '\x1b');
}

// Find the code block containing the cursor
function findCodeBlock(document: TextDocument, position: Position): string | null {
	const text = document.getText();
	const offset = document.offsetAt(position);

	// Look for enclosing parentheses
	let depth = 0;
	let startOffset = -1;
	let endOffset = -1;

	// Search backwards for opening parenthesis
	for (let i = offset; i >= 0; i--) {
		const char = text[i];
		if (char === ')') {
			depth++;
		} else if (char === '(') {
			if (depth === 0) {
				startOffset = i;
				break;
			}
			depth--;
		}
	}

	// Search forwards for closing parenthesis
	if (startOffset >= 0) {
		depth = 0;
		for (let i = startOffset; i < text.length; i++) {
			const char = text[i];
			if (char === '(') {
				depth++;
			} else if (char === ')') {
				depth--;
				if (depth === 0) {
					endOffset = i + 1;
					break;
				}
			}
		}
	}

	if (startOffset >= 0 && endOffset > startOffset) {
		return text.substring(startOffset, endOffset);
	}

	// No block found, return current line
	const line = document.lineAt(position.line);
	return line.text.trim();
}

// Execute block command
function executeBlockCommand(editor: TextEditor): void {
	const document = editor.document;
	const selection = editor.selection;

	let code: string;

	if (!selection.isEmpty) {
		// Execute selected text
		code = document.getText(selection);
	} else {
		// Find enclosing block or current line
		const blockCode = findCodeBlock(document, selection.active);
		if (blockCode) {
			code = blockCode;
		} else {
			code = document.lineAt(selection.active.line).text;
		}
	}

	executeCode(code);
}

// Boot SuperCollider server
function bootServer(): void {
	executeCode('s.boot;');
}

// Reboot SuperCollider server
function rebootServer(): void {
	executeCode('s.reboot;');
}

// Kill SuperCollider server
function killServer(): void {
	executeCode('s.quit;');
}

// Stop all sounds
function stopAllSounds(): void {
	executeCode('CmdPeriod.run;');
}

export function activate(context: ExtensionContext) {
	// Create output channels
	sclangOutput = window.createOutputChannel('SuperCollider');
	postWindowOutput = window.createOutputChannel('SuperCollider Post Window');

	// The server is implemented in node
	const serverModule = context.asAbsolutePath(
		path.join('server', 'out', 'server.js')
	);

	const serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
		}
	};

	const clientOptions: LanguageClientOptions = {
		documentSelector: [{ scheme: 'file', language: 'supercollider' }],
		outputChannel: sclangOutput
	};

	client = new LanguageClient(
		'supercolliderLanguageServer',
		'SuperCollider Language Server',
		serverOptions,
		clientOptions
	);

	client.start();

	// Register commands
	context.subscriptions.push(
		commands.registerTextEditorCommand('supercollider.executeBlock', executeBlockCommand),
		commands.registerCommand('supercollider.bootServer', bootServer),
		commands.registerCommand('supercollider.rebootServer', rebootServer),
		commands.registerCommand('supercollider.killServer', killServer),
		commands.registerCommand('supercollider.stopAllSounds', stopAllSounds),
		commands.registerCommand('supercollider.startSclang', () => {
			startSclang();
			postWindowOutput.show(true);
		}),
		commands.registerCommand('supercollider.stopSclang', stopSclang)
	);

	sclangOutput.appendLine('[SuperCollider] Extension activated');
}

export function deactivate(): Thenable<void> | undefined {
	stopSclang();
	if (!client) {
		return undefined;
	}
	return client.stop();
}
