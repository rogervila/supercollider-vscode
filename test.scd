// SuperCollider Test File
// This file tests syntax highlighting and completions

// Variables and keywords
var freq = 440;
arg rate = 1, amp = 0.5;
classvar globalBus;
const numChannels = 2;

// Environment variables
~globalPattern = Pbind(
    \instrument, \default,
    \degree, Pseq([0, 2, 4, 5, 7], inf),
    \dur, 0.25
);

// Classes and methods (audio)
{
    var sig = SinOsc.ar(freq, 0, amp);
    var filtered = LPF.ar(sig, 1000);
    var env = EnvGen.kr(Env.perc(0.01, 0.5), doneAction: 2);
    Out.ar(0, Pan2.ar(filtered * env, 0));
}.play;

// SynthDef
SynthDef(\simpleSine, {
    arg out = 0, freq = 440, amp = 0.5, gate = 1;
    var sig = SinOsc.ar(freq, 0, amp);
    var env = EnvGen.kr(Env.asr(0.01, 1, 0.1), gate, doneAction: 2);
    Out.ar(out, sig * env ! 2);
}).add;

// Patterns
Pdef(\melody,
    Pbind(
        \instrument, \simpleSine,
        \degree, Pwhite(0, 7, inf),
        \dur, Prand([0.125, 0.25, 0.5], inf),
        \amp, Pexprand(0.1, 0.3, inf)
    )
);

// Conditionals
if(freq > 1000, {
    "High frequency".postln;
}, {
    "Low frequency".postln;
});

// Collections
[1, 2, 3, 4, 5].do { |item, index|
    (item * 2).postln;
};

// Numbers: integers, floats, hex, radix
42;
3.14159;
0xFF;
2r1010;
16rDEADBEEF;

// Symbols and strings
\symbol;
'quoted symbol';
"This is a string with \"escaped\" quotes";

// Characters
$a;
$\n;
$\\;

// Special values
true;
false;
nil;
inf;
pi;

// Built-in variables
this;
thisProcess;
thisThread;
thisFunctionDef;

/*
   Block comment
   spanning multiple lines
*/

// Method chaining
Server.default.boot;
Buffer.read(s, Platform.resourceDir +/+ "sounds/a11wlk01.wav");
