# SuperCollider Language Server for Visual Studio Code

A Visual Studio Code extension providing language support for [SuperCollider](https://supercollider.github.io/), an audio synthesis and algorithmic composition platform.

## Features

- **Syntax Highlighting** for SuperCollider code (`.scd` and `.sc` files)
  - Comments (line `//` and block `/* */`)
  - Strings, symbols, and characters
  - Numbers (integers, floats, hex, radix notation)
  - Classes, keywords, and operators
  - Environment variables (`~varName`)

- **Code Completion** for:
  - Keywords (`var`, `arg`, `if`, `while`, etc.)
  - Built-in classes (`SinOsc`, `Array`, `Pbind`, etc.)
  - Common methods (`play`, `ar`, `kr`, `do`, etc.)

- **Editor Features**:
  - Auto-closing brackets and quotes
  - Block commenting
  - Code folding

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
