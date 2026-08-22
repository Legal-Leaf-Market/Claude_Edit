# The queue: 24 posts for @stomp_box_world

In publishing order, not in dataset order. Section 6 of `README.md` explains
why the first nine are arranged the way they are.

Every post names the `lib/pedals.ts` slug or the `lib/chain.ts` slot it came
from, so any claim in a caption can be traced back to the file that makes it.
Nothing here states a fact the dataset does not already carry. If a caption
needs a fact the dataset lacks, the fix is to check the pedal and add it to the
dataset, not to write it into a caption.

Captions are ready to paste. Slide text is the words on the image, not a
description of it.

---

## 01. The circuit, not the adjective

- **Pillar:** intro
- **Source:** `lib/site.ts` tagline, `CLAUDE.md` section 1
- **Format:** single image
- **Visual:** The mark on `#2a3136`, and under it, set in `--text`, the words
  "the circuit, not the adjective". Nothing else. This is the one post allowed
  to be only typography.

**Caption**

```
Most pedal writing runs out of vocabulary after four pedals. Warm, creamy, smooth, thick, and then what.

So this account says what the circuit is doing instead. Soft clipping inside an op-amp's feedback loop and hard clipping to ground are different circuits that behave differently, and naming which one a pedal does is more useful than an adjective and never runs out.

Three things you can expect here:

The circuit, not the adjective. What the thing actually does to your signal.

Claims you can check. Every post is written so that someone holding the pedal can find out whether we are right. If we are wrong you will be able to hear it.

Order with reasons. Where a pedal goes in the chain, and why it goes there, because a reason can be argued with and a rule cannot.

No artist credits, no guessed spec figures, nothing for sale.

The full guide is at stompbox.world
```

**Alt text:** The stompbox.world logo, a dark pedal enclosure with a brass
silkscreen edge and a green LED, above the words "the circuit, not the
adjective".

---

## 02. Two drives, two different circuits

- **Pillar:** two circuits, one word
- **Source:** `tube-screamer`, `rat`
- **Format:** carousel, 4 slides
- **Visual:** Slides 2 and 3 each want a simple signal-path diagram: a triangle
  for the op-amp stage, and the diodes drawn either inside the feedback loop
  (slide 2) or hanging off the output to ground (slide 3). Same drawing twice
  with one thing moved is the whole point, so keep the two slides identical
  apart from the diode position.

**Slides**

1. "Both are called overdrive. They are not the same circuit."
2. "SOFT CLIPPING / Diodes sit inside the op-amp's feedback loop, so the signal
   is rounded off gradually rather than squared. A high-pass filter ahead of the
   stage keeps bass out of the clipping, and the recovery stage lifts a band
   around 700 to 900 Hz."
3. "HARD CLIPPING / A stage with a very large available gain, then diodes
   clipping to ground after it. Clipping after the stage instead of inside its
   feedback loop squares the waveform off far more abruptly."
4. "Soft: low end stays tight, a pronounced middle pushes the note forward.
   Hard: a flatter, harder edge, and far more gain at the top of the dial."

**Caption**

```
A Tube Screamer and a RAT get filed under the same word and they are doing two different things to your waveform.

The Tube Screamer clips soft. Its diodes sit inside the feedback loop of the op-amp gain stage, so the signal is rounded off gradually instead of squared, a high-pass filter ahead of that stage keeps bass out of the clipping, and the recovery stage lifts a band in the 700 to 900 Hz region.

The RAT clips hard. Huge available gain, then diodes clipping to ground after the stage. Squaring the wave off that abruptly is a different sound, not a stronger version of the same one.

Check it yourself: set both for roughly matched volume and play the low E. On the soft clipper the low end stays tight while everything above it thickens. On the hard clipper the whole note flattens.

stompbox.world/pedals
```

**Alt text:** Two signal path diagrams side by side. In the first, diodes sit
inside an op-amp's feedback loop. In the second, the diodes sit after the stage,
connected to ground.

---

## 03. The knob that runs backwards

- **Pillar:** the thing that catches everyone out
- **Source:** `rat`
- **Format:** carousel, 3 slides
- **Visual:** Slide 1 is one knob, drawn large, labelled Filter, with an arrow
  going clockwise and the word "darker" at the end of it. The joke is in the
  arrow pointing the way nobody expects.

**Slides**

1. "Turn this one up and the treble goes away."
2. "The RAT's Filter is a reversed tone control. Clockwise rolls treble off.
   Every other tone knob on your board does the opposite."
3. "So a RAT set on 10 across the board is the darkest it gets, not the
   brightest."

**Caption**

