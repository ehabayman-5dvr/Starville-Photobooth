import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function variationModule() {
  const source = await readFile('src/variation.ts', 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled + `\n// ${Math.random()}`).toString('base64')}`);
}

test('cycles each mode independently through three variations, retaining position across mode changes', async () => {
  const data = new Map();
  globalThis.localStorage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
  const { nextVariation, advanceVariation } = await variationModule();
  assert.equal(nextVariation('boss'), 0);
  advanceVariation('boss', 0); assert.equal(nextVariation('boss'), 1);
  assert.equal(nextVariation('explorer'), 0);
  advanceVariation('explorer', 0); assert.equal(nextVariation('explorer'), 1);
  assert.equal(nextVariation('boss'), 1);
  advanceVariation('boss', 1); assert.equal(nextVariation('boss'), 2);
  advanceVariation('boss', 2); assert.equal(nextVariation('boss'), 0);
  const reloaded = await variationModule();
  assert.equal(reloaded.nextVariation('explorer'), 1);
  delete globalThis.localStorage;
});

test('blocked browser storage still cycles in memory', async () => {
  globalThis.localStorage = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  const { nextVariation, advanceVariation } = await variationModule();
  assert.equal(nextVariation('boss'), 0);
  advanceVariation('boss', 0); assert.equal(nextVariation('boss'), 1);
  advanceVariation('boss', 1); assert.equal(nextVariation('boss'), 2);
  advanceVariation('boss', 2); assert.equal(nextVariation('boss'), 0);
  delete globalThis.localStorage;
});

test('malformed persisted variation values fall back to the first scene', async () => {
  for (const value of ['not json', '{"boss":3}', '{"boss":-1}', '{"boss":"1"}', 'null']) {
    globalThis.localStorage = { getItem: () => value, setItem: () => {} };
    const module = await variationModule();
    assert.equal(module.nextVariation('boss'), 0);
  }
  delete globalThis.localStorage;
});
