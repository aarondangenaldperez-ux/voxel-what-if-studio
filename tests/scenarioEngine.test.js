import test from 'node:test';
import assert from 'node:assert/strict';
import { buildScenarioPlan } from '../src/engine/scenarioEngine.js';

test('rubber prompt creates the five-beat rubber-loss sequence', () => {
  const plan = buildScenarioPlan('What if all rubber disappeared for 5 seconds?');
  assert.equal(plan.id, 'rubber');
  assert.equal(plan.supported, true);
  assert.equal(plan.beats.length, 5);
  assert.equal(plan.beats[1].event, 'rubber-loss');
  assert.equal(plan.beats[4].event, 'restored');
});

test('gravity prompt creates a distinct weightlessness sequence', () => {
  const plan = buildScenarioPlan('What if gravity vanished temporarily?');
  assert.equal(plan.id, 'gravity');
  assert.equal(plan.beats[1].event, 'gravity-loss');
  assert.equal(plan.beats[2].event, 'weightless');
});

test('electricity prompt creates a city blackout sequence', () => {
  const plan = buildScenarioPlan('What if electricity disappeared?');
  assert.equal(plan.id, 'electricity');
  assert.equal(plan.beats[1].event, 'power-loss');
  assert.equal(plan.beats[4].event, 'restored');
});

test('unmapped prompts are labelled honestly instead of inventing effects', () => {
  const plan = buildScenarioPlan('What if the Moon vanished?');
  assert.equal(plan.id, 'exploration');
  assert.equal(plan.supported, false);
  assert.equal(plan.beats[1].event, 'unmapped');
});
