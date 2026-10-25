import test from 'node:test';
import assert from 'node:assert/strict';
import { logGenerationPrompt } from '../shared/logPrompt.mjs';

const details = { prompt: 'Exact prompt\nKeep identity unchanged.', mode: 'The Boss', variation: '1/3 · Creative Studio', quality: 'high', id: 'request-123', apiKey: 'never-log-this', image: 'data:image/jpeg;base64,private' };

test('server log includes exact prompt and selected metadata without credentials or image bytes', t => {
  const output = [];
  t.mock.method(console, 'info', text => output.push(text));
  logGenerationPrompt(details);
  assert.equal(output.length, 1);
  assert.ok(output[0].includes(details.prompt));
  assert.match(output[0], /request-123/);
  assert.match(output[0], /gpt-image-2.5-flare/);
  assert.match(output[0], /high/);
  assert.doesNotMatch(output[0], /never-log-this|data:image/);
});

test('browser log uses a collapsed CSS-styled group and logs the exact prompt', t => {
  const originalWindow = globalThis.window;
  globalThis.window = {};
  const groups = [], prompts = [], tables = [];
  t.mock.method(console, 'groupCollapsed', (...args) => groups.push(args));
  t.mock.method(console, 'log', (...args) => prompts.push(args));
  t.mock.method(console, 'table', value => tables.push(value));
  const end = t.mock.method(console, 'groupEnd', () => {});
  try {
    logGenerationPrompt(details);
    assert.match(groups[0][0], /%c.*Generation prompt/);
    assert.match(groups[0][1], /background:.*color:/);
    assert.equal(prompts[0][2], details.prompt);
    assert.equal(tables[0].Variation, details.variation);
    assert.equal(end.mock.callCount(), 1);
    assert.doesNotMatch(JSON.stringify([groups, prompts, tables]), /never-log-this|data:image/);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test('preview logs are clearly labeled as not sent', t => {
  let output;
  t.mock.method(console, 'info', text => { output = text; });
  logGenerationPrompt({ ...details, preview: true });
  assert.match(output, /Preview prompt \(not sent\)/);
});
