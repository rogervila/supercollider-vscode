import * as path from 'path';
import { runTests } from '@vscode/test-electron';

// Download VS Code and run the tests in this folder inside it.
// The tests do not need SuperCollider: a fake sclang records what the extension sends.
async function main(): Promise<void> {
	try {
		await runTests({
			extensionDevelopmentPath: path.resolve(__dirname, '../../../'),
			extensionTestsPath: path.resolve(__dirname, './index'),
			launchArgs: [path.resolve(__dirname, '../../testFixture'), '--disable-extensions'],
		});
	} catch (err) {
		console.error('Failed to run tests', err);
		process.exit(1);
	}
}

main();
