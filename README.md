# SuperCollider Language Server for Visual Studio Code

> **⚠ Note**: This extension is still in development and is not yet stable.

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

## License

MIT


## Author

[Roger Vilà](https://github.com/rogervila)

Built with AI
