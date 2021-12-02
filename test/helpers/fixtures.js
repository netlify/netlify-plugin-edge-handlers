import { fileURLToPath } from 'url'

const FIXTURES_DIR = fileURLToPath(new URL('../fixtures', import.meta.url))

// Resolve fixture name to an absolute path
export const resolveFixtureName = function (fixtureName) {
  return `${FIXTURES_DIR}/${fixtureName}`
}
