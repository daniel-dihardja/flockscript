# FAUST DSP Modules - Ideas & Roadmap

Curated list of FAUST DSP effects for drone/noise music live coding performance.

---

## Implementation Priority

### Phase 1: Essential Effects (Implement First)

#### 1. Reverb

- **Type:** Schroeder reverb or FDN (Feedback Delay Network)
- **Why:** Absolutely critical for drone/ambient, creates space and depth
- **Parameters:**
  - `roomSize` (0.1-1.0) - Size of reverb space
  - `damping` (0-1) - High frequency absorption
  - `wetDry` (0-1) - Balance between dry and wet signal
  - `predelay` (0-0.1s) - Delay before reverb starts
- **Use Cases:**
  - Long reverb tails for ambient drones
  - Short rooms for percussive elements
  - Extreme sizes for experimental textures
- **FAUST Libraries:** `reverbs.lib` (Freeverb, Zita)

#### 2. Bitcrusher

- **Type:** Sample rate + bit depth reduction
- **Why:** Core glitch/lo-fi aesthetic, essential noise music tool
- **Parameters:**
  - `sampleRate` (100-48000 Hz) - Reduced sample rate
  - `bitDepth` (1-16 bits) - Bit resolution
  - `wetDry` (0-1) - Mix control
- **Use Cases:**
  - Lo-fi degradation of drones
  - Glitchy rhythmic elements
  - Extreme settings for harsh noise
- **Implementation:** Custom downsampling + quantization

#### 3. Ring Modulator

- **Type:** Amplitude modulation with carrier oscillator
- **Why:** Creates inharmonic/metallic tones instantly, classic noise effect
- **Parameters:**
  - `carrierFreq` (20-5000 Hz) - Modulation frequency
  - `waveform` (sine/square/saw/triangle) - Carrier shape
  - `wetDry` (0-1) - Mix control
- **Use Cases:**
  - Metallic/bell-like timbres
  - Inharmonic noise textures
  - Alien/robotic voice effects
- **Implementation:** Multiply signal by oscillator

---

### Phase 2: High Priority Effects

#### 4. Wavefolder

- **Type:** Non-linear waveshaping via folding
- **Why:** Different character than distortion, adds complex harmonics
- **Parameters:**
  - `amount` (0-10) - Fold intensity
  - `offset` (-1 to 1) - DC offset before folding
  - `stages` (1-4) - Number of fold stages
  - `symmetry` (0-1) - Asymmetric folding
- **Use Cases:**
  - Rich harmonic drones
  - West Coast synthesis style
  - Evolving timbral complexity
- **Implementation:** Fold signal back when exceeds threshold

#### 5. Frequency Shifter

- **Type:** SSB (Single Sideband) modulation
- **Why:** Shifts all frequencies by same Hz (not octaves), creates dissonance
- **Parameters:**
  - `shift` (-500 to 500 Hz) - Frequency shift amount
  - `wetDry` (0-1) - Mix control
- **Use Cases:**
  - Detuned/dissonant drones
  - Otherworldly textures
  - Slowly shifting soundscapes
- **Implementation:** Hilbert transform + modulation
- **FAUST Libraries:** `misceffects.lib`

#### 6. Granular Processor

- **Type:** Real-time granular synthesis/processing
- **Why:** Slice/rearrange audio, creates dense textures
- **Parameters:**
  - `grainSize` (10-500ms) - Length of grains
  - `density` (1-100) - Grains per second
  - `pitch` (-12 to 12 semitones) - Grain pitch shift
  - `random` (0-1) - Position randomization
  - `spray` (0-1) - Time spread
- **Use Cases:**
  - Cloud textures from drones
  - Granular time stretching
  - Glitchy particle effects
- **Implementation:** Buffer with windowed playback

---

### Phase 3: Very Useful Effects

#### 7. Phaser

- **Type:** All-pass filter cascade with LFO modulation
- **Why:** Sweeping notches create movement
- **Parameters:**
  - `rate` (0.01-10 Hz) - LFO speed
  - `depth` (0-1) - Modulation amount
  - `feedback` (0-0.95) - Resonance
  - `stages` (2-12) - Number of all-pass stages
- **Use Cases:**
  - Slow sweeps on drones
  - Rhythmic pulsing
  - Vintage synth character
- **FAUST Libraries:** `phaflangers.lib`

