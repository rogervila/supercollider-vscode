/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from 'path';
import * as fs from 'fs';
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

// Get common macOS SuperCollider installation paths
function getCommonMacOSPaths(): string[] {
	return [
		'/Applications/SuperCollider.app/Contents/Resources/sclang',
		'/Applications/SuperCollider.app/Contents/MacOS/sclang',
		'/usr/local/bin/sclang',
		'/opt/homebrew/bin/sclang',
		'/usr/bin/sclang'
	];
}

// Check if a file exists and is executable
function isExecutable(filePath: string): boolean {
	try {
		const stats = fs.statSync(filePath);
		return stats.isFile() && (stats.mode & fs.constants.S_IXUSR) !== 0;
	} catch {
		return false;
	}
}

// Find sclang executable, trying common paths on macOS
function findSclangPath(configuredPath: string): string | null {
	// If it's an absolute path or contains a path separator, check it directly
	if (configuredPath !== 'sclang' && (configuredPath.includes('/') || configuredPath.includes('\\'))) {
		if (isExecutable(configuredPath)) {
			return configuredPath;
		}
		return null;
	}

	// If it's just 'sclang', try to find it in common installation paths
	if (configuredPath === 'sclang') {
		// On macOS, try common installation paths first
		if (process.platform === 'darwin') {
			const commonPaths = getCommonMacOSPaths();
			for (const commonPath of commonPaths) {
				if (isExecutable(commonPath)) {
					sclangOutput.appendLine(`[SuperCollider] Found sclang at: ${commonPath}`);
					return commonPath;
				}
			}
		}
		// On other platforms, return 'sclang' and hope it's in PATH
		// The error handler will provide better error messages if it fails
		return 'sclang';
	}

	// Return the configured path as-is (might work if it's in PATH)
	return configuredPath;
}

// Get sclang path from configuration
function getSclangPath(): string {
	const config = workspace.getConfiguration('supercollider');
	return config.get<string>('sclangPath') || 'sclang';
}