```
This catches out everyone who meets one for the first time, and it is not a fault or a mod. The RAT's Filter control is a tone control wired backwards: turning it up rolls treble off.

Which means the setting people reach for out of habit, everything on maximum, gives you the darkest possible RAT. Plenty of players have decided they do not like the pedal on the strength of that one afternoon.

The rest of the circuit is an op-amp stage with a very large available gain, followed by silicon diodes clipping to ground, which is what gives it that flat, hard edge and the pile of gain at the top of the dial.

Check it yourself: park the Distortion, then sweep Filter from 0 to 10 while playing an open chord. If it gets darker as you go up, that is the circuit, not your amp.

stompbox.world/pedals/rat
```

**Alt text:** A large drawing of a knob labelled Filter, with a clockwise arrow
ending at the word "darker".

---

## 04. The order, and the reason for every position

- **Pillar:** order, with the reason
- **Source:** `lib/chain.ts`, all eleven slots
- **Format:** carousel, 6 slides
- **Visual:** Slide 1 is the full list, numbered, guitar at the top and amp at
  the bottom, set to be readable in a screenshot because that is what people
  will do with it. Slides 2 to 5 are one slot each with its reason. Keep slide 1
  plain: it is a reference, not a poster.

**Slides**

1. "Guitar. Tuner. Wah and filter. Compressor. Fuzz. Overdrive and distortion.
   EQ and boost. Noise gate. Volume. Modulation. Delay. Reverb. Amp."
2. "WAH EARLY / So it shapes the plain guitar and the drive after it responds to
   that shape. Put a wah after a distortion and the sweep sounds flatter,
   because the distortion has already flattened the dynamics the filter would
   have moved through."
3. "DRIVE BEFORE DELAY / Distorting a signal and then delaying it keeps the
   repeats clean. Delaying a signal and then distorting it drives the repeats
   and the dry note together into one smear."
4. "GATE AFTER THE GAIN / Because the gain is what made the noise. A gate in
   front of a high-gain drive closes on a quiet signal and then hands the
   silence to something with enormous gain, which amplifies the hiss it was
   meant to remove."
5. "REVERB LAST / Because it is the room. A delay into a reverb puts each
   repeat in the same space, which is what happens acoustically. A reverb into a
   delay repeats the room itself, which does not."
6. "This is a convention, not a law. Every position here has a reason attached,
   and a reason is a thing you can argue with."

**Caption**

```
The conventional signal chain, with the reason for every position rather than just the list. Save the first slide.

Most versions of this online give you the order and stop, which leaves you with a rule you cannot reason about. The reasons are the useful part, because they tell you what you are trading when you break the order, and plenty of well known sounds come from breaking it deliberately.

The short version: things that shape the plain guitar go early, gain in the middle, anything time based near the end, and the room last. The tuner is first because it is the one pedal whose job gets easier the less has happened to the signal, and because its mute kills everything downstream in one press.

Every slot on the site carries its own reason, including the ones this carousel had no room for.

stompbox.world/chain
```

**Alt text:** A numbered list of pedal types in signal order, from guitar at the
top through tuner, wah, compressor, fuzz, drive, EQ, gate, volume, modulation,
delay and reverb, to the amp at the bottom.

---

## 05. A buffer in front of a fuzz

- **Pillar:** the thing that catches everyone out
- **Source:** `fuzz-face` with `wantsGuitarDirect`, `klon-centaur` with
  `buffered`, and the buffer note in `chainNotes()`
- **Format:** carousel, 4 slides
- **Visual:** Slide 3 wants the guitar volume knob drawn at about 4, with the
  words "should almost clean up" beside it. That is the testable half.

**Slides**

1. "Your fuzz sounds thin and will not clean up. Check what is in front of it."
2. "A vintage-style fuzz has a very low input impedance. It is built to load
   your pickups directly, and that loading is part of the sound."
3. "Roll the guitar volume back. It should thin out and clean up almost to a
   boost. If it does not, something ahead of it is driving it instead of the
   guitar."
4. "A buffered pedal anywhere in front of it, even switched off, is that
   something. Bypass is not always true bypass."

**Caption**

```
The most common fuzz complaint has an answer that is not the fuzz.

A Fuzz Face is two transistors in a directly coupled pair, and its input impedance is very low by modern standards. It loads your pickups rather than politely reading them, and that loading is part of how it sounds and how it cleans up.

Put anything with a buffered output in front of it and the fuzz is now hearing the buffer instead of the guitar. A Klon Centaur has one. So do plenty of tuners, and a buffer runs whether the pedal is engaged or not.

Check it yourself: with the fuzz on, roll your guitar volume back to about 4. It should thin out and clean up almost to the point of being a boost. If it stays thick and even, move the fuzz to the front of the board and try again.

stompbox.world/chain
```

**Alt text:** A guitar volume knob turned down to about 4, beside the words
"should almost clean up".

---

## 06. Why a Big Muff disappears under a band

- **Pillar:** the thing that catches everyone out
- **Source:** `big-muff`
- **Format:** carousel, 4 slides
- **Visual:** Slide 2 is a frequency response line with a hole scooped out of
  the middle. One line, one hole, no axis labels beyond low and high.

