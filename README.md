# Traffic Light Sequencer

A small lab exercise that simulates configurable traffic light cycles and logs anomalies.

## Files

- `trafficLightSequencer.js` — contains `runSequence` and `generateTimeline`.

## Config Shape

```js
const config = {
  fault: false,
  phases: [
    { color: 'green', duration: 5 },
    { color: 'yellow', duration: 2 },
    { color: 'red', duration: 4 },
  ],
};
```

## Functions

### `runSequence(config, cycles)`

Iterates through `config.phases` for the given number of `cycles`.

- If `config.phases` is empty, logs `No phases found` and returns immediately.
- If `config.fault` is `true`, logs `Faulted phase!` and stops the entire simulation.
- If a phase's `duration` is `<= 0`, logs `Invalid phase detected` and moves on to the next phase.
- Otherwise logs `Switching to [color] for [duration] s`.

```js
runSequence(config1, 1);
// Switching to green for 5 s
// Switching to yellow for 2 s
// Switching to red for 4 s
```

### `generateTimeline(config, cycles)`

Builds an array of cumulative elapsed time after each phase, across all cycles, without any validation (fault and invalid durations are still added to the running total).

```js
generateTimeline(config1, 1);
// [5, 7, 11]
```

## Usage

```js
const { runSequence, generateTimeline } = require('./trafficLightSequencer');

runSequence(config1, 1);
const timeline = generateTimeline(config1, 1);
```

## Notes

- No extra `console.log` calls were added beyond what the spec requires, so the test suite can match output exactly.
- Both functions use plain `for` loops to iterate across phases and cycles, per the lab requirements.