// Start sclang process
async function startSclang(fallbackToExe: boolean = true): Promise<boolean> {
	if (sclangProcess && !sclangProcess.killed) {
		sclangOutput.appendLine('[SuperCollider] sclang already running');
		return true;
	}

	let configuredPath = getSclangPath();
	let sclangPath = findSclangPath(configuredPath);

	if (!sclangPath) {
		const errorMsg = `Could not find sclang executable at the configured path: ${configuredPath}. Please check the 'supercollider.sclangPath' setting.`;
		if (process.platform === 'darwin') {
			window.showErrorMessage(`${errorMsg} Common macOS paths: /Applications/SuperCollider.app/Contents/Resources/sclang`);
		} else {
			window.showErrorMessage(errorMsg);
		}
		sclangOutput.appendLine(`[SuperCollider] ${errorMsg}`);
		return false;
	}

	sclangOutput.appendLine(`[SuperCollider] Starting sclang: ${sclangPath}`);

	try {
        const spawnProcess = (pathToSpawn: string, isFallback: boolean = false) => {
            const proc = spawn(pathToSpawn, ['-i', 'vscode'], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            proc.on('error', async (err) => {
                sclangOutput.appendLine(`[SuperCollider] Error spawning ${pathToSpawn}: ${err.message}`);

                // Fallback logic for Linux/WSL: try 'sclang.exe'
                if (pathToSpawn === 'sclang' && fallbackToExe && !isFallback && (process.platform === 'linux' || process.platform === 'win32')) {
                    sclangOutput.appendLine('[SuperCollider] Attempting fallback to sclang.exe...');
                    sclangProcess = spawnProcess('sclang.exe', true);
                    return;
                }

                // Fallback logic for macOS: try common installation paths
                if (process.platform === 'darwin' && configuredPath === 'sclang' && !isFallback) {
                    const commonPaths = getCommonMacOSPaths();
                    for (const commonPath of commonPaths) {
                        if (isExecutable(commonPath) && commonPath !== pathToSpawn) {
                            sclangOutput.appendLine(`[SuperCollider] Attempting fallback to: ${commonPath}`);
                            sclangProcess = spawnProcess(commonPath, true);
                            return;
                        }
                    }
                }

                // All fallbacks failed
                let errorMessage = `Failed to start sclang (${pathToSpawn}): ${err.message}.`;
                if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
                    errorMessage += ' The executable was not found.';
                    if (process.platform === 'darwin') {
                        errorMessage += ' On macOS, try setting supercollider.sclangPath to: /Applications/SuperCollider.app/Contents/Resources/sclang';
                    }
                }
                errorMessage += ' Check the supercollider.sclangPath setting.';
                window.showErrorMessage(errorMessage);
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
async function executeCode(code: string): Promise<void> {
	if (!sclangProcess || sclangProcess.killed) {
		if (!(await startSclang())) {
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

	// Send code followed by 0x0c (form feed) to execute and print result
	sclangProcess.stdin.write(cleanCode + '\x0c');
}

// Find the code block containing the cursor
function findCodeBlock(document: TextDocument, position: Position): string | null {
	const text = document.getText();
	const offset = document.offsetAt(position);

    // Helper to check if the character is at the start of the line (ignoring whitespace)
    const isStartOfLine = (index: number): boolean => {
        for (let j = index - 1; j >= 0; j--) {
            const char = text[j];
			if (char === '\n' || char === '\r') {
				return true;
			}
            if (char === ' ' || char === '\t') {
				continue;
			}
            return false;
        }
        return true;
    };

    // Helper to find matching closing parenthesis for a given start
    const findMatchingClosing = (startIndex: number): number => {
        let depth = 0;
        for (let i = startIndex; i < text.length; i++) {
            const char = text[i];
            if (char === '(') {
                depth++;
            } else if (char === ')') {
                depth--;
                if (depth === 0) {
                    return i;
                }
            }
        }
        return -1;
    };

    // Helper to check if the closing parenthesis is a valid Region End
    // Must be followed by whitespace, newline, ';', or EOF.
    // If it is followed by '.', it is NOT a region end.
    const isValidRegionEnd = (endIndex: number): boolean => {
        for (let i = endIndex + 1; i < text.length; i++) {
            const char = text[i];
            if (char === ' ' || char === '\t') {
                continue;
            }
            if (char === '\n' || char === '\r' || char === ';') {
                return true;
            }
            // Found something else (like '.') on the same line
            return false;
        }
        // EOF
        return true;
    };

	// Scan backwards for potential block starts
    let depth = 0;
	for (let i = offset; i >= 0; i--) {
		const char = text[i];
		if (char === ')') {
			depth++;
		} else if (char === '(') {
			depth--;

            // A 'start' candidate must be at start of line
			if (isStartOfLine(i)) {
                // And it must enclose us (depth < 0) OR be the block we are closing (depth == 0 if we were at the end)
                if (depth <= 0) {
                     // Potential Candidate found.
                     // Verify it has a valid End.
                     const closeIndex = findMatchingClosing(i);
                     if (closeIndex !== -1) {
                         // We found the closing paren.

                         // Check 1: Is it a valid Region End?
                         if (!isValidRegionEnd(closeIndex)) {
                             // Not a valid region end (e.g. (..).postln). Continue searching.
                             continue;
                         }

                         // Check 2: Does it contain the cursor?
                         // It contains the cursor if closeIndex >= offset
                         // OR if we allow the cursor to be strictly on the SAME LINE as the closing paren.
                         // (User scenario: cursor is at the end of the line containing ')')
                         const closePos = document.positionAt(closeIndex);
                         const isCursorInsideOrOnEndLine = (closeIndex >= offset) || (closePos.line === position.line);

                         if (isCursorInsideOrOnEndLine) {
                             // Success!
                             return text.substring(i, closeIndex + 1);
                         }
                     }
                }
            }
		}
	}

	// No block found, return current line
	const line = document.lineAt(position.line);
	return line.text.trim();
}

// Execute block command
async function executeBlockCommand(editor: TextEditor): Promise<void> {
	const document = editor.document;
	const selection = editor.selection;

	let code: string;

	if (!selection.isEmpty) {
		// Execute selected text
		code = document.getText(selection);
		sclangOutput.appendLine(`[DEBUG] Selected text: "${code}"`);
	} else {
		// Find enclosing block or current line
		sclangOutput.appendLine(`[DEBUG] Cursor at line ${selection.active.line}, char ${selection.active.character}`);
		const blockCode = findCodeBlock(document, selection.active);
		if (blockCode) {
			code = blockCode;
			sclangOutput.appendLine(`[DEBUG] Block found: "${code}"`);
		} else {
			code = document.lineAt(selection.active.line).text;
			sclangOutput.appendLine(`[DEBUG] No block, using line: "${code}"`);
		}
	}

	await executeCode(code);
}

// Boot SuperCollider server
async function bootServer(): Promise<void> {
	await executeCode('s.boot;');
}

// Reboot SuperCollider server
async function rebootServer(): Promise<void> {
	await executeCode('s.reboot;');
}

// Kill SuperCollider server
async function killServer(): Promise<void> {
	await executeCode('s.quit;');
}

// Stop all sounds
async function stopAllSounds(): Promise<void> {
	await executeCode('CmdPeriod.run;');
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
		commands.registerCommand('supercollider.startSclang', async () => {
			await startSclang();
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