**Slides**

1. "It sounds enormous alone and vanishes with the band. That is the tone
   stack."
2. "The tone stack blends between a low-pass and a high-pass, so the middle of
   the control's travel takes the midrange out rather than leaving it flat."
3. "The hole is where a vocal and a snare live. Alone, you hear the size. In a
   mix, you hear the hole."
4. "Which is why so many players set the Tone away from the centre and never go
   back."

**Caption**

```
Four transistor stages: an input buffer, two identical clipping stages with diodes in their feedback loops, then a tone stack and a recovery stage. The two cascaded clipping stages are where the sustain and the wall-like thickness come from.

The disappearing act is the tone stack. It blends between a low-pass and a high-pass, so the middle of the control's travel takes the midrange out rather than leaving it flat. On its own that hole reads as size. Put a band around it and the hole is exactly where everything else already is, so the guitar stops occupying any space of its own.

Check it yourself: set the Tone at noon and play alone, then play the same thing with a track going. Then move Tone well off centre in either direction and do it again.

stompbox.world/pedals/big-muff
```

**Alt text:** A frequency response curve with a deep notch scooped out of the
middle range.

---

## 07. Two delays, and the repeats tell you which

- **Pillar:** two circuits, one word
- **Source:** `deluxe-memory-man`, `dd-2`
- **Format:** carousel, 4 slides
- **Visual:** Slides 2 and 3 both draw a row of five repeats getting quieter.
  On slide 2 they also get darker, drawn as the shape losing its top edge. On
  slide 3 they keep the same shape and only shrink.

**Slides**

1. "Analog and digital delay are not two qualities of the same thing."
2. "BUCKET BRIGADE / The signal is handed along a chain of capacitors, one step
   per clock tick. Every step loses a little high end and adds a little noise,
   so each repeat comes back darker and softer than the one before."
3. "DIGITAL / The signal is sampled, stored as numbers, played back unchanged.
   Nothing in the storage path removes high end, so the tenth repeat carries the
   same frequency content as the first."
4. "So one sinks into the background and one stays in front of you. That is why
   plenty of boards carry both."

**Caption**

```
A Deluxe Memory Man and a DD-2 are not a warmer and a colder version of one effect. They store your signal in completely different ways and the repeats show it.

The Memory Man hands the signal along a chain of capacitors, one step per clock tick. Every step loses a little top end and adds a little noise, so each repeat comes back darker than the last and sinks into the background instead of stacking up in front of you. That is what keeps a long analog delay usable under a busy part.

The DD-2 samples the signal and plays it back unchanged, so the tenth repeat has the same frequency content as the first. A virtue for rhythmic parts, a liability under a busy mix.

Check it yourself: set feedback high and listen to repeat eight. Darker than the first, or just quieter.

stompbox.world/pedals
```

**Alt text:** Two rows of five decaying delay repeats. In the first row each
repeat also loses high frequency content. In the second row the repeats only
get quieter.

---

## 08. A drive with room to swing

- **Pillar:** one pedal, one circuit
- **Source:** `klon-centaur`
- **Format:** carousel, 4 slides
- **Visual:** Slide 2 draws a 9V rail and a taller internal rail beside it, with
  the same waveform fitting inside the taller one and hitting the ceiling of the
  shorter one.

**Slides**

1. "It runs on 9V and clips against much more than 9V."
2. "An internal charge pump generates a higher voltage for the circuit to swing
   against, so the stage clips because it is asked to rather than because it ran
   out of room."
3. "The clean signal is blended back in alongside the driven one rather than
   replaced by it, so the note attack survives."
4. "Which is why the amp's own character stays underneath the gain instead of
   being covered by it."

**Caption**

```
The interesting thing about a Centaur is not the gain, it is the headroom.

An internal charge pump takes the 9V supply and generates a much higher internal voltage for the circuit to swing against. So when the stage clips, it clips because it has been asked to rather than because it ran out of room, and running out of room is what most of the harshness in a cheap drive actually is.

The second half is the blend. The clean signal is kept alongside the driven one rather than replaced by it, so the note attack stays intact where a fully clipped drive would smear it, and the treble lift opens the top end instead of adding fizz.

Note for the rest of your board: it has a buffered output, which matters if you own a vintage-style fuzz. See the buffer post.

stompbox.world/pedals/klon-centaur
```

**Alt text:** Two voltage rails drawn side by side, a short one and a tall one.
The same waveform fits inside the tall one and clips against the ceiling of the
short one.

---

## 09. What this account will not tell you

- **Pillar:** what this account will not tell you
- **Source:** `CLAUDE.md` sections 2, 3 and 6
- **Format:** carousel, 4 slides
- **Visual:** Plain type on `--metal`, no diagram. This one is the account
  speaking, so it should look like the least decorated post in the grid.

