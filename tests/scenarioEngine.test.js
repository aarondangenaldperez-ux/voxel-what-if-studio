import test from 'node:test';
import assert from 'node:assert/strict';
import { buildScenarioPlan } from '../src/engine/scenarioEngine.js';
import { detectEnvironment } from '../src/engine/environmentCatalog.js';

function assertFiveSecondInterruption(plan, eventName) {
  assert.equal(plan.eventDurationSeconds, 5);
  assert.equal(plan.beats[1].event, eventName);
  assert.equal(plan.beats[1].durationSeconds, 5);
  assert.notEqual(plan.beats[2].event, eventName);
  assert.equal(plan.durationSeconds, 56);
  assert.equal(plan.beats.reduce((total, beat) => total + beat.durationSeconds, 0), 56);
}

test('rubber prompt creates a 56-second storyboard with a real five-second rubber loss', () => {
  const plan = buildScenarioPlan('What if all rubber disappeared for 5 seconds?');
  assert.equal(plan.id, 'rubber');
  assert.equal(plan.supported, true);
  assert.equal(plan.beats.length, 5);
  assertFiveSecondInterruption(plan, 'rubber-loss');
  assert.equal(plan.beats[2].event, 'traffic-paused');
  assert.equal(plan.beats[4].event, 'restored');
});

test('gravity prompt creates a distinct five-second weightlessness sequence', () => {
  const plan = buildScenarioPlan('What if gravity vanished temporarily?');
  assert.equal(plan.id, 'gravity');
  assertFiveSecondInterruption(plan, 'gravity-loss');
  assert.equal(plan.beats[2].event, 'gravity-return');
});

test('electricity prompt creates a city blackout sequence', () => {
  const plan = buildScenarioPlan('What if electricity disappeared?');
  assert.equal(plan.id, 'electricity');
  assert.equal(plan.beats[1].event, 'power-loss');
  assert.equal(plan.beats[2].event, 'blackout');
  assert.equal(plan.beats[4].event, 'restored');
  assert.equal(plan.durationSeconds, 56);
});

test('unmapped prompts are labelled honestly instead of inventing effects', () => {
  const plan = buildScenarioPlan('What if the Moon vanished?');
  assert.equal(plan.id, 'exploration');
  assert.equal(plan.supported, false);
  assert.equal(plan.beats[1].event, 'unmapped');
  assert.equal(plan.durationSeconds, 56);
});

test('environment classifier selects distinct production environments', () => {
  assert.equal(detectEnvironment('What if an airport lost all power?'), 'airport');
  assert.equal(detectEnvironment('What if a school vanished?'), 'school');
  assert.equal(detectEnvironment('What if the ocean disappeared?'), 'ocean');
  assert.equal(detectEnvironment('What if the Moon vanished?'), 'space');
  assert.equal(detectEnvironment('What if a factory stopped?'), 'factory');
  assert.equal(detectEnvironment('What if a forest vanished?'), 'nature');
});

test('mapped city physics is not falsely claimed for a different environment', () => {
  const plan = buildScenarioPlan('What if rubber disappeared at an airport?');
  assert.equal(plan.environment, 'airport');
  assert.equal(plan.supported, false);
  assert.equal(plan.id, 'exploration');
});
