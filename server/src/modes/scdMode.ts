/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
	CompletionItem,
	CompletionItemKind,
	CompletionList,
	Position,
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { LanguageMode } from '../languageModes';

// SuperCollider keywords
const SC_KEYWORDS = [
	'var', 'arg', 'classvar', 'const',
	'if', 'while', 'for', 'forBy', 'do', 'loop',
	'case', 'switch',
	'collect', 'select', 'reject', 'detect', 'any', 'every',
	'true', 'false', 'nil', 'inf', 'pi',
	'this', 'super', 'thisProcess', 'thisThread', 'thisFunction', 'thisFunctionDef', 'thisMethod'
];

// Common SuperCollider classes (audio, patterns, collections, etc.)
const SC_CLASSES = [
	// Audio
	'SinOsc', 'Saw', 'Pulse', 'LFSaw', 'LFPulse', 'LFNoise0', 'LFNoise1', 'LFNoise2',
	'WhiteNoise', 'PinkNoise', 'BrownNoise', 'ClipNoise', 'GrayNoise',
	'Dust', 'Dust2', 'Impulse', 'Blip',
	'LPF', 'HPF', 'BPF', 'BRF', 'RLPF', 'RHPF', 'Resonz', 'Ringz',
	'FreeVerb', 'GVerb', 'AllpassN', 'AllpassL', 'AllpassC',
	'CombN', 'CombL', 'CombC', 'DelayN', 'DelayL', 'DelayC',
	'Pan2', 'Balance2', 'LinPan2', 'Splay',
	'EnvGen', 'Env', 'Line', 'XLine', 'Linen',
	'PlayBuf', 'RecordBuf', 'BufRd', 'BufWr', 'Buffer',
	'Out', 'In', 'LocalIn', 'LocalOut', 'ReplaceOut', 'XOut',
	'Mix', 'Limiter', 'Compander', 'Normalizer',
	'MouseX', 'MouseY', 'MouseButton',
	'Lag', 'Lag2', 'Lag3', 'Ramp', 'VarLag',
	'Decay', 'Decay2', 'Integrator', 'LeakDC',
	'Free', 'FreeSelf', 'PauseSelf', 'Done', 'FreeSelfWhenDone',
	// Server
	'Server', 'ServerOptions', 'SynthDef', 'Synth', 'Group', 'Bus',
	// Patterns
	'Pbind', 'Pseq', 'Prand', 'Pxrand', 'Pwrand', 'Pshuf',
	'Pwhite', 'Pexprand', 'Pgauss', 'Plprand', 'Phprand', 'Pmeanrand',
	'Pn', 'Pdef', 'Ppar', 'Ptpar', 'Pgpar', 'Pchain', 'Pkey',
	'Pfunc', 'Prout', 'Plazy', 'Pcollect', 'Pselect', 'Preject',
	'Pstutter', 'Pdup', 'Place', 'Ppatlace', 'Pswitch', 'Pswitch1',
	'EventStreamPlayer', 'Routine', 'Task',
	// Collections
	'Array', 'List', 'LinkedList', 'Set', 'IdentitySet', 'Dictionary', 'IdentityDictionary',
	'Event', 'Environment', 'TempoClock', 'SystemClock', 'AppClock',
	// GUI
	'Window', 'View', 'Slider', 'Knob', 'Button', 'TextField', 'StaticText', 'NumberBox',
	'FreqScope', 'Stethoscope', 'ServerMeter',
	// MIDI
	'MIDIClient', 'MIDIIn', 'MIDIOut', 'MIDIFunc', 'MIDIdef',
	// OSC
	'NetAddr', 'OSCFunc', 'OSCdef',
	// Misc
	'String', 'Symbol', 'Float', 'Integer', 'Boolean', 'Nil', 'Object', 'Function', 'Class',
	'Signal', 'Wavetable', 'FloatArray', 'Int8Array', 'Int16Array', 'Int32Array',
	'File', 'PathName', 'Platform', 'Archive', 'Score',
	'Point', 'Rect', 'Color', 'Pen',
	'Condition', 'Semaphore', 'FlowLayout', 'VLayout', 'HLayout',
];

// Common methods
const SC_METHODS = [
	'play', 'stop', 'free', 'release', 'set', 'get',
	'ar', 'kr', 'ir', 'tr',
	'new', 'newClear', 'newFrom', 'copy', 'deepCopy',
	'add', 'addAll', 'remove', 'removeAt', 'pop', 'push',
	'at', 'put', 'atFail', 'first', 'last', 'size', 'isEmpty',
	'do', 'collect', 'select', 'reject', 'detect', 'any', 'every',
	'sum', 'mean', 'maxItem', 'minItem', 'sort', 'reverse',
	'midicps', 'cpsmidi', 'midiratio', 'ratiomidi', 'ampdb', 'dbamp',
	'linlin', 'linexp', 'explin', 'expexp', 'lincurve', 'curvelin',
	'clip', 'wrap', 'fold', 'round', 'trunc', 'ceil', 'floor', 'abs', 'neg',
	'rand', 'rand2', 'rrand', 'exprand', 'bilinrand', 'linrand',
	'wait', 'yield', 'value', 'valueEnvir', 'valueArray',
	'postln', 'post', 'postf', 'debug', 'trace',
	'asString', 'asSymbol', 'asInteger', 'asFloat', 'asArray',
	'dup', 'blend', 'series', 'geom',
	'scope', 'plot', 'gui',
	'asStream', 'embedInStream', 'reset', 'next', 'nextN', 'all'
];

function getWordAtPosition(document: TextDocument, position: Position): { word: string; start: number } {
	const text = document.getText();
	const offset = document.offsetAt(position);

	let start = offset;
	while (start > 0 && /[a-zA-Z0-9_~]/.test(text.charAt(start - 1))) {
		start--;
	}

	const word = text.substring(start, offset);
	return { word, start };
}

export function getSuperColliderMode(): LanguageMode {
	return {
		getId() {
			return 'supercollider';
		},
		doComplete(document: TextDocument, position: Position): CompletionList {
			const { word } = getWordAtPosition(document, position);
			const items: CompletionItem[] = [];
			const wordLower = word.toLowerCase();

			// Add matching keywords
			for (const kw of SC_KEYWORDS) {
				if (kw.toLowerCase().startsWith(wordLower)) {
					items.push({
						label: kw,
						kind: CompletionItemKind.Keyword,
						detail: 'SuperCollider keyword'
					});
				}
			}

			// Add matching classes
			for (const cls of SC_CLASSES) {
				if (cls.toLowerCase().startsWith(wordLower)) {
					items.push({
						label: cls,
						kind: CompletionItemKind.Class,
						detail: 'SuperCollider class'
					});
				}
			}

			// Add matching methods
			for (const method of SC_METHODS) {
				if (method.toLowerCase().startsWith(wordLower)) {
					items.push({
						label: method,
						kind: CompletionItemKind.Method,
						detail: 'SuperCollider method'
					});
				}
			}

			return CompletionList.create(items, false);
		},
		onDocumentRemoved(_document: TextDocument) { /* nothing to do */ },
		dispose() { /* nothing to do */ }
	};
}
