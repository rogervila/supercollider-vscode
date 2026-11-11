import * as fs from 'fs';
import * as path from 'path';
import * as Mocha from 'mocha';

// Entry point that VS Code loads (--extensionTestsPath): run every *.test.js file in this folder
export function run(): Promise<void> {
	const mocha = new Mocha({ ui: 'tdd', color: true, timeout: 20000 });
	for (const file of fs.readdirSync(__dirname).filter((name) => name.endsWith('.test.js'))) {
		mocha.addFile(path.join(__dirname, file));
	}
	return new Promise((resolve, reject) => {
		mocha.run((failures) => {
			if (failures > 0) {
				reject(new Error(`${failures} tests failed.`));
			} else {
				resolve();
			}
		});
	});
}
