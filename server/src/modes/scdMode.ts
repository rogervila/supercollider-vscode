/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
	CompletionItem,
	CompletionItemKind,
	CompletionList,
	Hover,
	MarkupKind,
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

// Documentation for keywords
const KEYWORD_DOCS: { [key: string]: string } = {
	'var': '**var** - Declare a local variable\n\n```supercollider\nvar freq = 440, amp = 0.5;\n```',
	'arg': '**arg** - Declare a function argument\n\n```supercollider\n{ arg freq = 440, amp = 0.5; ... }\n```',
	'classvar': '**classvar** - Declare a class variable (shared across all instances)\n\n```supercollider\nclassvar <>default;\n```',
	'const': '**const** - Declare a constant value',
	'if': '**if** - Conditional expression\n\n```supercollider\nif(condition, { trueFunc }, { falseFunc })\n```',
	'while': '**while** - While loop\n\n```supercollider\nwhile({ condition }, { body })\n```',
	'for': '**for** - For loop over integer range\n\n```supercollider\nfor(start, end, { |i| ... })\n```',
	'forBy': '**forBy** - For loop with step\n\n```supercollider\nforBy(start, end, step, { |i| ... })\n```',
	'do': '**do** - Iterate over collection\n\n```supercollider\ncollection.do { |item, index| ... }\n```',
	'loop': '**loop** - Infinite loop\n\n```supercollider\nloop { ... }\n```',
	'case': '**case** - Multiple condition branching\n\n```supercollider\ncase\n  { cond1 } { result1 }\n  { cond2 } { result2 }\n```',
	'switch': '**switch** - Value-based branching\n\n```supercollider\nswitch(value,\n  val1, { result1 },\n  val2, { result2 }\n)\n```',
	'collect': '**collect** - Transform each element\n\n```supercollider\n[1,2,3].collect { |x| x * 2 } // [2,4,6]\n```',
	'select': '**select** - Filter elements matching condition\n\n```supercollider\n[1,2,3,4].select { |x| x.even } // [2,4]\n```',
	'reject': '**reject** - Filter elements not matching condition\n\n```supercollider\n[1,2,3,4].reject { |x| x.even } // [1,3]\n```',
	'detect': '**detect** - Find first matching element\n\n```supercollider\n[1,2,3,4].detect { |x| x > 2 } // 3\n```',
	'any': '**any** - Check if any element matches\n\n```supercollider\n[1,2,3].any { |x| x > 2 } // true\n```',
	'every': '**every** - Check if all elements match\n\n```supercollider\n[1,2,3].every { |x| x > 0 } // true\n```',
	'true': '**true** - Boolean true value',
	'false': '**false** - Boolean false value',
	'nil': '**nil** - Represents no value / null',
	'inf': '**inf** - Positive infinity (Float)',
	'pi': '**pi** - Mathematical constant π (3.14159...)',
	'this': '**this** - Reference to current instance',
	'super': '**super** - Reference to superclass',
	'thisProcess': '**thisProcess** - Current interpreter process',
	'thisThread': '**thisThread** - Current thread / routine',
	'thisFunction': '**thisFunction** - Current function being executed',
	'thisFunctionDef': '**thisFunctionDef** - Current function definition',
	'thisMethod': '**thisMethod** - Current method being executed'
};

