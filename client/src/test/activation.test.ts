import * as assert from 'assert';
import * as vscode from 'vscode';
import { activateExtension, closeAllEditors, fixturePath } from './helper';

interface PackageJson {
	contributes: {
		commands: { command: string }[];
		keybindings: { command: string }[];
	};
}

suite('Activation and contributions', () => {
	let packageJson: PackageJson;

	suiteSetup(async () => {
		packageJson = (await activateExtension()).packageJSON as PackageJson;
	});

	teardown(closeAllEditors);

	test('registers every command that package.json contributes', async () => {
		const registered = await vscode.commands.getCommands(true);
		const contributed = packageJson.contributes.commands.map((c) => c.command);
		assert.deepStrictEqual(contributed.sort(), [
			'supercollider.bootServer',
			'supercollider.executeBlock',
			'supercollider.killServer',
			'supercollider.rebootServer',
			'supercollider.startSclang',
			'supercollider.stopAllSounds',
			'supercollider.stopSclang',
		]);
		for (const command of contributed) {
			assert.ok(registered.includes(command), `${command} is not registered`);
		}
	});

	test('keybindings only use contributed commands', () => {
		const contributed = packageJson.contributes.commands.map((c) => c.command);
		for (const binding of packageJson.contributes.keybindings) {
			assert.ok(contributed.includes(binding.command), `${binding.command} is not contributed`);
		}
	});

	test('supercollider.sclangPath defaults to "sclang"', () => {
		const setting = vscode.workspace.getConfiguration('supercollider').inspect<string>('sclangPath');
		assert.strictEqual(setting?.defaultValue, 'sclang');
	});

	test('the supercollider language is registered', async () => {
		assert.ok((await vscode.languages.getLanguages()).includes('supercollider'));
	});

	test('.scd files open with the supercollider language', async () => {
		const document = await vscode.workspace.openTextDocument(fixturePath('blocks.scd'));
		assert.strictEqual(document.languageId, 'supercollider');
	});

	test('.sc files open with the supercollider language', async () => {
		const document = await vscode.workspace.openTextDocument(fixturePath('Example.sc'));
		assert.strictEqual(document.languageId, 'supercollider');
	});
});