**Slides**

1. "Three things you will never read here."
2. "WHO USED IT / A rig changes between tours and between takes, so a pedal
   being on a record is a claim that needs a source. A wrong credit printed
   beside a circuit description reads as fact."
3. "THE EXACT YEAR / Prototypes, production runs, revisions and reissues
   disagree about what year a pedal is. So: late 1960s, mid 1970s. Decade
   level."
4. "A CURRENT DRAW WE HAVE NOT MEASURED / The honest number is the one printed
   on your own pedal. A figure typed from memory into a spec-shaped slot is
   worse than no figure, because it looks like a measurement."

**Caption**

```
Artist rig posts are the best performing content in this entire corner of the internet, and this account will not be making them. Worth saying why, since it is going to come up.

A rig changes between tours and between takes. So "this pedal is on that record" is a claim that needs a source, and a wrong credit sitting next to a circuit description gets read as a fact about the circuit. The dataset behind this account has no artist field in it at all, and a test fails the build if anyone adds one.

Same reasoning for precise years, and for current draw. If a number has not been measured or sourced, printing it in a spec-shaped slot makes a guess look like a measurement.

What is left is what the circuit does, which is checkable by anyone holding one. That is the whole trade.

stompbox.world/about
```

**Alt text:** Plain text on a dark metal background reading "Three things you
will never read here".

---

## 10. An octave out of the waveform itself

- **Pillar:** one pedal, one circuit
- **Source:** `octavia`
- **Format:** carousel, 4 slides
- **Visual:** Slide 2 is the money slide: a waveform, then the same waveform
  with its negative half folded up onto the positive half, then the folded
  version showing twice as many peaks. Three panels, one idea.

**Slides**

1. "No pitch tracker. No octave circuit. The octave comes out of the wave."
2. "A fuzz stage feeds a transformer and a full-wave rectifier, which folds the
   negative half of the waveform up onto the positive half."
3. "Folding the wave that way doubles its frequency. The octave appears out of
   the signal itself."
4. "Which is also why chords turn to chaos: a rectifier has no way to separate
   two notes."

**Caption**

```
An Octavia does not track your pitch and does not know what note you played. The octave is a consequence of the shape of the wave.

A fuzz stage feeds a transformer and a full-wave rectifier, and the rectifier folds the negative half of the waveform up onto the positive half. Fold a wave that way and you have doubled its frequency, so an octave above the played note appears out of the signal itself rather than from anything measuring it.

That also explains the other half of the pedal's reputation. On a single note high on the neck you get a clear bell-like octave. On a chord you get clangorous noise, because the rectifier has no way to separate two notes and folds the whole mess at once. The chaos is not a fault, it is what the pedal is for.

Also worth knowing: it wants the guitar direct, like a Fuzz Face.

stompbox.world/pedals/octavia
```

**Alt text:** Three panels showing a waveform, then the same waveform with its
lower half folded upward, then the result with twice as many peaks.

---

## 11. A wah that is not moving

- **Pillar:** one pedal, one circuit
- **Source:** `cry-baby`
- **Format:** carousel, 3 slides
- **Visual:** Slide 2 is a resonant bandpass peak drawn at three positions
  across the sweep, so the shape is visibly the same curve moved rather than
  three different curves.

**Slides**

1. "Stop rocking it. Park it."
2. "An inductor and a variable resistor form a resonant bandpass filter. The
   treadle moves its centre across roughly 400 Hz to 2 kHz, with enough
   resonance at the peak to be heard as a shape rather than an EQ change."
3. "Left parked, it stops being an effect and becomes a fixed midrange voice.
   That is the less obvious half of what it is good for."

**Caption**

```
A wah is a resonant bandpass filter with a foot control on its centre frequency. An inductor and a variable resistor make the filter, the treadle sweeps it across roughly 400 Hz to 2 kHz, and there is enough resonance at the peak that you hear a shape moving rather than a tone control changing.

The reason it sounds like a voice is that the sweep runs close to what a mouth does to a formant. Your ear has a lifetime of practice reading that movement as a vowel.

The half people skip: park it. Held at one position it is no longer an effect, it is a fixed midrange voice with a peak you chose, and it will push a thin guitar forward in a way an EQ pedal makes harder to find by ear.

Check it yourself: find the position where a single note sounds most nasal, then leave it there for a whole song.

stompbox.world/pedals/cry-baby
```

**Alt text:** A resonant bandpass filter curve drawn at three positions across
a frequency range, the same shape moved rather than three different shapes.

---

## 12. Drive then delay, or delay then drive

- **Pillar:** order, with the reason
- **Source:** the `drive` and `delay` slots in `lib/chain.ts`
- **Format:** carousel, 3 slides
- **Visual:** Two chains drawn one above the other with the two pedals swapped.
  Slide 3 shows the repeats: clean and separate in one, run together in the
  other.

