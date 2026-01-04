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
import { LanguageMode } from '../languagemodes';

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
	'Blip': '**Blip** - Band-limited impulse train (harmonic series)\n\n```supercollider\nBlip.ar(freq: 440, numharm: 200, mul: 1, add: 0)\n```\n\n**Arguments:**\n- `freq` - Frequency in Hz\n- `numharm` - Number of harmonics',
	'Formant': '**Formant** - Formant oscillator\n\n```supercollider\nFormant.ar(fundfreq: 200, formfreq: 800, bwfreq: 400, mul: 1, add: 0)\n```\n\n**Arguments:**\n- `fundfreq` - Fundamental frequency\n- `formfreq` - Formant frequency\n- `bwfreq` - Bandwidth frequency',
	'Klang': '**Klang** - Bank of sine oscillators\n\n```supercollider\nKlang.ar(specificationsArrayRef, freqscale: 1, freqoffset: 0, phasescale: 0)\n```',
	'VOsc': '**VOsc** - Variable wavetable oscillator\n\n```supercollider\nVOsc.ar(bufpos: 0, freq: 440, mul: 1, add: 0)\n```',
	'VOsc3': '**VOsc3** - Three variable wavetable oscillators\n\n```supercollider\nVOsc3.ar(bufpos: 0, freq1: 440, freq2: 441, freq3: 442, mul: 1, add: 0)\n```',
	'FSinOsc': '**FSinOsc** - Fast sine oscillator\n\n```supercollider\nFSinOsc.ar(freq: 440, iphase: 0, mul: 1, add: 0)\n```',
	'PMOsc': '**PMOsc** - Phase modulation oscillator\n\n```supercollider\nPMOsc.ar(carfreq: 440, modfreq: 200, pmindex: 0, modphase: 0, mul: 1, add: 0)\n```\n\n**Arguments:**\n- `carfreq` - Carrier frequency\n- `modfreq` - Modulator frequency\n- `pmindex` - Phase modulation index',
	'COsc': '**COsc** - Chorused wavetable oscillator\n\n```supercollider\nCOsc.ar(bufnum: 0, freq: 440, beats: 0.5, mul: 1, add: 0)\n```',
	'Gendy1': '**Gendy1** - Dynamic stochastic synthesis\n\n```supercollider\nGendy1.ar(ampdist: 1, durdist: 1, adparam: 1, ddparam: 1, minfreq: 20, maxfreq: 1000, ampscale: 0.5, durscale: 0.5, initCPs: 12, knum: 12, mul: 1, add: 0)\n```',
	'Gendy2': '**Gendy2** - Dynamic stochastic synthesis (improved)\n\n```supercollider\nGendy2.ar(ampdist: 1, durdist: 1, adparam: 1, ddparam: 1, minfreq: 20, maxfreq: 1000, ampscale: 0.5, durscale: 0.5, initCPs: 12, knum: 12, mul: 1, add: 0)\n```',
	'Gendy3': '**Gendy3** - Dynamic stochastic synthesis (memory)\n\n```supercollider\nGendy3.ar(ampdist: 1, durdist: 1, adparam: 1, ddparam: 1, minfreq: 20, maxfreq: 1000, ampscale: 0.5, durscale: 0.5, initCPs: 12, knum: 12, mul: 1, add: 0)\n```',

	// Noise
	'WhiteNoise': '**WhiteNoise** - White noise generator\n\n```supercollider\nWhiteNoise.ar(mul: 1, add: 0)\n```',
	'PinkNoise': '**PinkNoise** - Pink noise (1/f spectrum)\n\n```supercollider\nPinkNoise.ar(mul: 1, add: 0)\n```',
	'BrownNoise': '**BrownNoise** - Brown noise (1/f² spectrum)\n\n```supercollider\nBrownNoise.ar(mul: 1, add: 0)\n```',
	'ClipNoise': '**ClipNoise** - Clipped noise (random -1 or +1)\n\n```supercollider\nClipNoise.ar(mul: 1, add: 0)\n```',
	'GrayNoise': '**GrayNoise** - Gray noise (random -1 to +1)\n\n```supercollider\nGrayNoise.ar(mul: 1, add: 0)\n```',
	'Dust': '**Dust** - Random impulses (0 to +1)\n\n```supercollider\nDust.ar(density: 1, mul: 1, add: 0)\n```\n\n**Arguments:**\n- `density` - Average impulses per second',
	'Dust2': '**Dust2** - Random impulses (-1 to +1)\n\n```supercollider\nDust2.ar(density: 1, mul: 1, add: 0)\n```',
	'Crackle': '**Crackle** - Chaotic noise generator\n\n```supercollider\nCrackle.ar(chaosParam: 1.5, mul: 1, add: 0)\n```',
	'Logistic': '**Logistic** - Chaotic map generator\n\n```supercollider\nLogistic.ar(chaosParam: 3, freq: 1000, init: 0.5, mul: 1, add: 0)\n```',
	'Impulse': '**Impulse** - Non-band-limited impulse oscillator\n\n```supercollider\nImpulse.ar(freq: 440, phase: 0, mul: 1, add: 0)\n```',

	// Triggers (from Trig.sc)
	'Stepper': '**Stepper** - Trigger-based counter\n\n```supercollider\nStepper.ar(trig, reset: 0, min: 0, max: 7, step: 1, resetval: 0)\nStepper.kr(trig, reset: 0, min: 0, max: 7, step: 1, resetval: 0)\n```\n\n**Arguments:**\n- `trig` - Trigger signal (increments counter)\n- `reset` - Reset trigger (resets to resetval)\n- `min` - Minimum value\n- `max` - Maximum value\n- `step` - Step size (default: 1)\n- `resetval` - Value to reset to (default: 0)',
	'PulseDivider': '**PulseDivider** - Divide trigger stream\n\n```supercollider\nPulseDivider.ar(trig, div: 2, start: 0)\nPulseDivider.kr(trig, div: 2, start: 0)\n```\n\n**Arguments:**\n- `trig` - Input trigger signal\n- `div` - Division factor (output every nth trigger)\n- `start` - Starting count value (default: 0)',
	'Trig1': '**Trig1** - Trigger hold (1 sample)\n\n```supercollider\nTrig1.ar(in, dur: 0.1)\nTrig1.kr(in, dur: 0.1)\n```',
	'TDelay': '**TDelay** - Trigger delay\n\n```supercollider\nTDelay.ar(trig, delaytime: 0.1)\nTDelay.kr(trig, delaytime: 0.1)\n```',
	'TDuty': '**TDuty** - Time-based duty cycle\n\n```supercollider\nTDuty.ar(dur: 0.1, reset: 0, level: 1, doneAction: 0, gapFirst: 0)\nTDuty.kr(dur: 0.1, reset: 0, level: 1, doneAction: 0, gapFirst: 0)\n```',
	'SendTrig': '**SendTrig** - Send trigger to client\n\n```supercollider\nSendTrig.ar(in, id: 0, value: 0)\nSendTrig.kr(in, id: 0, value: 0)\n```',
	'Latch': '**Latch** - Sample and hold\n\n```supercollider\nLatch.ar(in, trig)\nLatch.kr(in, trig)\n```',
	'Gate': '**Gate** - Gate signal\n\n```supercollider\nGate.ar(in, gate: 1)\nGate.kr(in, gate: 1)\n```',
	'Trig': '**Trig** - Trigger hold\n\n```supercollider\nTrig.ar(in, dur: 0.1)\nTrig.kr(in, dur: 0.1)\n```',
	'Timer': '**Timer** - Time since last trigger\n\n```supercollider\nTimer.ar(trig)\nTimer.kr(trig)\n```',
	'Sweep': '**Sweep** - Triggered linear ramp\n\n```supercollider\nSweep.ar(trig, rate: 1)\nSweep.kr(trig, rate: 1)\n```',
	'Phasor': '**Phasor** - Phase ramp generator\n\n```supercollider\nPhasor.ar(trig: 0, rate: 1, start: 0, end: 1, resetPos: 0)\nPhasor.kr(trig: 0, rate: 1, start: 0, end: 1, resetPos: 0)\n```',
	'Peak': '**Peak** - Track peak amplitude\n\n```supercollider\nPeak.ar(in, trig: 0)\nPeak.kr(in, trig: 0)\n```',
	'RunningMin': '**RunningMin** - Track minimum value\n\n```supercollider\nRunningMin.ar(in, trig: 0)\nRunningMin.kr(in, trig: 0)\n```',
	'RunningMax': '**RunningMax** - Track maximum value\n\n```supercollider\nRunningMax.ar(in, trig: 0)\nRunningMax.kr(in, trig: 0)\n```',

	// Filters
	'LPF': '**LPF** - 2nd order Butterworth low pass filter\n\n```supercollider\nLPF.ar(in, freq: 440, mul: 1, add: 0)\n```\n\n**Arguments:**\n- `in` - Input signal\n- `freq` - Cutoff frequency in Hz',
	'HPF': '**HPF** - 2nd order Butterworth high pass filter\n\n```supercollider\nHPF.ar(in, freq: 440, mul: 1, add: 0)\n```',
	'BPF': '**BPF** - 2nd order Butterworth band pass filter\n\n```supercollider\nBPF.ar(in, freq: 440, rq: 1, mul: 1, add: 0)\n```\n\n**Arguments:**\n- `in` - Input signal\n- `freq` - Center frequency\n- `rq` - Reciprocal of Q (bandwidth/centerFreq)',
	'RLPF': '**RLPF** - Resonant low pass filter\n\n```supercollider\nRLPF.ar(in, freq: 440, rq: 1, mul: 1, add: 0)\n```',
	'RHPF': '**RHPF** - Resonant high pass filter\n\n```supercollider\nRHPF.ar(in, freq: 440, rq: 1, mul: 1, add: 0)\n```',
	'Resonz': '**Resonz** - Resonant filter\n\n```supercollider\nResonz.ar(in, freq: 440, bwr: 1, mul: 1, add: 0)\n```',
	'BRF': '**BRF** - 2nd order Butterworth band reject filter\n\n```supercollider\nBRF.ar(in, freq: 440, rq: 1, mul: 1, add: 0)\n```',
	'Ringz': '**Ringz** - Ringing filter\n\n```supercollider\nRingz.ar(in, freq: 440, decaytime: 1, mul: 1, add: 0)\n```',
	'Formlet': '**Formlet** - Formant filter\n\n```supercollider\nFormlet.ar(in, freq: 440, attacktime: 1, decaytime: 1, mul: 1, add: 0)\n```',
	'Median': '**Median** - Median filter\n\n```supercollider\nMedian.ar(length: 3, in, mul: 1, add: 0)\n```',
	'MedianFilter': '**MedianFilter** - Median filter (alternative)\n\n```supercollider\nMedianFilter.ar(length: 3, in, mul: 1, add: 0)\n```',
	'MoogFF': '**MoogFF** - Moog-style low pass filter\n\n```supercollider\nMoogFF.ar(in, freq: 440, gain: 2, reset: 0, mul: 1, add: 0)\n```',
	'DFM1': '**DFM1** - Digital filter model 1\n\n```supercollider\nDFM1.ar(in, freq: 1000, res: 0.1, inputgain: 1, type: 0, noiselevel: 0, mul: 1, add: 0)\n```',
	'FOS': '**FOS** - First order section filter\n\n```supercollider\nFOS.ar(in, a0: 0, a1: 0, b1: 0, mul: 1, add: 0)\n```',
	'SOS': '**SOS** - Second order section filter\n\n```supercollider\nSOS.ar(in, a0: 0, a1: 0, a2: 0, b1: 0, b2: 0, mul: 1, add: 0)\n```',
	'TwoPole': '**TwoPole** - Two pole filter\n\n```supercollider\nTwoPole.ar(in, freq: 440, radius: 0.8, mul: 1, add: 0)\n```',
	'TwoZero': '**TwoZero** - Two zero filter\n\n```supercollider\nTwoZero.ar(in, freq: 440, radius: 0.8, mul: 1, add: 0)\n```',
	'OnePole': '**OnePole** - One pole filter\n\n```supercollider\nOnePole.ar(in, coef: 0.5, mul: 1, add: 0)\n```',
	'OneZero': '**OneZero** - One zero filter\n\n```supercollider\nOneZero.ar(in, coef: 0.5, mul: 1, add: 0)\n```',
	'Integrator': '**Integrator** - Leaky integrator\n\n```supercollider\nIntegrator.ar(in, coef: 1, mul: 1, add: 0)\n```',
	'LeakDC': '**LeakDC** - Remove DC offset\n\n```supercollider\nLeakDC.ar(in, coef: 0.995, mul: 1, add: 0)\n```',

	// Reverb & Delay
	'FreeVerb': '**FreeVerb** - Schroeder reverb\n\n```supercollider\nFreeVerb.ar(in, mix: 0.33, room: 0.5, damp: 0.5, mul: 1, add: 0)\n```\n\n**Arguments:**\n- `in` - Input signal\n- `mix` - Dry/wet mix (0-1)\n- `room` - Room size (0-1)\n- `damp` - High frequency damping (0-1)',
	'DelayN': '**DelayN** - Simple delay (no interpolation)\n\n```supercollider\nDelayN.ar(in, maxdelaytime: 0.2, delaytime: 0.2, mul: 1, add: 0)\n```',
	'DelayL': '**DelayL** - Delay with linear interpolation\n\n```supercollider\nDelayL.ar(in, maxdelaytime: 0.2, delaytime: 0.2, mul: 1, add: 0)\n```',
	'CombN': '**CombN** - Comb delay (feedback delay)\n\n```supercollider\nCombN.ar(in, maxdelaytime: 0.2, delaytime: 0.2, decaytime: 1, mul: 1, add: 0)\n```',
	'AllpassN': '**AllpassN** - Allpass delay (for diffusion)\n\n```supercollider\nAllpassN.ar(in, maxdelaytime: 0.2, delaytime: 0.2, decaytime: 1, mul: 1, add: 0)\n```',
	'DelayC': '**DelayC** - Delay with cubic interpolation\n\n```supercollider\nDelayC.ar(in, maxdelaytime: 0.2, delaytime: 0.2, mul: 1, add: 0)\n```',
	'AllpassL': '**AllpassL** - Allpass delay with linear interpolation\n\n```supercollider\nAllpassL.ar(in, maxdelaytime: 0.2, delaytime: 0.2, decaytime: 1, mul: 1, add: 0)\n```',
	'AllpassC': '**AllpassC** - Allpass delay with cubic interpolation\n\n```supercollider\nAllpassC.ar(in, maxdelaytime: 0.2, delaytime: 0.2, decaytime: 1, mul: 1, add: 0)\n```',
	'CombL': '**CombL** - Comb delay with linear interpolation\n\n```supercollider\nCombL.ar(in, maxdelaytime: 0.2, delaytime: 0.2, decaytime: 1, mul: 1, add: 0)\n```',
	'CombC': '**CombC** - Comb delay with cubic interpolation\n\n```supercollider\nCombC.ar(in, maxdelaytime: 0.2, delaytime: 0.2, decaytime: 1, mul: 1, add: 0)\n```',
	'GVerb': '**GVerb** - GVerb reverb\n\n```supercollider\nGVerb.ar(in, roomsize: 10, revtime: 3, damping: 0.5, inputbw: 0.5, spread: 15, drylevel: 1, earlyreflevel: 0.7, taillevel: 0.5, maxroomsize: 300, mul: 1, add: 0)\n```',
	'PitchShift': '**PitchShift** - Pitch shifter\n\n```supercollider\nPitchShift.ar(in, windowSize: 0.2, pitchRatio: 1, pitchDispersion: 0, timeDispersion: 0, mul: 1, add: 0)\n```',
	'Pitch': '**Pitch** - Pitch tracker\n\n```supercollider\nPitch.ar(in, initFreq: 440, minFreq: 60, maxFreq: 4000, execFreq: 100, maxBinsPerOctave: 16, median: 1, ampThreshold: 0.01, peakThreshold: 0.5, downSample: 1, clar: 0)\n```',
	'FreqShift': '**FreqShift** - Frequency shifter\n\n```supercollider\nFreqShift.ar(in, freq: 0, phase: 0, mul: 1, add: 0)\n```',
	'PV_MagAbove': '**PV_MagAbove** - FFT magnitude threshold\n\n```supercollider\nPV_MagAbove.ar(buffer, threshold: 0)\n```',
	'PV_MagBelow': '**PV_MagBelow** - FFT magnitude threshold (below)\n\n```supercollider\nPV_MagBelow.ar(buffer, threshold: 0)\n```',
	'PV_MagClip': '**PV_MagClip** - Clip FFT magnitude\n\n```supercollider\nPV_MagClip.ar(buffer, threshold: 0)\n```',
	'PV_MagSmooth': '**PV_MagSmooth** - Smooth FFT magnitude\n\n```supercollider\nPV_MagSmooth.ar(buffer, factor: 0.5)\n```',
	'PV_MagMul': '**PV_MagMul** - Multiply FFT magnitudes\n\n```supercollider\nPV_MagMul.ar(bufferA, bufferB)\n```',
	'PV_MagDiv': '**PV_MagDiv** - Divide FFT magnitudes\n\n```supercollider\nPV_MagDiv.ar(bufferA, bufferB)\n```',
	'PV_PhaseShift90': '**PV_PhaseShift90** - Phase shift by 90 degrees\n\n```supercollider\nPV_PhaseShift90.ar(buffer)\n```',
	'PV_PhaseShift270': '**PV_PhaseShift270** - Phase shift by 270 degrees\n\n```supercollider\nPV_PhaseShift270.ar(buffer)\n```',
	'PV_BinShift': '**PV_BinShift** - Shift FFT bins\n\n```supercollider\nPV_BinShift.ar(buffer, stretch: 1, shift: 0)\n```',
	'PV_BinScramble': '**PV_BinScramble** - Scramble FFT bins\n\n```supercollider\nPV_BinScramble.ar(buffer, wipe: 0, width: 0.2, trig: 0)\n```',
	'PV_BrickWall': '**PV_BrickWall** - Zero bins above threshold\n\n```supercollider\nPV_BrickWall.ar(buffer, wipe: 0)\n```',
	'PV_MagSquared': '**PV_MagSquared** - Square FFT magnitude\n\n```supercollider\nPV_MagSquared.ar(buffer)\n```',
	'PV_MagNoise': '**PV_MagNoise** - Add noise to FFT magnitude\n\n```supercollider\nPV_MagNoise.ar(buffer, amount: 0)\n```',
	'PV_RandComb': '**PV_RandComb** - Random comb filter\n\n```supercollider\nPV_RandComb.ar(buffer, wipe: 0, trig: 0)\n```',
	'PV_RectComb': '**PV_RectComb** - Rectangular comb filter\n\n```supercollider\nPV_RectComb.ar(buffer, numTeeth: 0, phase: 0, width: 0.5)\n```',
	'PV_RectComb2': '**PV_RectComb2** - Rectangular comb filter (2)\n\n```supercollider\nPV_RectComb2.ar(bufferA, bufferB, numTeeth: 0, phase: 0, width: 0.5)\n```',
	'PV_CopyPhase': '**PV_CopyPhase** - Copy phase from one FFT to another\n\n```supercollider\nPV_CopyPhase.ar(bufferA, bufferB)\n```',
	'PV_Max': '**PV_Max** - Maximum of two FFTs\n\n```supercollider\nPV_Max.ar(bufferA, bufferB)\n```',
	'PV_Min': '**PV_Min** - Minimum of two FFTs\n\n```supercollider\nPV_Min.ar(bufferA, bufferB)\n```',
	'PV_Add': '**PV_Add** - Add two FFTs\n\n```supercollider\nPV_Add.ar(bufferA, bufferB)\n```',
	'PV_Mul': '**PV_Mul** - Multiply two FFTs\n\n```supercollider\nPV_Mul.ar(bufferA, bufferB)\n```',
	'PV_Div': '**PV_Div** - Divide two FFTs\n\n```supercollider\nPV_Div.ar(bufferA, bufferB)\n```',
	'FFT': '**FFT** - Fast Fourier Transform\n\n```supercollider\nFFT(buffer, in, hop: 0.5, wintype: 0, active: 1, winsize: 0)\n```',
	'IFFT': '**IFFT** - Inverse Fast Fourier Transform\n\n```supercollider\nIFFT.ar(buffer, wintype: 0, winsize: 0)\n```',

	// Panning
	'Pan2': '**Pan2** - Stereo panner\n\n```supercollider\nPan2.ar(in, pos: 0, level: 1)\n```\n\n**Arguments:**\n- `in` - Input signal (mono)\n- `pos` - Pan position (-1 left, 0 center, +1 right)\n- `level` - Output amplitude',
	'Splay': '**Splay** - Spread channels across stereo field\n\n```supercollider\nSplay.ar(inArray, spread: 1, level: 1, center: 0, levelComp: true)\n```',
	'Balance2': '**Balance2** - Stereo balancer\n\n```supercollider\nBalance2.ar(left, right, pos: 0, level: 1)\n```',
	'LinPan2': '**LinPan2** - Linear stereo panner\n\n```supercollider\nLinPan2.ar(in, pos: 0, level: 1)\n```',
	'Pan4': '**Pan4** - Four channel panner\n\n```supercollider\nPan4.ar(in, xpos: 0, ypos: 0, level: 1)\n```',
	'PanAz': '**PanAz** - Ambisonic panner\n\n```supercollider\nPanAz.ar(numChans: 4, in, pos: 0, level: 1, width: 2, orientation: 0.5)\n```',
	'Rotate2': '**Rotate2** - Rotate two channels\n\n```supercollider\nRotate2.ar(x, y, pos: 0)\n```',
	'XFade2': '**XFade2** - Crossfade between two signals\n\n```supercollider\nXFade2.ar(inA, inB, pan: 0, level: 1)\n```',

	// Envelopes
	'EnvGen': '**EnvGen** - Envelope generator\n\n```supercollider\nEnvGen.ar(envelope, gate: 1, levelScale: 1, levelBias: 0, timeScale: 1, doneAction: 0)\nEnvGen.kr(envelope, gate: 1, levelScale: 1, levelBias: 0, timeScale: 1, doneAction: 0)\n```\n\n**Arguments:**\n- `envelope` - An Env instance\n- `gate` - Trigger/gate signal\n- `doneAction` - Action when envelope completes (2 = free synth)',
	'Env': '**Env** - Envelope specification\n\n```supercollider\nEnv.new(levels, times, curves)\nEnv.perc(attackTime: 0.01, releaseTime: 1, level: 1, curve: -4)\nEnv.adsr(attackTime: 0.01, decayTime: 0.3, sustainLevel: 0.5, releaseTime: 1)\nEnv.asr(attackTime: 0.01, sustainLevel: 1, releaseTime: 1)\nEnv.linen(attackTime: 0.01, sustainTime: 1, releaseTime: 1, level: 1)\n```',
	'Line': '**Line** - Line generator\n\n```supercollider\nLine.ar(start: 0, end: 1, dur: 1, mul: 1, add: 0, doneAction: 0)\n```',
	'XLine': '**XLine** - Exponential line generator\n\n```supercollider\nXLine.ar(start: 1, end: 2, dur: 1, mul: 1, add: 0, doneAction: 0)\n```',
	'Linen': '**Linen** - Linear envelope\n\n```supercollider\nLinen.ar(gate: 1, attackTime: 0.01, sustainLevel: 1, releaseTime: 1, doneAction: 0)\n```',
	'Curve': '**Curve** - Curve generator\n\n```supercollider\nCurve.ar(start: 0, end: 1, dur: 1, curvature: 0, mul: 1, add: 0, doneAction: 0)\n```',
	'XCurve': '**XCurve** - Exponential curve generator\n\n```supercollider\nXCurve.ar(start: 1, end: 2, dur: 1, curvature: 0, mul: 1, add: 0, doneAction: 0)\n```',
	'VarLag': '**VarLag** - Variable lag\n\n```supercollider\nVarLag.ar(in, time: 0.1, curvature: 0, warp: 5, startVal: 0)\nVarLag.kr(in, time: 0.1, curvature: 0, warp: 5, startVal: 0)\n```',

	// Buffers
	'Buffer': '**Buffer** - Buffer for audio data\n\n```supercollider\nBuffer.alloc(server, numFrames, numChannels: 1, completionMessage)\nBuffer.read(server, path, startFrame: 0, numFrames: -1, action, bufnum)\n```',
	'PlayBuf': '**PlayBuf** - Play audio from buffer\n\n```supercollider\nPlayBuf.ar(numChannels, bufnum: 0, rate: 1, trigger: 1, startPos: 0, loop: 0, doneAction: 0)\n```',
	'RecordBuf': '**RecordBuf** - Record audio to buffer\n\n```supercollider\nRecordBuf.ar(inputArray, bufnum: 0, offset: 0, recLevel: 1, preLevel: 0, run: 1, loop: 1, trigger: 1, doneAction: 0)\n```',
	'BufRd': '**BufRd** - Read from buffer\n\n```supercollider\nBufRd.ar(numChannels: 1, bufnum: 0, phase: 0, loop: 1, interpolation: 2)\n```',
	'BufWr': '**BufWr** - Write to buffer\n\n```supercollider\nBufWr.ar(inputArray, bufnum: 0, phase: 0, loop: 1)\n```',
	'BufDelayN': '**BufDelayN** - Buffer delay (no interpolation)\n\n```supercollider\nBufDelayN.ar(bufnum: 0, in, delaytime: 0.2, mul: 1, add: 0)\n```',
	'BufDelayL': '**BufDelayL** - Buffer delay (linear interpolation)\n\n```supercollider\nBufDelayL.ar(bufnum: 0, in, delaytime: 0.2, mul: 1, add: 0)\n```',
	'BufDelayC': '**BufDelayC** - Buffer delay (cubic interpolation)\n\n```supercollider\nBufDelayC.ar(bufnum: 0, in, delaytime: 0.2, mul: 1, add: 0)\n```',
	'BufCombN': '**BufCombN** - Buffer comb filter\n\n```supercollider\nBufCombN.ar(bufnum: 0, in, delaytime: 0.2, decaytime: 1, mul: 1, add: 0)\n```',
	'BufCombL': '**BufCombL** - Buffer comb filter (linear)\n\n```supercollider\nBufCombL.ar(bufnum: 0, in, delaytime: 0.2, decaytime: 1, mul: 1, add: 0)\n```',
	'BufCombC': '**BufCombC** - Buffer comb filter (cubic)\n\n```supercollider\nBufCombC.ar(bufnum: 0, in, delaytime: 0.2, decaytime: 1, mul: 1, add: 0)\n```',
	'BufAllpassN': '**BufAllpassN** - Buffer allpass filter\n\n```supercollider\nBufAllpassN.ar(bufnum: 0, in, delaytime: 0.2, decaytime: 1, mul: 1, add: 0)\n```',
	'BufAllpassL': '**BufAllpassL** - Buffer allpass filter (linear)\n\n```supercollider\nBufAllpassL.ar(bufnum: 0, in, delaytime: 0.2, decaytime: 1, mul: 1, add: 0)\n```',
	'BufAllpassC': '**BufAllpassC** - Buffer allpass filter (cubic)\n\n```supercollider\nBufAllpassC.ar(bufnum: 0, in, delaytime: 0.2, decaytime: 1, mul: 1, add: 0)\n```',
	'GrainBuf': '**GrainBuf** - Granular synthesis from buffer\n\n```supercollider\nGrainBuf.ar(numChannels: 1, trigger: 0, dur: 0.1, sndbuf: 0, rate: 1, pos: 0, interp: 2, pan: 0, envbufnum: -1, mul: 1, add: 0)\n```',
	'GrainIn': '**GrainIn** - Granular synthesis from input\n\n```supercollider\nGrainIn.ar(numChannels: 1, trigger: 0, dur: 0.1, in, pan: 0, envbufnum: -1, mul: 1, add: 0)\n```',
	'Warp1': '**Warp1** - Warp granular synthesis\n\n```supercollider\nWarp1.ar(numChannels: 1, bufnum: 0, pointer: 0, freqScale: 1, windowSize: 0.2, envbufnum: -1, overlaps: 8, windowRandRatio: 0, interp: 1, mul: 1, add: 0)\n```',
	'VOSIM': '**VOSIM** - Voice simulation oscillator\n\n```supercollider\nVOSIM.ar(freq: 440, nCycles: 4, bufnum: 0, mul: 1, add: 0)\n```',
	'Shaper': '**Shaper** - Waveshaper using buffer\n\n```supercollider\nShaper.ar(bufnum: 0, in, mul: 1, add: 0)\n```',
	'Convolution': '**Convolution** - Convolution reverb\n\n```supercollider\nConvolution.ar(in, kernel: 0, framesize: 512, mul: 1, add: 0)\n```',
	'Convolution2': '**Convolution2** - Convolution reverb (2)\n\n```supercollider\nConvolution2.ar(in, kernel: 0, trigger: 0, framesize: 512, mul: 1, add: 0)\n```',
	'Convolution3': '**Convolution3** - Convolution reverb (3)\n\n```supercollider\nConvolution3.ar(in, kernel: 0, trigger: 0, framesize: 512, mul: 1, add: 0)\n```',
	'PartConv': '**PartConv** - Partitioned convolution\n\n```supercollider\nPartConv.ar(in, fftsize: 2048, irbufnum: 0, mul: 1, add: 0)\n```',

	// I/O
	'Out': '**Out** - Write signal to bus\n\n```supercollider\nOut.ar(bus, channelsArray)\nOut.kr(bus, channelsArray)\n```\n\n**Arguments:**\n- `bus` - Bus index to write to\n- `channelsArray` - Signal or array of signals',
	'In': '**In** - Read signal from bus\n\n```supercollider\nIn.ar(bus, numChannels: 1)\nIn.kr(bus, numChannels: 1)\n```',
	'LocalIn': '**LocalIn** - Read from local bus (for feedback)\n\n```supercollider\nLocalIn.ar(numChannels: 1, default: 0)\n```',
	'LocalOut': '**LocalOut** - Write to local bus (for feedback)\n\n```supercollider\nLocalOut.ar(channelsArray)\n```',
	'ReplaceOut': '**ReplaceOut** - Replace bus contents\n\n```supercollider\nReplaceOut.ar(bus, channelsArray)\nReplaceOut.kr(bus, channelsArray)\n```',
	'XOut': '**XOut** - Crossfade output\n\n```supercollider\nXOut.ar(bus, xfade: 0, channelsArray)\nXOut.kr(bus, xfade: 0, channelsArray)\n```',
	'OffsetOut': '**OffsetOut** - Offset output\n\n```supercollider\nOffsetOut.ar(bus, channelsArray)\nOffsetOut.kr(bus, channelsArray)\n```',
	'CheckBadValues': '**CheckBadValues** - Check for NaN/Inf\n\n```supercollider\nCheckBadValues.ar(in, id: 0, post: 2)\nCheckBadValues.kr(in, id: 0, post: 2)\n```',
	'Poll': '**Poll** - Poll UGen values\n\n```supercollider\nPoll.ar(trig: 0, in, label: "", trigid: -1)\nPoll.kr(trig: 0, in, label: "", trigid: -1)\n```',
	'ScopeOut': '**ScopeOut** - Write to scope buffer\n\n```supercollider\nScopeOut.ar(inputArray, bufnum: 0)\n```',
	'ScopeOut2': '**ScopeOut2** - Write to scope buffer (2)\n\n```supercollider\nScopeOut2.ar(inputArray, bufnum: 0)\n```',

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
	'Lag2': '**Lag2** - Exponential lag (2nd order)\n\n```supercollider\nLag2.ar(in, lagTime: 0.1)\nLag2.kr(in, lagTime: 0.1)\n```',
	'Lag3': '**Lag3** - Exponential lag (3rd order)\n\n```supercollider\nLag3.ar(in, lagTime: 0.1)\nLag3.kr(in, lagTime: 0.1)\n```',
	'Mix': '**Mix** - Mix array of channels to mono\n\n```supercollider\nMix.ar(array)\nMix.fill(n, function)\n```',
	'Limiter': '**Limiter** - Limiter\n\n```supercollider\nLimiter.ar(in, level: 1, dur: 0.01, mul: 1, add: 0)\n```',
	'Compander': '**Compander** - Compressor/expander\n\n```supercollider\nCompander.ar(in, control: in, thresh: 0.5, slopeBelow: 1, slopeAbove: 1, clampTime: 0.01, relaxTime: 0.01, mul: 1, add: 0)\n```',
	'Normalizer': '**Normalizer** - Normalize amplitude\n\n```supercollider\nNormalizer.ar(in, level: 1, dur: 0.01, mul: 1, add: 0)\n```',
	'CompanderD': '**CompanderD** - Compander (ducking)\n\n```supercollider\nCompanderD.ar(in, thresh: 0.5, slopeBelow: 1, slopeAbove: 1, clampTime: 0.01, relaxTime: 0.01, mul: 1, add: 0)\n```',
	'SoftClipAmp': '**SoftClipAmp** - Soft clipping amplifier\n\n```supercollider\nSoftClipAmp.ar(in, amp: 1, mul: 1, add: 0)\n```',
	'AmpComp': '**AmpComp** - Amplitude compensation\n\n```supercollider\nAmpComp.ar(freq: 1000, root: 0, exp: 0.3333, mul: 1, add: 0)\n```',
	'AmpCompA': '**AmpCompA** - Amplitude compensation (A-weighting)\n\n```supercollider\nAmpCompA.ar(freq: 1000, root: 0, minAmp: 0.32, rootAmp: 1, mul: 1, add: 0)\n```',
	'MouseX': '**MouseX** - Mouse X position\n\n```supercollider\nMouseX.kr(minval: 0, maxval: 1, warp: 0, lag: 0.2)\n```',
	'MouseY': '**MouseY** - Mouse Y position\n\n```supercollider\nMouseY.kr(minval: 0, maxval: 1, warp: 0, lag: 0.2)\n```',
	'MouseButton': '**MouseButton** - Mouse button state\n\n```supercollider\nMouseButton.kr(minval: 0, maxval: 1, warp: 0, lag: 0.2)\n```',
	'KeyState': '**KeyState** - Keyboard key state\n\n```supercollider\nKeyState.kr(keycode: 0, minval: 0, maxval: 1, lag: 0.2, mul: 1, add: 0)\n```',
	'Free': '**Free** - Free synth\n\n```supercollider\nFree.ar(trig: 0)\nFree.kr(trig: 0)\n```',
	'FreeSelf': '**FreeSelf** - Free self\n\n```supercollider\nFreeSelf.ar(trig: 0)\nFreeSelf.kr(trig: 0)\n```',
	'FreeSelfWhenDone': '**FreeSelfWhenDone** - Free self when done\n\n```supercollider\nFreeSelfWhenDone.ar(trig: 0)\nFreeSelfWhenDone.kr(trig: 0)\n```',
	'PauseSelf': '**PauseSelf** - Pause self\n\n```supercollider\nPauseSelf.ar(trig: 0)\nPauseSelf.kr(trig: 0)\n```',
	'SetResetFF': '**SetResetFF** - Set-reset flip-flop\n\n```supercollider\nSetResetFF.ar(trig: 0, reset: 0)\nSetResetFF.kr(trig: 0, reset: 0)\n```',
	'Schmidt': '**Schmidt** - Schmidt trigger\n\n```supercollider\nSchmidt.ar(in, lo: 0, hi: 1)\nSchmidt.kr(in, lo: 0, hi: 1)\n```',
	'Hertz': '**Hertz** - Frequency to Hertz converter\n\n```supercollider\nHertz.ar(in, mul: 1, add: 0)\nHertz.kr(in, mul: 1, add: 0)\n```',
	'Midicps': '**Midicps** - MIDI note to frequency\n\n```supercollider\nMidicps.ar(in, mul: 1, add: 0)\nMidicps.kr(in, mul: 1, add: 0)\n```',
	'Cpsmidi': '**Cpsmidi** - Frequency to MIDI note\n\n```supercollider\nCpsmidi.ar(in, mul: 1, add: 0)\nCpsmidi.kr(in, mul: 1, add: 0)\n```',
	'Octcps': '**Octcps** - Octave to frequency\n\n```supercollider\nOctcps.ar(in, mul: 1, add: 0)\nOctcps.kr(in, mul: 1, add: 0)\n```',
	'Cpsoct': '**Cpsoct** - Frequency to octave\n\n```supercollider\nCpsoct.ar(in, mul: 1, add: 0)\nCpsoct.kr(in, mul: 1, add: 0)\n```',
	'Ratio': '**Ratio** - Ratio converter\n\n```supercollider\nRatio.ar(in, mul: 1, add: 0)\nRatio.kr(in, mul: 1, add: 0)\n```',
	'Dbamp': '**Dbamp** - Decibels to amplitude\n\n```supercollider\nDbamp.ar(in, mul: 1, add: 0)\nDbamp.kr(in, mul: 1, add: 0)\n```',
	'Ampdb': '**Ampdb** - Amplitude to decibels\n\n```supercollider\nAmpdb.ar(in, mul: 1, add: 0)\nAmpdb.kr(in, mul: 1, add: 0)\n```',
	'Squared': '**Squared** - Square value\n\n```supercollider\nSquared.ar(in, mul: 1, add: 0)\nSquared.kr(in, mul: 1, add: 0)\n```',
	'Cubed': '**Cubed** - Cube value\n\n```supercollider\nCubed.ar(in, mul: 1, add: 0)\nCubed.kr(in, mul: 1, add: 0)\n```',
	'Sqrt': '**Sqrt** - Square root\n\n```supercollider\nSqrt.ar(in, mul: 1, add: 0)\nSqrt.kr(in, mul: 1, add: 0)\n```',
	'Exp': '**Exp** - Exponential\n\n```supercollider\nExp.ar(in, mul: 1, add: 0)\nExp.kr(in, mul: 1, add: 0)\n```',
	'Log': '**Log** - Natural logarithm\n\n```supercollider\nLog.ar(in, mul: 1, add: 0)\nLog.kr(in, mul: 1, add: 0)\n```',
	'Log2': '**Log2** - Base 2 logarithm\n\n```supercollider\nLog2.ar(in, mul: 1, add: 0)\nLog2.kr(in, mul: 1, add: 0)\n```',
	'Log10': '**Log10** - Base 10 logarithm\n\n```supercollider\nLog10.ar(in, mul: 1, add: 0)\nLog10.kr(in, mul: 1, add: 0)\n```',
	'Sin': '**Sin** - Sine\n\n```supercollider\nSin.ar(in, mul: 1, add: 0)\nSin.kr(in, mul: 1, add: 0)\n```',
	'Cos': '**Cos** - Cosine\n\n```supercollider\nCos.ar(in, mul: 1, add: 0)\nCos.kr(in, mul: 1, add: 0)\n```',
	'Tan': '**Tan** - Tangent\n\n```supercollider\nTan.ar(in, mul: 1, add: 0)\nTan.kr(in, mul: 1, add: 0)\n```',
	'Asin': '**Asin** - Arc sine\n\n```supercollider\nAsin.ar(in, mul: 1, add: 0)\nAsin.kr(in, mul: 1, add: 0)\n```',
	'Acos': '**Acos** - Arc cosine\n\n```supercollider\nAcos.ar(in, mul: 1, add: 0)\nAcos.kr(in, mul: 1, add: 0)\n```',
	'Atan': '**Atan** - Arc tangent\n\n```supercollider\nAtan.ar(in, mul: 1, add: 0)\nAtan.kr(in, mul: 1, add: 0)\n```',
	'Sinh': '**Sinh** - Hyperbolic sine\n\n```supercollider\nSinh.ar(in, mul: 1, add: 0)\nSinh.kr(in, mul: 1, add: 0)\n```',
	'Cosh': '**Cosh** - Hyperbolic cosine\n\n```supercollider\nCosh.ar(in, mul: 1, add: 0)\nCosh.kr(in, mul: 1, add: 0)\n```',
	'Tanh': '**Tanh** - Hyperbolic tangent\n\n```supercollider\nTanh.ar(in, mul: 1, add: 0)\nTanh.kr(in, mul: 1, add: 0)\n```',
	'Distort': '**Distort** - Distortion\n\n```supercollider\nDistort.ar(in, mul: 1, add: 0)\nDistort.kr(in, mul: 1, add: 0)\n```',
	'SoftClip': '**SoftClip** - Soft clipping\n\n```supercollider\nSoftClip.ar(in, mul: 1, add: 0)\nSoftClip.kr(in, mul: 1, add: 0)\n```',
	'Clip': '**Clip** - Clip signal\n\n```supercollider\nClip.ar(in, lo: -1, hi: 1, mul: 1, add: 0)\nClip.kr(in, lo: -1, hi: 1, mul: 1, add: 0)\n```',
	'Fold': '**Fold** - Fold signal\n\n```supercollider\nFold.ar(in, lo: -1, hi: 1, mul: 1, add: 0)\nFold.kr(in, lo: -1, hi: 1, mul: 1, add: 0)\n```',
	'Wrap': '**Wrap** - Wrap signal\n\n```supercollider\nWrap.ar(in, lo: -1, hi: 1, mul: 1, add: 0)\nWrap.kr(in, lo: -1, hi: 1, mul: 1, add: 0)\n```',
	'UnaryOpUGen': '**UnaryOpUGen** - Unary operation UGen\n\n```supercollider\nUnaryOpUGen.ar(in, mul: 1, add: 0)\nUnaryOpUGen.kr(in, mul: 1, add: 0)\n```',
	'BinaryOpUGen': '**BinaryOpUGen** - Binary operation UGen\n\n```supercollider\nBinaryOpUGen.ar(inA, inB, mul: 1, add: 0)\nBinaryOpUGen.kr(inA, inB, mul: 1, add: 0)\n```',
	'MulAdd': '**MulAdd** - Multiply and add\n\n```supercollider\nMulAdd.ar(in, mul: 1, add: 0)\nMulAdd.kr(in, mul: 1, add: 0)\n```',
	'Sum3': '**Sum3** - Sum three signals\n\n```supercollider\nSum3.ar(in1, in2, in3, mul: 1, add: 0)\nSum3.kr(in1, in2, in3, mul: 1, add: 0)\n```',
	'Sum4': '**Sum4** - Sum four signals\n\n```supercollider\nSum4.ar(in1, in2, in3, in4, mul: 1, add: 0)\nSum4.kr(in1, in2, in3, in4, mul: 1, add: 0)\n```',
	'DifSqr': '**DifSqr** - Difference of squares\n\n```supercollider\nDifSqr.ar(inA, inB, mul: 1, add: 0)\nDifSqr.kr(inA, inB, mul: 1, add: 0)\n```',
	'SumSqr': '**SumSqr** - Sum of squares\n\n```supercollider\nSumSqr.ar(inA, inB, mul: 1, add: 0)\nSumSqr.kr(inA, inB, mul: 1, add: 0)\n```',
	'SqrSum': '**SqrSum** - Square of sum\n\n```supercollider\nSqrSum.ar(inA, inB, mul: 1, add: 0)\nSqrSum.kr(inA, inB, mul: 1, add: 0)\n```',
	'SqrDif': '**SqrDif** - Square of difference\n\n```supercollider\nSqrDif.ar(inA, inB, mul: 1, add: 0)\nSqrDif.kr(inA, inB, mul: 1, add: 0)\n```',
	'AbsDif': '**AbsDif** - Absolute difference\n\n```supercollider\nAbsDif.ar(inA, inB, mul: 1, add: 0)\nAbsDif.kr(inA, inB, mul: 1, add: 0)\n```',
	'Thresh': '**Thresh** - Threshold\n\n```supercollider\nThresh.ar(in, thresh: 0, mul: 1, add: 0)\nThresh.kr(in, thresh: 0, mul: 1, add: 0)\n```',
	'SCurve': '**SCurve** - S-curve\n\n```supercollider\nSCurve.ar(in, mul: 1, add: 0)\nSCurve.kr(in, mul: 1, add: 0)\n```',
	'A2K': '**A2K** - Audio to control rate\n\n```supercollider\nA2K.ar(in)\n```',
	'K2A': '**K2A** - Control to audio rate\n\n```supercollider\nK2A.ar(in, mul: 1, add: 0)\n```',
	'T2A': '**T2A** - Trigger to audio rate\n\n```supercollider\nT2A.ar(trig: 0, offset: 0)\n```',
	'T2K': '**T2K** - Trigger to control rate\n\n```supercollider\nT2K.kr(trig: 0, offset: 0)\n```',
	'DC': '**DC** - DC offset\n\n```supercollider\nDC.ar(in: 0, mul: 1, add: 0)\nDC.kr(in: 0, mul: 1, add: 0)\n```',
	'Silent': '**Silent** - Silent signal\n\n```supercollider\nSilent.ar(numChannels: 1)\n```',
	'Clear': '**Clear** - Clear signal\n\n```supercollider\nClear.ar(in, mul: 1, add: 0)\nClear.kr(in, mul: 1, add: 0)\n```',
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
	// Oscillators
	'SinOsc', 'Saw', 'Pulse', 'LFSaw', 'LFPulse', 'LFNoise0', 'LFNoise1', 'LFNoise2',
	'Blip', 'Formant', 'Klang', 'VOsc', 'VOsc3', 'FSinOsc', 'PMOsc', 'COsc',
	'Gendy1', 'Gendy2', 'Gendy3',
	// Noise
	'WhiteNoise', 'PinkNoise', 'BrownNoise', 'ClipNoise', 'GrayNoise',
	'Dust', 'Dust2', 'Impulse', 'Crackle', 'Logistic',
	// Triggers
	'Stepper', 'PulseDivider', 'Trig1', 'TDelay', 'TDuty', 'SendTrig', 'Latch', 'Gate',
	'Trig', 'Timer', 'Sweep', 'Phasor', 'Peak', 'RunningMin', 'RunningMax',
	// Filters
	'LPF', 'HPF', 'BPF', 'BRF', 'RLPF', 'RHPF', 'Resonz', 'Ringz', 'Formlet',
	'Median', 'MedianFilter', 'MoogFF', 'DFM1', 'FOS', 'SOS', 'TwoPole', 'TwoZero',
	'OnePole', 'OneZero', 'Integrator', 'LeakDC',
	// Reverb & Delay
	'FreeVerb', 'GVerb', 'AllpassN', 'AllpassL', 'AllpassC',
	'CombN', 'CombL', 'CombC', 'DelayN', 'DelayL', 'DelayC',
	'PitchShift', 'Pitch', 'FreqShift',
	// FFT
	'PV_MagAbove', 'PV_MagBelow', 'PV_MagClip', 'PV_MagSmooth', 'PV_MagMul', 'PV_MagDiv',
	'PV_PhaseShift90', 'PV_PhaseShift270', 'PV_BinShift', 'PV_BinScramble', 'PV_BrickWall',
	'PV_MagSquared', 'PV_MagNoise', 'PV_RandComb', 'PV_RectComb', 'PV_RectComb2',
	'PV_CopyPhase', 'PV_Max', 'PV_Min', 'PV_Add', 'PV_Mul', 'PV_Div', 'FFT', 'IFFT',
	// Panning
	'Pan2', 'Balance2', 'LinPan2', 'Splay', 'Pan4', 'PanAz', 'Rotate2', 'XFade2',
	// Envelopes
	'EnvGen', 'Env', 'Line', 'XLine', 'Linen', 'Curve', 'XCurve', 'VarLag',
	// Buffers
	'PlayBuf', 'RecordBuf', 'BufRd', 'BufWr', 'Buffer',
	'BufDelayN', 'BufDelayL', 'BufDelayC', 'BufCombN', 'BufCombL', 'BufCombC',
	'BufAllpassN', 'BufAllpassL', 'BufAllpassC',
	'GrainBuf', 'GrainIn', 'Warp1', 'VOSIM', 'Shaper',
	'Convolution', 'Convolution2', 'Convolution3', 'PartConv',
	// I/O
	'Out', 'In', 'LocalIn', 'LocalOut', 'ReplaceOut', 'XOut', 'OffsetOut',
	'CheckBadValues', 'Poll', 'ScopeOut', 'ScopeOut2',
	// Control
	'Mix', 'Limiter', 'Compander', 'Normalizer', 'CompanderD', 'SoftClipAmp',
	'AmpComp', 'AmpCompA',
	'MouseX', 'MouseY', 'MouseButton', 'KeyState',
	'Lag', 'Lag2', 'Lag3', 'Ramp', 'VarLag', 'Decay', 'Decay2',
	// Math operations
	'Hertz', 'Midicps', 'Cpsmidi', 'Octcps', 'Cpsoct', 'Ratio', 'Dbamp', 'Ampdb',
	'Squared', 'Cubed', 'Sqrt', 'Exp', 'Log', 'Log2', 'Log10',
	'Sin', 'Cos', 'Tan', 'Asin', 'Acos', 'Atan', 'Sinh', 'Cosh', 'Tanh',
	'Distort', 'SoftClip', 'Clip', 'Fold', 'Wrap',
	'UnaryOpUGen', 'BinaryOpUGen', 'MulAdd', 'Sum3', 'Sum4',
	'DifSqr', 'SumSqr', 'SqrSum', 'SqrDif', 'AbsDif', 'Thresh', 'SCurve',
	// Rate conversion
	'A2K', 'K2A', 'T2A', 'T2K', 'DC', 'Silent', 'Clear',
	// Synth control
	'Free', 'FreeSelf', 'PauseSelf', 'Done', 'FreeSelfWhenDone', 'PauseSelfWhenDone',
	'Pause', 'SetResetFF', 'Schmidt',
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