#### 8. Flanger

- **Type:** Short delay with feedback and LFO
- **Why:** Classic modulation effect, can be subtle or extreme
- **Parameters:**
  - `rate` (0.01-10 Hz) - LFO speed
  - `depth` (0-10ms) - Delay modulation
  - `feedback` (-0.95 to 0.95) - Resonance/metallic character
  - `offset` (0-10ms) - Base delay time
- **Use Cases:**
  - Jet plane sweeps
  - Metallic resonances
  - Subtle chorusing
- **FAUST Libraries:** `phaflangers.lib`

#### 9. Chorus

- **Type:** Multiple delayed/detuned voices
- **Why:** Thickens sounds, adds width
- **Parameters:**
  - `rate` (0.1-5 Hz) - LFO speed
  - `depth` (0-20ms) - Modulation amount
  - `voices` (2-8) - Number of chorus voices
  - `detune` (0-50 cents) - Pitch variation
  - `spread` (0-1) - Stereo width
- **Use Cases:**
  - Thicken thin drones
  - Lush pads
  - Stereo widening
- **FAUST Libraries:** `phaflangers.lib`

#### 10. Comb Filter

- **Type:** Resonant delays at harmonic intervals
- **Why:** Creates pitched resonances, tonal coloring
- **Parameters:**
  - `frequency` (20-5000 Hz) - Fundamental frequency
  - `feedback` (0-0.99) - Resonance amount
  - `damping` (0-1) - High frequency absorption
- **Use Cases:**
  - Pitched drone resonances
  - Physical modeling textures
  - Harmonic emphasis
- **Implementation:** Delay line with feedback at 1/freq

---

### Phase 4: Experimental/Advanced Effects

#### 11. Waveshaper Array

- **Type:** Multiple configurable shaping stages
- **Why:** Variety of distortion characters in one effect
- **Parameters:**
  - `curve` (soft clip/hard clip/fold/asymmetric)
  - `drive` (0-10) - Input gain
  - `mix` (0-1) - Wet/dry per stage
  - `stages` (1-4) - Serial processing
- **Use Cases:**
  - Custom distortion chains
  - Evolving harmonic content
  - Extreme saturation
- **FAUST Libraries:** `misceffects.lib` (cubicnl)

#### 12. Spectral Freeze

- **Type:** FFT-based spectrum capture/hold
- **Why:** Capture and sustain frequency content, drone sustainer
- **Parameters:**
  - `freeze` (0/1) - Hold current spectrum
  - `blur` (0-1) - Spectral smoothing
  - `mix` (0-1) - Frozen/live balance
- **Use Cases:**
  - Infinite drone sustain
  - Spectral textures
  - "Freeze frame" effects
- **Implementation:** FFT analysis with buffer hold

#### 13. Resonator Bank

- **Type:** Multiple tuned bandpass filters
- **Why:** Creates harmonic/inharmonic resonances
- **Parameters:**
  - `frequencies` (array) - Resonant frequencies
  - `q` (1-100) - Resonance sharpness
  - `decay` (0.1-10s) - Ring-out time
  - `detune` (0-1) - Frequency spread
- **Use Cases:**
  - Chordal resonances
  - Bell/gong timbres
  - Spectral filtering
- **FAUST Libraries:** `filters.lib` (resonbp)

#### 14. Convolution (Custom IR)

- **Type:** Convolution with impulse responses
- **Why:** Load different IRs for creative effects
- **Parameters:**
  - `irSelect` (0-N) - Choose impulse response
  - `mix` (0-1) - Wet/dry balance
- **Use Cases:**
  - Custom reverbs
  - Cabinet simulations
  - Creative convolution (speech, instruments)
- **FAUST Libraries:** `reverbs.lib` (convolve)

#### 15. Feedback Delay Network (FDN)

- **Type:** Matrix of interconnected delays
- **Why:** Creates dense, diffuse textures
- **Parameters:**
  - `size` (4-16) - Number of delay lines
  - `time` (0.01-2s) - Base delay time
  - `feedback` (0-0.99) - Overall feedback
  - `modulation` (0-1) - Delay time modulation
- **Use Cases:**
  - Complex reverb-like effects
  - Diffuse drones
  - Chaotic delays
- **Implementation:** Hadamard matrix + delay lines

#### 16. Karplus-Strong Resonator