**Slides**

1. "Drive into delay, or delay into drive. Both work. They are not the same."
2. "DRIVE FIRST / Distorting a signal and then delaying it keeps the repeats
   clean. You hear a distorted note repeating."
3. "DELAY FIRST / Delaying a signal and then distorting it drives the repeats
   and the dry note together into one smear. Occasionally the point, usually a
   mess."

**Caption**

```
This is the chain question with the clearest answer, and the answer still is not a rule.

Put the drive first and you are distorting the note, then making copies of the distorted note. The repeats stay separate and clean, and the delay behaves like a delay.

Put the delay first and the drive receives the dry note and all of its repeats at once, and clips the sum of them. The repeats and the note get driven together into one smear, the tail loses its separation, and the more feedback you dial in the less any of it is distinguishable.

The convention is drive first. The other way is a real sound that real records use on purpose, which is exactly why the site gives the reason for each position instead of just the order.

Check it yourself: same settings, swap the two cables, listen to the tail.

stompbox.world/chain
```

**Alt text:** Two signal chains drawn one above the other with a drive pedal and
a delay pedal swapped between them.

---

## 13. One knob, because it is voiced

- **Pillar:** one pedal, one circuit
- **Source:** `phase-90`
- **Format:** carousel, 4 slides
- **Visual:** Slide 2 draws the dry signal and the phase-shifted signal summed,
  with the two notches marked where they cancel. Slide 3 is the single knob,
  alone on the slide, which is the joke.

**Slides**

1. "Four filter stages. Two notches. One knob."
2. "Four all-pass stages shift phase without changing level, and the shifted
   signal is summed back with the dry one. Where the two cancel, a notch
   appears. Four stages give two of them."
3. "A low-frequency oscillator moves the stages, so the notches sweep. Speed is
   the only control, because the rest is voiced rather than adjustable."
4. "Which is a large part of why it is so recognisable. You cannot set it wrong
   and you cannot set it to sound like something else."

**Caption**

```
A phaser is not a filter sweeping in the way a wah does. It is cancellation.

Four all-pass stages shift phase without changing level, and that shifted signal is summed back with the dry one. Wherever the two cancel you get a notch, and four stages give you two notches. A low-frequency oscillator moves the stages, so the notches sweep across the spectrum.

There is one knob on a Phase 90, and the absence of the others is the design. Nothing feeds back into the sweep, so it is a narrow dry swirl rather than a liquid one, and depth and resonance are decisions the circuit already made for you.

That is why it is so identifiable. A pedal with six controls has a thousand voices and no signature. This one has a signature because it only has the one.

stompbox.world/pedals/phase-90
```

**Alt text:** A dry waveform and a phase-shifted waveform summed together, with
two notches marked where they cancel.

---

## 14. Two phasers, one switch between them

- **Pillar:** two circuits, one word
- **Source:** `small-stone`, `phase-90`
- **Format:** carousel, 4 slides
- **Visual:** Slide 3 draws the same two notches from post 13, once shallow and
  once deep, so the effect of the feedback is visible rather than described.

**Slides**

1. "Same arrangement as any phaser. One switch changes what it is."
2. "A Color switch feeds part of the output back into the filter chain."
3. "That feedback sharpens the notches, so the cancellation goes deeper and you
   hear a moving peak as much as a moving hole."
4. "Off: broad and watery. On: pronounced and nasal. A bigger difference than
   the one between most phasers."

**Caption**

```
A Small Stone is the same all-pass and summing arrangement as any other phaser, and then it has a Color switch, which feeds part of the output back into the filter chain.

Feedback sharpens the notches. Deeper cancellation means you stop hearing only a moving hole and start hearing a moving peak alongside it, and the whole thing goes from broad and watery to pronounced and nasal, the sort of sound that draws attention to itself in a mix rather than sitting under it.

Worth saying plainly: the difference between that switch up and down is larger than the difference between most phasers on the market. Two pedals that share a topology are not interchangeable, and one component's worth of feedback is why.

Check it yourself: hold a chord, flip Color, do not touch Rate. If it sounds like a different pedal, that is a single feedback path.

stompbox.world/pedals/small-stone
```

**Alt text:** Two notch filter curves, one shallow and one deep, showing the
effect of adding feedback to a phaser.

---

## 15. The pedal that failed and became a sound

- **Pillar:** one pedal, one circuit
- **Source:** `uni-vibe`
- **Format:** carousel, 4 slides
- **Visual:** Slide 2 draws a lamp and four photocells, with the four phase
  stages after them drawn at visibly different sizes to show the mismatch.
  Slide 3 is a modulation waveform that is lopsided rather than a clean sine.

**Slides**

1. "It was built to imitate a rotating speaker cabinet. It does not manage
   it."