// Documentation for classes
const CLASS_DOCS: { [key: string]: string } = {
	// Oscillators
	'SinOsc': '**SinOsc** - Sine wave oscillator\n\n```supercollider\nSinOsc.ar(freq: 440, phase: 0, mul: 1, add: 0)\nSinOsc.kr(freq: 1, phase: 0, mul: 1, add: 0)\n```\n\n**Arguments:**\n- `freq` - Frequency in Hz\n- `phase` - Initial phase (0-2π)\n- `mul` - Output multiplier\n- `add` - Value added to output',
	'Saw': '**Saw** - Band-limited sawtooth oscillator\n\n```supercollider\nSaw.ar(freq: 440, mul: 1, add: 0)\n```\n\n**Arguments:**\n- `freq` - Frequency in Hz\n- `mul` - Output multiplier\n- `add` - Value added to output',
	'Pulse': '**Pulse** - Band-limited pulse wave oscillator\n\n```supercollider\nPulse.ar(freq: 440, width: 0.5, mul: 1, add: 0)\n```\n\n**Arguments:**\n- `freq` - Frequency in Hz\n- `width` - Pulse width (0-1)\n- `mul` - Output multiplier',
	'LFSaw': '**LFSaw** - Non-band-limited sawtooth (for LFO use)\n\n```supercollider\nLFSaw.ar(freq: 440, iphase: 0, mul: 1, add: 0)\n```',
	'LFPulse': '**LFPulse** - Non-band-limited pulse wave (for LFO use)\n\n```supercollider\nLFPulse.ar(freq: 440, iphase: 0, width: 0.5, mul: 1, add: 0)\n```',
	'LFNoise0': '**LFNoise0** - Step noise (sample & hold)\n\n```supercollider\nLFNoise0.ar(freq: 500, mul: 1, add: 0)\n```',
	'LFNoise1': '**LFNoise1** - Linear interpolated noise\n\n```supercollider\nLFNoise1.ar(freq: 500, mul: 1, add: 0)\n```',
	'LFNoise2': '**LFNoise2** - Quadratic interpolated noise\n\n```supercollider\nLFNoise2.ar(freq: 500, mul: 1, add: 0)\n```',

	// Noise
	'WhiteNoise': '**WhiteNoise** - White noise generator\n\n```supercollider\nWhiteNoise.ar(mul: 1, add: 0)\n```',
	'PinkNoise': '**PinkNoise** - Pink noise (1/f spectrum)\n\n```supercollider\nPinkNoise.ar(mul: 1, add: 0)\n```',
	'BrownNoise': '**BrownNoise** - Brown noise (1/f² spectrum)\n\n```supercollider\nBrownNoise.ar(mul: 1, add: 0)\n```',
	'Dust': '**Dust** - Random impulses (0 to +1)\n\n```supercollider\nDust.ar(density: 1, mul: 1, add: 0)\n```\n\n**Arguments:**\n- `density` - Average impulses per second',
	'Impulse': '**Impulse** - Non-band-limited impulse oscillator\n\n```supercollider\nImpulse.ar(freq: 440, phase: 0, mul: 1, add: 0)\n```',

	// Filters
	'LPF': '**LPF** - 2nd order Butterworth low pass filter\n\n```supercollider\nLPF.ar(in, freq: 440, mul: 1, add: 0)\n```\n\n**Arguments:**\n- `in` - Input signal\n- `freq` - Cutoff frequency in Hz',
	'HPF': '**HPF** - 2nd order Butterworth high pass filter\n\n```supercollider\nHPF.ar(in, freq: 440, mul: 1, add: 0)\n```',
	'BPF': '**BPF** - 2nd order Butterworth band pass filter\n\n```supercollider\nBPF.ar(in, freq: 440, rq: 1, mul: 1, add: 0)\n```\n\n**Arguments:**\n- `in` - Input signal\n- `freq` - Center frequency\n- `rq` - Reciprocal of Q (bandwidth/centerFreq)',
	'RLPF': '**RLPF** - Resonant low pass filter\n\n```supercollider\nRLPF.ar(in, freq: 440, rq: 1, mul: 1, add: 0)\n```',
	'RHPF': '**RHPF** - Resonant high pass filter\n\n```supercollider\nRHPF.ar(in, freq: 440, rq: 1, mul: 1, add: 0)\n```',
	'Resonz': '**Resonz** - Resonant filter\n\n```supercollider\nResonz.ar(in, freq: 440, bwr: 1, mul: 1, add: 0)\n```',

	// Reverb & Delay
	'FreeVerb': '**FreeVerb** - Schroeder reverb\n\n```supercollider\nFreeVerb.ar(in, mix: 0.33, room: 0.5, damp: 0.5, mul: 1, add: 0)\n```\n\n**Arguments:**\n- `in` - Input signal\n- `mix` - Dry/wet mix (0-1)\n- `room` - Room size (0-1)\n- `damp` - High frequency damping (0-1)',
	'DelayN': '**DelayN** - Simple delay (no interpolation)\n\n```supercollider\nDelayN.ar(in, maxdelaytime: 0.2, delaytime: 0.2, mul: 1, add: 0)\n```',
	'DelayL': '**DelayL** - Delay with linear interpolation\n\n```supercollider\nDelayL.ar(in, maxdelaytime: 0.2, delaytime: 0.2, mul: 1, add: 0)\n```',
	'CombN': '**CombN** - Comb delay (feedback delay)\n\n```supercollider\nCombN.ar(in, maxdelaytime: 0.2, delaytime: 0.2, decaytime: 1, mul: 1, add: 0)\n```',
	'AllpassN': '**AllpassN** - Allpass delay (for diffusion)\n\n```supercollider\nAllpassN.ar(in, maxdelaytime: 0.2, delaytime: 0.2, decaytime: 1, mul: 1, add: 0)\n```',

	// Panning
	'Pan2': '**Pan2** - Stereo panner\n\n```supercollider\nPan2.ar(in, pos: 0, level: 1)\n```\n\n**Arguments:**\n- `in` - Input signal (mono)\n- `pos` - Pan position (-1 left, 0 center, +1 right)\n- `level` - Output amplitude',
	'Splay': '**Splay** - Spread channels across stereo field\n\n```supercollider\nSplay.ar(inArray, spread: 1, level: 1, center: 0, levelComp: true)\n```',

	// Envelopes
	'EnvGen': '**EnvGen** - Envelope generator\n\n```supercollider\nEnvGen.ar(envelope, gate: 1, levelScale: 1, levelBias: 0, timeScale: 1, doneAction: 0)\nEnvGen.kr(envelope, gate: 1, levelScale: 1, levelBias: 0, timeScale: 1, doneAction: 0)\n```\n\n**Arguments:**\n- `envelope` - An Env instance\n- `gate` - Trigger/gate signal\n- `doneAction` - Action when envelope completes (2 = free synth)',
	'Env': '**Env** - Envelope specification\n\n```supercollider\nEnv.new(levels, times, curves)\nEnv.perc(attackTime: 0.01, releaseTime: 1, level: 1, curve: -4)\nEnv.adsr(attackTime: 0.01, decayTime: 0.3, sustainLevel: 0.5, releaseTime: 1)\nEnv.asr(attackTime: 0.01, sustainLevel: 1, releaseTime: 1)\nEnv.linen(attackTime: 0.01, sustainTime: 1, releaseTime: 1, level: 1)\n```',
	'Line': '**Line** - Line generator\n\n```supercollider\nLine.ar(start: 0, end: 1, dur: 1, mul: 1, add: 0, doneAction: 0)\n```',
	'XLine': '**XLine** - Exponential line generator\n\n```supercollider\nXLine.ar(start: 1, end: 2, dur: 1, mul: 1, add: 0, doneAction: 0)\n```',

	// Buffers
	'Buffer': '**Buffer** - Buffer for audio data\n\n```supercollider\nBuffer.alloc(server, numFrames, numChannels: 1, completionMessage)\nBuffer.read(server, path, startFrame: 0, numFrames: -1, action, bufnum)\n```',
	'PlayBuf': '**PlayBuf** - Play audio from buffer\n\n```supercollider\nPlayBuf.ar(numChannels, bufnum: 0, rate: 1, trigger: 1, startPos: 0, loop: 0, doneAction: 0)\n```',
	'RecordBuf': '**RecordBuf** - Record audio to buffer\n\n```supercollider\nRecordBuf.ar(inputArray, bufnum: 0, offset: 0, recLevel: 1, preLevel: 0, run: 1, loop: 1, trigger: 1, doneAction: 0)\n```',

	// I/O
	'Out': '**Out** - Write signal to bus\n\n```supercollider\nOut.ar(bus, channelsArray)\nOut.kr(bus, channelsArray)\n```\n\n**Arguments:**\n- `bus` - Bus index to write to\n- `channelsArray` - Signal or array of signals',
	'In': '**In** - Read signal from bus\n\n```supercollider\nIn.ar(bus, numChannels: 1)\nIn.kr(bus, numChannels: 1)\n```',
	'LocalIn': '**LocalIn** - Read from local bus (for feedback)\n\n```supercollider\nLocalIn.ar(numChannels: 1, default: 0)\n```',
	'LocalOut': '**LocalOut** - Write to local bus (for feedback)\n\n```supercollider\nLocalOut.ar(channelsArray)\n```',

	// Server & Synths
	'Server': '**Server** - Represents a SuperCollider server\n\n```supercollider\nServer.default\nServer.local\ns.boot\ns.quit\n```',
	'SynthDef': '**SynthDef** - Synth definition\n\n```supercollider\nSynthDef(\\name, { arg out = 0, freq = 440;\n    var sig = SinOsc.ar(freq);\n    Out.ar(out, sig);\n}).add;\n```',
	'Synth': '**Synth** - Create a synth instance\n\n```supercollider\nSynth(\\defName, [\\param, value, ...])\nSynth(\\defName, [\\param, value], target, addAction)\n```',
	'Group': '**Group** - Container for synths\n\n```supercollider\nGroup.new(target, addAction: \\addToHead)\n```',
	'Bus': '**Bus** - Audio or control bus\n\n```supercollider\nBus.audio(server, numChannels: 1)\nBus.control(server, numChannels: 1)\n```',

	// Patterns
	'Pbind': '**Pbind** - Bind keys to value patterns\n\n```supercollider\nPbind(\n    \\instrument, \\default,\n    \\degree, Pseq([0, 2, 4, 5, 7], inf),\n    \\dur, 0.25\n).play;\n```',
	'Pseq': '**Pseq** - Sequential pattern\n\n```supercollider\nPseq(list, repeats: 1, offset: 0)\n```\n\n**Arguments:**\n- `list` - Array of values\n- `repeats` - Number of times to repeat (inf for infinite)',
	'Prand': '**Prand** - Random selection from list\n\n```supercollider\nPrand(list, repeats: 1)\n```',
	'Pxrand': '**Pxrand** - Random selection, never repeating\n\n```supercollider\nPxrand(list, repeats: 1)\n```',
	'Pwrand': '**Pwrand** - Weighted random selection\n\n```supercollider\nPwrand(list, weights, repeats: 1)\n```',
	'Pwhite': '**Pwhite** - White noise pattern (uniform distribution)\n\n```supercollider\nPwhite(lo: 0, hi: 1, length: inf)\n```',
	'Pexprand': '**Pexprand** - Exponential random pattern\n\n```supercollider\nPexprand(lo: 0.01, hi: 1, length: inf)\n```',
	'Pn': '**Pn** - Repeat a pattern n times\n\n```supercollider\nPn(pattern, repeats: inf, key)\n```',
	'Pdef': '**Pdef** - Pattern definition (live-codable)\n\n```supercollider\nPdef(\\name, pattern)\nPdef(\\name).play\nPdef(\\name).stop\n```',
	'Routine': '**Routine** - Pauseable function\n\n```supercollider\nRoutine({ loop { 1.yield; "tick".postln } }).play;\n```',
	'Task': '**Task** - Pauseable process\n\n```supercollider\nTask({ loop { 1.wait; "tick".postln } }).play;\n```',

	// Collections
	'Array': '**Array** - Ordered collection\n\n```supercollider\nArray.new(size)\nArray.fill(size, function)\n[1, 2, 3, 4, 5]\n```',
	'List': '**List** - Growable ordered collection\n\n```supercollider\nList.new\nList[1, 2, 3]\n```',
	'Dictionary': '**Dictionary** - Key-value collection\n\n```supercollider\nDictionary.new\nDictionary[\\key -> value]\n```',
	'Event': '**Event** - Dictionary with default values\n\n```supercollider\n(freq: 440, amp: 0.5).play\n```',
	'Environment': '**Environment** - Named variable space\n\n```supercollider\n~myVar = 440;\ncurrentEnvironment;\n```',

	// Clocks
	'TempoClock': '**TempoClock** - Tempo-based scheduler\n\n```supercollider\nTempoClock.default.tempo = 2; // 120 BPM\nTempoClock.new(tempo: 1, beats: 0, seconds)\n```',
	'SystemClock': '**SystemClock** - System scheduler (seconds)\n\n```supercollider\nSystemClock.sched(delay, function)\n```',
	'AppClock': '**AppClock** - Application scheduler (for GUI)\n\n```supercollider\nAppClock.sched(delay, function)\n```',

	// GUI
	'Window': '**Window** - GUI window\n\n```supercollider\nWindow.new("Title", Rect(100, 100, 400, 300)).front;\n```',
	'Slider': '**Slider** - GUI slider\n\n```supercollider\nSlider(parent, bounds).action_({ |sl| sl.value.postln });\n```',
	'Button': '**Button** - GUI button\n\n```supercollider\nButton(parent, bounds).states_([[\"Off\"], [\"On\"]]).action_({ |b| b.value.postln });\n```',
	'Knob': '**Knob** - GUI rotary knob\n\n```supercollider\nKnob(parent, bounds).action_({ |k| k.value.postln });\n```',

	// MIDI & OSC
	'MIDIClient': '**MIDIClient** - MIDI system interface\n\n```supercollider\nMIDIClient.init;\nMIDIClient.sources;\nMIDIClient.destinations;\n```',
	'MIDIIn': '**MIDIIn** - MIDI input\n\n```supercollider\nMIDIIn.connectAll;\n```',
	'MIDIFunc': '**MIDIFunc** - MIDI responder function\n\n```supercollider\nMIDIFunc.noteOn({ |vel, note| [note, vel].postln });\nMIDIFunc.cc({ |val, num| [num, val].postln });\n```',
	'NetAddr': '**NetAddr** - Network address for OSC\n\n```supercollider\nNetAddr("127.0.0.1", 57120)\nNetAddr.localAddr\n```',
	'OSCFunc': '**OSCFunc** - OSC responder function\n\n```supercollider\nOSCFunc({ |msg| msg.postln }, \'/address\');\n```',

	// Control
	'Lag': '**Lag** - Exponential lag (smoothing)\n\n```supercollider\nLag.ar(in, lagTime: 0.1)\nLag.kr(in, lagTime: 0.1)\n```',
	'Mix': '**Mix** - Mix array of channels to mono\n\n```supercollider\nMix.ar(array)\nMix.fill(n, function)\n```',
	'MouseX': '**MouseX** - Mouse X position\n\n```supercollider\nMouseX.kr(minval: 0, maxval: 1, warp: 0, lag: 0.2)\n```',
	'MouseY': '**MouseY** - Mouse Y position\n\n```supercollider\nMouseY.kr(minval: 0, maxval: 1, warp: 0, lag: 0.2)\n```',
};

