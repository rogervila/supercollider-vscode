# SuperCollider Language Server for Visual Studio Code

A Visual Studio Code extension providing language support for [SuperCollider](https://supercollider.github.io/), an audio synthesis and algorithmic composition platform.

## Features

- **Code Execution**: Execute SuperCollider code directly from VS Code.
  - Execute current line or selected code (`Ctrl+Enter`)
  - Evaluate code blocks (enclosed in parentheses)
  - Boot/Reboot/Kill Server commands
  - Stop all sounds (`Ctrl+.`)

- **Syntax Highlighting** (`.scd` and `.sc` files):
  - Comments, strings, characters, symbols
  - Numbers, classes, keywords, operators, environment variables

- **Code Completion**:
  - Keywords, built-in classes, and common methods

- **Editor Features**:
  - Auto-closing brackets/quotes, block commenting, code folding

## Requirements

The [SuperCollider](https://supercollider.github.io/download) environment must be installed.

- **macOS/Linux**: `sclang` should be in your PATH.
- **Windows**: `sclang.exe` should be available.
- **WSL**: The extension automatically handles the `sclang` alias issue by falling back to `sclang.exe`, or you can configure the path manually.

## Extension Settings

* `supercollider.sclangPath`: Path to the `sclang` executable (default: `sclang`).

## Keybindings

| Command | Keybinding |
| --- | --- |
| Execute Block/Selection | `Ctrl+Enter` (Cmd+Enter on macOS) |
| Execute Block (Alternative) | `Shift+Enter` |
| Stop All Sounds | `Ctrl+.` (Cmd+. on macOS) |

## Installation

1. Clone this repository
2. Run `npm install` in the root folder
3. Open VS Code on this folder
4. Press `Ctrl+Shift+B` to compile
5. Press `F5` to launch the Extension Development Host

## Usage

Open VS Code (On macOS make sure that microphone permissions are set for VS Code).
Create or open a `.scd` or `.sc` file and start writing SuperCollider code:

```supercollider
// Simple sine wave
{
    var freq = 440;
    SinOsc.ar(freq, 0, 0.1)
}.play;

// Pattern example
Pbind(
    \instrument, \default,
    \degree, Pseq([0, 2, 4, 5, 7], inf),
    \dur, 0.25
).play;
```

## Development

### Project Structure

```
├── client/          # Language client (VSCode extension)
│   └── src/
│       └── extension.ts
├── server/          # Language server
│   └── src/
│       ├── server.ts
│       ├── languageModes.ts
│       └── modes/
│           └── scdMode.ts
├── syntaxes/        # TextMate grammar
│   └── scd.tmLanguage.json
└── package.json
```

### Building

```bash
npm install
npm run compile
```

### Debugging

1. Open in VS Code
2. Press `F5` to launch Extension Development Host
3. Use "Attach to Server" debug configuration to debug the language server

---

## Publishing

This section covers how to compile the extension into a `.vsix` package and publish it to both the **Visual Studio Code Marketplace** and **Open VSX Registry** (used by VSCodium, Gitpod, and other editors).

### Prerequisites

Make sure all dependencies are installed, including the publishing tools:

```bash
npm install
```

This project uses [`@vscode/vsce`](https://github.com/microsoft/vscode-vsce) for the VS Code Marketplace and [`ovsx`](https://github.com/eclipse/openvsx) for Open VSX — both are already listed as dev dependencies.

---

### Step 1 — Compile the Extension

Always start with a clean compile before packaging. This ensures the output in `client/out/` and `server/out/` reflects the latest source:

```bash
npm run compile
```

If you want to verify there are no linting errors at the same time:

```bash
npm run lint
npm run compile
```

---

### Step 2 — Package the Extension

The `package` script cleans the server output folder and creates a `.vsix` archive:

```bash
npm run package
```

This runs `vsce package` internally and produces a file like:

```
supercollider-vscode-1.0.2.vsix
```

You can install this file locally to test it before publishing:

```bash
code --install-extension supercollider-vscode-1.0.2.vsix
```

---

### Step 3 — Publish to the VS Code Marketplace

#### 3.1 — Create a Publisher Account

1. Sign in to [https://marketplace.visualstudio.com/manage](https://marketplace.visualstudio.com/manage) with your Microsoft account.
2. Click **Create Publisher** if you don't have one yet.
3. Make sure the `publisher` field in `package.json` matches your publisher ID exactly.

#### 3.2 — Generate a Personal Access Token (PAT)

1. Go to [https://dev.azure.com](https://dev.azure.com) and sign in.
2. Click your profile picture → **Personal access tokens**.
3. Click **New Token** and configure it:
   - **Name**: anything descriptive, e.g. `vsce-publish`
   - **Organization**: select **All accessible organizations**
   - **Expiration**: choose a date that suits your workflow
   - **Scopes**: select **Custom defined**, then tick **Marketplace → Manage**
4. Click **Create** and **copy the token** — you will not see it again.

#### 3.3 — Log in with vsce

```bash
npx vsce login <your-publisher-id>
```

When prompted, paste your Personal Access Token. The credentials are stored locally so you only need to do this once per machine.

#### 3.4 — Publish

```bash
npx vsce publish
```

To publish a specific version bump in one step (updates `package.json` automatically):

```bash
npx vsce publish patch   # e.g. 1.0.2 → 1.0.3
npx vsce publish minor   # e.g. 1.0.2 → 1.1.0
npx vsce publish major   # e.g. 1.0.2 → 2.0.0
```

Or publish an already-packaged `.vsix` directly:

```bash
npx vsce publish --packagePath supercollider-vscode-1.0.2.vsix
```

The extension will appear on the Marketplace at:
`https://marketplace.visualstudio.com/items?itemName=rogervila.supercollider-vscode`

---

### Step 4 — Publish to Open VSX

[Open VSX](https://open-vsx.org/) is a vendor-neutral extension registry used by VSCodium, Eclipse Theia, Gitpod, and other VS Code-compatible editors.

#### 4.1 — Create an Open VSX Account

1. Go to [https://open-vsx.org](https://open-vsx.org) and sign in with your GitHub account.
2. Click your avatar → **Settings** → **Access Tokens**.
3. Generate a new token and copy it.

#### 4.2 — Publish with ovsx

Use the `.vsix` file you built in Step 2:

```bash
npx ovsx publish supercollider-vscode-1.0.2.vsix --pat <your-open-vsx-token>
```

Or pass the token via an environment variable to avoid exposing it in your shell history:

```bash
export OVSX_PAT=<your-open-vsx-token>
npx ovsx publish supercollider-vscode-1.0.2.vsix
```

The extension will appear on Open VSX at:
`https://open-vsx.org/extension/rogervila/supercollider-vscode`

---

### Full Release Checklist

Use this checklist every time you cut a new release:

- [ ] Update the version in `package.json` (or let `vsce publish patch/minor/major` do it)
- [ ] Update `CHANGELOG.md` with the new version and a summary of changes
- [ ] Run `npm run lint` — fix any errors
- [ ] Run `npm run compile` — ensure a clean build
- [ ] Run `npm run package` — verify the `.vsix` is created without errors
- [ ] Install and smoke-test the `.vsix` locally: `code --install-extension *.vsix`
- [ ] Publish to VS Code Marketplace: `npx vsce publish`
- [ ] Publish to Open VSX: `npx ovsx publish *.vsix`
- [ ] Tag the release in git: `git tag v1.0.x && git push --tags`

---

## License

MIT

## Author

[Roger Vilà](https://github.com/rogervila)

Built with AI