2. "Four phase-shift stages, but the parts are not matched to each other. The
   modulation comes from an incandescent lamp shining on photocells rather than
   from a clean oscillator."
3. "The lamp's own thermal lag makes the sweep uneven, so it is neither a
   symmetrical phaser nor an even tremolo."
4. "You hear a throb heavier on one side of its cycle than the other. Failing
   at the imitation is precisely how it became its own thing."

**Caption**

```
A Uni-Vibe is four phase-shift stages, like a phaser, except that the parts are not matched to each other and the modulation does not come from an oscillator. It comes from an incandescent lamp shining on photocells.

A lamp has thermal lag. It does not brighten and dim the instant the drive signal tells it to, so the sweep it produces is uneven in a way a clean oscillator never is. Combine that with stages that do not match and you get something that is neither a symmetrical phaser nor an even tremolo: a throb that is heavier on one side of its cycle than the other.

It was designed to imitate a rotating speaker cabinet and it does not really manage it. Not managing it is the entire reason anybody wants one, which is a thing worth remembering the next time a spec sheet promises accuracy.

stompbox.world/pedals/uni-vibe
```

**Alt text:** A lamp shining on photocells feeding four phase shift stages drawn
at different sizes, above a lopsided modulation waveform.

---

## 16. Chorus and vibrato are one circuit with the dry signal removed

- **Pillar:** two circuits, one word
- **Source:** `ce-1`
- **Format:** carousel, 4 slides
- **Visual:** Slide 2 draws a mixer with two inputs, dry and delayed, and slide
  3 is the same drawing with the dry input crossed out. One change, again.

**Slides**

1. "Chorus and vibrato are the same circuit. One of them keeps the dry
   signal."
2. "A bucket-brigade delay line, modulated so the delay time wanders, mixed
   back against the untouched dry signal. A moving delay is a moving pitch."
3. "So chorus is the wobbling copy beating against the steady original. Two of
   you, slightly out of tune with each other."
4. "Drop the dry signal and there is nothing steady left to beat against. The
   pitch movement stops being a shimmer and becomes the whole sound."

**Caption**

```
The chorus circuit in a CE-1 came out of a Roland amplifier and got put on the floor. What it does: a bucket-brigade delay line, modulated by a low-frequency oscillator so that the delay time wanders, mixed back against the untouched dry signal.

A moving delay time is a moving pitch. So what you are hearing is a wobbling copy of yourself beating against the steady original, which is why a good chorus sounds like two of you slightly out of tune rather than like an effect sitting on top of one of you.

The vibrato switch does not add a circuit. It removes the dry signal. With nothing steady left to beat against, the pitch movement stops being a shimmer and becomes the entire sound, which is a much stranger and much less used noise than the chorus setting next to it.

stompbox.world/pedals/ce-1
```

**Alt text:** A mixer with a dry input and a modulated delayed input, then the
same diagram with the dry input crossed out.

---

## 17. It sounds thin because you are testing it wrong

- **Pillar:** the thing that catches everyone out
- **Source:** `ds-1`
- **Format:** carousel, 4 slides
- **Visual:** Slide 3 draws the single tone sweep as one line moving between a
  dark low-pass and a bright high-pass, with the scooped middle marked. Not a
  stack of two controls, which is the point.

**Slides**

1. "Every DS-1 verdict was formed in a shop, into a clean amp, on its own."
2. "A transistor gain stage feeds an op-amp stage, and diodes clip the result
   hard to ground. Bright, and unsubtle by design."
3. "The tone control is a single sweep between a dark low-pass and a bright
   high-pass rather than a stack, which is why the two ends sound so unlike each
   other and the middle sounds scooped."
4. "It sounds thin into a clean amp and comes alive in front of one that is
   already breaking up. Those are two different tests."

**Caption**

```
The DS-1 is the most argued-about pedal in this niche and most of the arguments were settled in a shop, into a clean solid state amp, with nothing else in the chain.

The circuit: a transistor gain stage into an op-amp stage, clipped hard to ground by diodes. Bright and unsubtle, and honest about it. The tone control is one sweep between a dark low-pass and a bright high-pass rather than a stack of two controls, which is why the two ends sound so unlike each other and why the middle of the travel sounds scooped.

It does sound thin on its own into a clean amp. In front of an amp that is already breaking up it does something else entirely, because now it is pushing a stage that is already working rather than supplying all of the distortion itself.

Check it yourself, both ways, before you sell it.

stompbox.world/pedals/ds-1
```

**Alt text:** A single tone control sweep drawn as one line moving between a
dark low pass filter and a bright high pass filter, with a scooped middle.

---

## 18. Drive down, level up

- **Pillar:** one pedal, one circuit
- **Source:** `tube-screamer`
- **Format:** carousel, 3 slides
- **Visual:** Slide 1 is three knobs with the settings drawn on: Drive at 8
  o'clock, Level at 4 o'clock, Tone at noon.