// Documentation for methods
const METHOD_DOCS: { [key: string]: string } = {
	'play': '**play** - Start playing\n\n```supercollider\n{ SinOsc.ar(440) }.play;      // Play function as synth\nPbind(...).play;               // Play pattern\nRoutine({ ... }).play;         // Play routine\n```',
	'stop': '**stop** - Stop playing\n\n```supercollider\nx.stop;  // Stop a playing object\n```',
	'free': '**free** - Free a synth/node\n\n```supercollider\nx.free;  // Free synth x\n```',
	'release': '**release** - Release with envelope\n\n```supercollider\nx.release(releaseTime);  // Release synth over time\n```',
	'set': '**set** - Set synth parameters\n\n```supercollider\nx.set(\\freq, 880, \\amp, 0.5);\n```',
	'get': '**get** - Get synth parameter value\n\n```supercollider\nx.get(\\freq, { |val| val.postln });\n```',
	'ar': '**ar** - Audio rate (sample rate)\n\n```supercollider\nSinOsc.ar(440)  // 44100 Hz sample rate\n```',
	'kr': '**kr** - Control rate (audio rate / 64)\n\n```supercollider\nSinOsc.kr(1)  // ~689 Hz for modulation\n```',
	'ir': '**ir** - Initialization rate (once at start)\n\n```supercollider\nRand.ir(0, 1)  // Random value set once\n```',
	'new': '**new** - Create new instance\n\n```supercollider\nArray.new(10);\nSynth.new(\\synthName);\n```',
	'add': '**add** - Add to collection / Add SynthDef to server\n\n```supercollider\nlist.add(item);\nSynthDef(\\name, {...}).add;\n```',
	'do': '**do** - Iterate over collection\n\n```supercollider\n[1,2,3].do { |item, i| item.postln };\n10.do { |i| i.postln };\n```',
	'collect': '**collect** - Transform each element\n\n```supercollider\n[1,2,3].collect { |x| x * 2 }  // [2,4,6]\n```',
	'select': '**select** - Filter matching elements\n\n```supercollider\n[1,2,3,4].select { |x| x.even }  // [2,4]\n```',
	'reject': '**reject** - Filter non-matching elements\n\n```supercollider\n[1,2,3,4].reject { |x| x.even }  // [1,3]\n```',
	'midicps': '**midicps** - MIDI note to frequency (Hz)\n\n```supercollider\n69.midicps  // 440.0 (A4)\n60.midicps  // 261.6256 (C4)\n```',
	'cpsmidi': '**cpsmidi** - Frequency (Hz) to MIDI note\n\n```supercollider\n440.cpsmidi  // 69.0 (A4)\n```',
	'linlin': '**linlin** - Linear to linear mapping\n\n```supercollider\nvalue.linlin(inMin, inMax, outMin, outMax)\n0.5.linlin(0, 1, 100, 200)  // 150\n```',
	'linexp': '**linexp** - Linear to exponential mapping\n\n```supercollider\nvalue.linexp(inMin, inMax, outMin, outMax)\n0.5.linexp(0, 1, 20, 20000)  // 632.5\n```',
	'explin': '**explin** - Exponential to linear mapping\n\n```supercollider\nvalue.explin(inMin, inMax, outMin, outMax)\n```',
	'clip': '**clip** - Constrain to range\n\n```supercollider\nvalue.clip(min, max)\n150.clip(0, 100)  // 100\n```',
	'wrap': '**wrap** - Wrap value to range\n\n```supercollider\nvalue.wrap(min, max)\n5.wrap(0, 4)  // 1\n```',
	'fold': '**fold** - Fold value at boundaries\n\n```supercollider\nvalue.fold(min, max)\n5.fold(0, 4)  // 3\n```',
	'rand': '**rand** - Random value from 0 to receiver\n\n```supercollider\n100.rand  // Random 0-99\n1.0.rand  // Random 0.0-1.0\n```',
	'rrand': '**rrand** - Random in range\n\n```supercollider\nrrand(10, 20)  // Random 10-20\n```',
	'postln': '**postln** - Post to console with newline\n\n```supercollider\n"Hello".postln;\nvalue.postln;\n```',
	'wait': '**wait** - Wait seconds in Routine/Task\n\n```supercollider\nRoutine({ 1.wait; "done".postln }).play;\n```',
	'yield': '**yield** - Yield value from Routine\n\n```supercollider\nRoutine({ 1.yield; 2.yield }).nextN(2)  // [1, 2]\n```',
	'value': '**value** - Evaluate function\n\n```supercollider\n{ |x| x * 2 }.value(5)  // 10\n```',
	'dup': '**dup** - Duplicate n times\n\n```supercollider\n5.dup(3)  // [5, 5, 5]\nSinOsc.ar(440).dup  // Stereo\n```',
	'scope': '**scope** - Show oscilloscope\n\n```supercollider\n{ SinOsc.ar(440) }.scope;\n```',
	'plot': '**plot** - Plot signal/array\n\n```supercollider\n{ SinOsc.ar(440) }.plot(0.01);\n[1,2,3,2,1].plot;\n```',
	'asStream': '**asStream** - Convert pattern to stream\n\n```supercollider\nPseq([1,2,3]).asStream.next  // 1\n```',
	'next': '**next** - Get next value from stream\n\n```supercollider\nstream.next\nstream.next(inval)\n```',
	'reset': '**reset** - Reset stream to beginning\n\n```supercollider\nstream.reset;\n```',
	'size': '**size** - Number of elements\n\n```supercollider\n[1,2,3].size  // 3\n```',
	'first': '**first** - First element\n\n```supercollider\n[1,2,3].first  // 1\n```',
	'last': '**last** - Last element\n\n```supercollider\n[1,2,3].last  // 3\n```',
	'sum': '**sum** - Sum of elements\n\n```supercollider\n[1,2,3].sum  // 6\n```',
	'mean': '**mean** - Average of elements\n\n```supercollider\n[1,2,3].mean  // 2.0\n```',
	'sort': '**sort** - Sort elements\n\n```supercollider\n[3,1,2].sort  // [1,2,3]\n```',
	'reverse': '**reverse** - Reverse order\n\n```supercollider\n[1,2,3].reverse  // [3,2,1]\n```',
};

