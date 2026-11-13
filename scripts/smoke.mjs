/**
 * Smoke test for the Host half: it must load, export `apply`, and register every
 * agent tool without touching the filesystem or the network.
 *
 * No DSH runtime is needed — the Cordis context is stubbed with just the two
 * things `apply` uses (an effect runner and the tool registry).
 */
import assert from 'node:assert/strict'
import { apply, inject } from '../index.js'

const EXPECTED = [
  'todo_add',
  'todo_list',
  'todo_update',
  'todo_done',
  'todo_undo',
  'todo_archive',
  'todo_unarchive',
  'todo_hide',
  'todo_unhide',
  'todo_remove',
  'todo_export',
]

assert.deepEqual(inject, ['tools'], 'the Host half declares exactly one dependency')
assert.equal(typeof apply, 'function', 'apply must be exported')

const registered = []
const ctx = {
  effect(fn) {
    fn()
    return () => {}
  },
  tools: {
    register(definition) {
      assert.equal(typeof definition.execute, 'function', `${definition.name} needs execute`)
      assert.equal(typeof definition.description, 'string', `${definition.name} needs a description`)
      assert.equal(definition.parameters.type, 'object', `${definition.name} needs an object parameter schema`)
      assert.equal(definition.parameters.additionalProperties, false, `${definition.name} must reject unknown arguments`)
      registered.push(definition.name)
      return () => {}
    },
  },
  // `apply` probes optional services through ctx.inject and ctx.get.
  inject(_names, callback) {
    callback({ effect: ctx.effect, webServer: { register: () => () => {} } })
  },
  get() {
    return undefined
  },
}

apply(ctx, {})

assert.deepEqual([...registered].sort(), EXPECTED.slice().sort(), 'every tool must register')
console.log(`smoke ok — ${registered.length} tools: ${registered.join(' ')}`)