**Slides**

1. "Drive low. Level high. This is the setting the pedal is actually for."
2. "Like that it barely distorts on its own. It is making the amp do the
   work."
3. "A high-pass ahead of the clipping keeps bass out of it, and the recovery
   stage lifts a band around 700 to 900 Hz. Tight low end, pronounced middle,
   note pushed forward."

**Caption**

```
A Tube Screamer was built to push an amp that is already working, and the setting that does that is the one most people never try: Drive nearly off, Level well up.

Like that it barely distorts on its own. What it contributes is a level increase and a shape. A high-pass filter sits ahead of the clipping stage so bass stays out of the clipping, and the recovery stage lifts a band in the 700 to 900 Hz region, which is why the low end stays tight while everything else thickens and why the note gets pushed forward rather than made bigger in every direction.

Into a clean amp that setting sounds like almost nothing, and people conclude the pedal is overrated. Into an amp on the edge it is the whole point of it.

Check it yourself: Drive at 8 o'clock, Level at 4 o'clock, into your amp's loudest clean setting.

stompbox.world/pedals/tube-screamer
```

**Alt text:** Three pedal knobs labelled Drive, Tone and Level, set with drive
low and level high.

---

## 19. Your gate is amplifying the hiss

- **Pillar:** order, with the reason
- **Source:** the `gate` slot in `lib/chain.ts`
- **Format:** carousel, 3 slides
- **Visual:** Two chains again, gate before and after the drive, with the noise
  drawn as a small hiss shape that gets large after the drive in the wrong
  version.

**Slides**

1. "A noise gate in front of your high-gain drive is making the problem
   worse."
2. "The gate closes on a quiet signal, and then hands the silence to something
   with enormous gain, which amplifies the hiss it was meant to remove."
3. "Put it after the gain, because the gain is what made the noise."

**Caption**

```
Noise gates get put at the front of a board because that is where the guitar comes in and the noise feels like an input problem. It usually is not.

A high-gain drive generates most of the hiss you are hearing. So a gate in front of it is doing its work on a signal that is not yet noisy, and then passing the result to the stage that adds the noise. Worse, when the gate closes it hands near silence to something with enormous gain, and that stage amplifies its own noise floor into the gap you just opened.

Put the gate after the gain and it is now gating the actual problem. Fewer boards get this right than you would expect, and it is one cable.

Related: if the noise appears only with a particular pedal engaged, that is a power supply question rather than a chain order one.

stompbox.world/chain
```

**Alt text:** Two signal chains with a noise gate placed before and after a
high-gain drive, with the noise drawn small in one and large in the other.

---

## 20. It turns the loud part down and the tail up

- **Pillar:** one pedal, one circuit
- **Source:** `dyna-comp`
- **Format:** carousel, 4 slides
- **Visual:** Slide 2 draws one note's envelope before and after: the attack
  flattened, the tail lifted. The two drawings overlaid is stronger than side by
  side here.

**Slides**

1. "A compressor is not a volume control. It is a volume control that watches
   you."
2. "An operational transconductance amplifier whose gain is driven by a
   detector watching the signal's own level."
3. "Loud passages get turned down, the quiet tail of a note gets turned up. The
   dynamic range is squeezed into a narrower band."
4. "So notes all arrive at the same volume however hard you pick, and the tail
   hangs on longer than it should."

**Caption**

```
A Dyna Comp is an operational transconductance amplifier whose gain is being driven by a detector watching the signal's own level. Loud gets turned down, quiet gets turned up, and the range between them narrows.

The audible result is two things at once. Notes all arrive at the same volume however hard you pick, which is the half people buy it for. And the quiet tail of a note gets lifted, so it hangs on far longer than the string is really giving you, which is the half that makes it a country and funk pedal rather than just a leveller.

Turn it up far enough and you can hear the gain moving between notes, and the noise floor rising along with it, because the circuit lifts whatever is quiet and it cannot tell a decaying note from hiss.

Check it yourself: pick one note as softly as you can and listen to the tail.

stompbox.world/pedals/dyna-comp
```

**Alt text:** One note's volume envelope drawn twice and overlaid, the second
with a flattened attack and a lifted tail.

---

## 21. Where the compressor goes is a real choice

- **Pillar:** order, with the reason
- **Source:** the `dynamics` slot, and the compressor note in `chainNotes()`
- **Format:** carousel, 3 slides
- **Visual:** Two chains, compressor before and after the gain. No cross, no
  tick. Both are valid and the graphic has to say so.

**Slides**

1. "Compressor before the gain, or after it. Boards genuinely do both."
2. "BEFORE / The gain receives an already evened-out signal and reacts the same
   way to a light touch and a hard one."