- **Type:** Physical modeling string/membrane
- **Why:** Natural-sounding resonances
- **Parameters:**
  - `frequency` (20-5000 Hz) - Pitch
  - `damping` (0-1) - Decay time
  - `stiffness` (0-1) - Inharmonicity
  - `trigger` (impulse) - Excitation
- **Use Cases:**
  - Plucked string textures
  - Percussive resonances
  - Natural decay envelopes
- **FAUST Libraries:** `physmodels.lib`

---

### Phase 5: Glitch/Noise Specific

#### 17. Stutter/Glitch

- **Type:** Buffer repeater with randomization
- **Why:** Intentional glitches, rhythmic stutter
- **Parameters:**
  - `repeatLength` (10-500ms) - Buffer size
  - `probability` (0-1) - Chance of stutter
  - `feedback` (0-0.95) - Repeat decay
  - `rate` (1-100 Hz) - Retrigger rate
- **Use Cases:**
  - CD skip effects
  - Rhythmic glitches
  - Stutter edits
- **Implementation:** Circular buffer with random repeat

#### 18. Sample & Hold Filter

- **Type:** Stepped/quantized frequency/resonance
- **Why:** Stepped parameter changes, robot effect
- **Parameters:**
  - `rate` (0.1-100 Hz) - Step rate
  - `minFreq` (20-20000 Hz) - Range minimum
  - `maxFreq` (20-20000 Hz) - Range maximum
  - `smoothing` (0-1) - Step interpolation
- **Use Cases:**
  - Robot voice effects
  - Random filter sweeps
  - Bit-reduced modulation
- **Implementation:** Sample & hold + filter

#### 19. Downsampler + Aliasing

- **Type:** Intentional aliasing artifacts
- **Why:** Digital degradation, lo-fi character
- **Parameters:**
  - `sampleRate` (100-48000 Hz) - Target rate
  - `quantize` (1-16 bits) - Bit depth
  - `dither` (0/1) - Noise shaping
  - `filter` (0/1) - Anti-alias filter bypass
- **Use Cases:**
  - 8-bit video game sounds
  - Harsh digital artifacts
  - Lo-fi hip-hop textures
- **Implementation:** Downsample without reconstruction

#### 20. Envelope Follower + Gate

- **Type:** Dynamics-based audio switching
- **Why:** Create rhythmic gates from audio levels
- **Parameters:**
  - `threshold` (-60 to 0 dB) - Gate trigger level
  - `attack` (0.001-0.1s) - Gate open time
  - `release` (0.01-1s) - Gate close time
  - `hold` (0-1s) - Minimum open time
- **Use Cases:**
  - Noise gates
  - Rhythmic choppy effects
  - Sidechain-style ducking
- **Implementation:** RMS detection + gate

---

## Implementation Notes

### Build System

Current `package.json` script:

```bash
npm run faust:build
```

Compiles `faust/*.dsp` to `public/faust/*.wasm` and `*.json`

### Integration Pattern

1. Create `.dsp` file in `faust/`
2. Run `npm run faust:build`
3. Access via patch JSON:

```json
{
  "faust": {
    "module": "moduleName",
    "params": {
      "paramName": value
    },
    "bypassEffects": true
  }
}
```

### Testing

- Create QA patch in `patches/wasm/qa-##-*.json`
- Add to `patches/manifest.json` under "WASM" category
- Test parameter ranges and behavior

---

## Recommended Implementation Order

**Immediate (Next Session):**

1. Reverb (Freeverb or Zita)
2. Bitcrusher
3. Ring Modulator

**Short Term (Week 1):** 4. Wavefolder 5. Frequency Shifter

**Medium Term (Week 2):** 6. Chorus 7. Phaser 8. Comb Filter

**Long Term (Future):** 9. Granular Processor 10. Spectral Freeze 11. Resonator Bank 12. Stutter/Glitch

---

## Resources

- **FAUST Libraries:** https://faustlibraries.grame.fr/
- **FAUST Documentation:** https://faust.grame.fr/doc/manual/
- **Reverb Algorithms:** `reverbs.lib` (Freeverb, Zita-Rev1)
- **Modulation Effects:** `phaflangers.lib`
- **Filters:** `filters.lib`
- **Physical Models:** `physmodels.lib`
- **Misc Effects:** `misceffects.lib`

---

**Last Updated:** February 22, 2026