// Common SuperCollider classes (audio, patterns, collections, etc.)
const SC_CLASSES = [
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
	'Server', 'ServerOptions', 'SynthDef', 'Synth', 'Group', 'Bus',
	'Pbind', 'Pseq', 'Prand', 'Pxrand', 'Pwrand', 'Pshuf',
	'Pwhite', 'Pexprand', 'Pgauss', 'Plprand', 'Phprand', 'Pmeanrand',
	'Pn', 'Pdef', 'Ppar', 'Ptpar', 'Pgpar', 'Pchain', 'Pkey',
	'Pfunc', 'Prout', 'Plazy', 'Pcollect', 'Pselect', 'Preject',
	'Pstutter', 'Pdup', 'Place', 'Ppatlace', 'Pswitch', 'Pswitch1',
	'EventStreamPlayer', 'Routine', 'Task',
	'Array', 'List', 'LinkedList', 'Set', 'IdentitySet', 'Dictionary', 'IdentityDictionary',
	'Event', 'Environment', 'TempoClock', 'SystemClock', 'AppClock',
	'Window', 'View', 'Slider', 'Knob', 'Button', 'TextField', 'StaticText', 'NumberBox',
	'FreqScope', 'Stethoscope', 'ServerMeter',
	'MIDIClient', 'MIDIIn', 'MIDIOut', 'MIDIFunc', 'MIDIdef',
	'NetAddr', 'OSCFunc', 'OSCdef',
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

function getWordAtPosition(document: TextDocument, position: Position): { word: string; start: number; end: number } {
	const text = document.getText();
	const offset = document.offsetAt(position);

	let start = offset;
	while (start > 0 && /[a-zA-Z0-9_~]/.test(text.charAt(start - 1))) {
		start--;
	}

	let end = offset;
	while (end < text.length && /[a-zA-Z0-9_]/.test(text.charAt(end))) {
		end++;
	}

	const word = text.substring(start, end);
	return { word, start, end };
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
						detail: 'SuperCollider keyword',
						documentation: KEYWORD_DOCS[kw]
					});
				}
			}

			// Add matching classes
			for (const cls of SC_CLASSES) {
				if (cls.toLowerCase().startsWith(wordLower)) {
					items.push({
						label: cls,
						kind: CompletionItemKind.Class,
						detail: 'SuperCollider class',
						documentation: CLASS_DOCS[cls]
					});
				}
			}

			// Add matching methods
			for (const method of SC_METHODS) {
				if (method.toLowerCase().startsWith(wordLower)) {
					items.push({
						label: method,
						kind: CompletionItemKind.Method,
						detail: 'SuperCollider method',
						documentation: METHOD_DOCS[method]
					});
				}
			}

			return CompletionList.create(items, false);
		},
		doHover(document: TextDocument, position: Position): Hover | null {
			const { word, start, end } = getWordAtPosition(document, position);

			if (!word) {
				return null;
			}

			// Check keywords
			if (KEYWORD_DOCS[word]) {
				return {
					contents: {
						kind: MarkupKind.Markdown,
						value: KEYWORD_DOCS[word]
					},
					range: {
						start: document.positionAt(start),
						end: document.positionAt(end)
					}
				};
			}

			// Check classes
			if (CLASS_DOCS[word]) {
				return {
					contents: {
						kind: MarkupKind.Markdown,
						value: CLASS_DOCS[word]
					},
					range: {
						start: document.positionAt(start),
						end: document.positionAt(end)
					}
				};
			}

			// Check methods
			if (METHOD_DOCS[word]) {
				return {
					contents: {
						kind: MarkupKind.Markdown,
						value: METHOD_DOCS[word]
					},
					range: {
						start: document.positionAt(start),
						end: document.positionAt(end)
					}
				};
			}

			return null;
		},
		onDocumentRemoved(_document: TextDocument) { /* nothing to do */ },
		dispose() { /* nothing to do */ }
	};
}
