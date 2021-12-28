import { spy } from 'sinon'

// Normalize `netlifyRegistry.set()` spied calls to an object
export const normalizeHandler = function ([name, { onRequest }]) {
  return { name, onRequest }
}

// Check whether the handler have the correct shape
export const isValidHandler = function ({ name, onRequest }) {
  return typeof name === 'string' && typeof onRequest === 'function'
}

// Call `onRequest(event)` on a specific handler.
// Retrieve both the handler's return value and logs (`console.log()`)
export const callHandler = async function (t, handlers, name, event) {
  const exampleHandler = handlers.find((handler) => handler.name === name)
  t.true(exampleHandler !== undefined)
  const oldConsoleLog = mockConsoleLog()
  const returnValue = await exampleHandler.onRequest(event)
  const logs = unmockConsoleLog(oldConsoleLog)
  return { returnValue, logs }
}

// Temporarily mock `console.log()` in order to retrieve the logs
const mockConsoleLog = function () {
  const oldConsoleLog = console.log
  console.log = spy()
  return oldConsoleLog
}

const unmockConsoleLog = function (oldConsoleLog) {
  const logs = console.log.args.flat().join(' ')
  console.log = oldConsoleLog
  return logs
}