3. "AFTER / The gain responds to your picking, and the compressor squeezes the
   result. More of the dynamics you are actually playing survive."

**Caption**

```
Most chain diagrams put the compressor near the front, where the dynamic range is still wide enough to be worth squeezing. That is a good default and it is not the only answer.

Before the gain, the drive is being fed a signal that has already been evened out, so it reacts the same way whether you pick lightly or hard. Consistent, and some of your right hand has been taken out of the equation.

After the gain, the drive responds to your picking as it happens and the compressor squeezes what comes out. More of the dynamics you are actually playing survive the trip, and the compressor is now evening out everything the board did rather than what the guitar did.

Neither is wrong. This is why the site prints the reason for a position rather than just the position: a reason lets you decide, and a rule only lets you comply.

stompbox.world/chain
```

**Alt text:** Two signal chains, one with a compressor before the drive and one
with it after, presented without either being marked correct.

---

## 22. A volume pedal is three different pedals

- **Pillar:** order, with the reason
- **Source:** the `volume` slot in `lib/chain.ts`
- **Format:** carousel, 4 slides
- **Visual:** One chain drawn three times with the volume pedal at a different
  point, and the label under each saying what it has become.

**Slides**

1. "Same pedal. Three positions. Three different jobs."
2. "BEFORE THE DRIVE / It changes how hard the drive is pushed, so it doubles
   as a gain control."
3. "AFTER THE DRIVE, BEFORE THE DELAY / It fades the level and leaves the
   repeats to ring out."
4. "AT THE VERY END / It is a master mute, and nothing else."

**Caption**

```
Of everything on a board, the volume pedal is the one whose position changes what it is rather than how well it works.

In front of the drive it is not really a volume control at all. It is changing how hard the drive is being pushed, so backing off cleans up the gain as well as reducing the level, and it doubles as a foot-operated gain control.

After the drive and before the delay it fades your level while leaving whatever is already in the delay to ring out, which is the swell everybody wants and cannot work out how to get.

At the very end of the chain it is a master mute, full stop. Fine, if that is the job.

There is no convention to follow here. Pick the behaviour you want and put it where that behaviour lives.

stompbox.world/chain
```

**Alt text:** One signal chain drawn three times with a volume pedal at a
different position in each, labelled as a gain control, a swell control and a
master mute.

---

## 23. The one pedal whose job gets easier the earlier it is

- **Pillar:** order, with the reason
- **Source:** the `tuner` slot in `lib/chain.ts`
- **Format:** single image
- **Visual:** The chain from post 4, with only the tuner highlighted in
  `--brand-led` and everything else at `--dim`. The LED green means "this is the
  thing to notice", which is what it means everywhere else on the site.

**Caption**

```
The tuner goes first, and for once the reason is not about tone.

It is reading pitch, and pitch is the one thing on your board that nothing downstream improves. Every pedal after it makes that job slightly harder: gain adds harmonics for the tuner to weigh up, modulation moves the pitch it is trying to measure, a compressor changes how the note decays underneath it. It is the only pedal whose job gets easier the less has happened to the signal.

The second reason is the mute. A tuner at the front kills everything downstream in one press, which is what you want between songs. Put it at the end and you are muting after a delay, which means your repeats keep going while you tune.

If you have no tuner on the board that is not a problem, just worth knowing what the position is for.

stompbox.world/chain
```

**Alt text:** The signal chain list with the tuner at the top highlighted in
green and every other position dimmed.

---

## 24. Reverb is last because it is the room

- **Pillar:** order, with the reason
- **Source:** the `reverb` slot in `lib/chain.ts`
- **Format:** carousel, 3 slides
- **Visual:** Slide 2 draws a room with a note and its delay repeats all inside
  it. Slide 3 draws the reverse: a small room copied several times, which is the
  thing that does not happen acoustically.

**Slides**

1. "Reverb goes last because it is the room, and a room is the last thing that
   happens to a sound."
2. "DELAY INTO REVERB / Each repeat is placed in the same space. Which is what
   happens acoustically."
3. "REVERB INTO DELAY / You are repeating the room itself. Which does not."

**Caption**

```
The reason reverb sits at the end is the most physical one in the whole chain, and it is the easiest to keep hold of.

Reverb is a room. In the world, a room is the last thing that happens to a sound: the note exists, and then the space it is in responds to it. So everything you have done to the note, the gain, the modulation, the echoes, should be inside the room rather than the room being inside them.

Delay into reverb puts every repeat in the same space, which is what an echo in a real room sounds like. Reverb into delay repeats the room, so each echo arrives carrying its own copy of the space, which is a thing that has never happened to anybody acoustically.

It is still a convention rather than a rule, and reversing it deliberately is a legitimate and quite unusual sound.

stompbox.world/chain
```

**Alt text:** A room containing a note and all of its delay repeats, beside a
diagram of a small room copied several times over.
