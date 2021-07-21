const { overrides } = require('@netlify/eslint-config-node')

module.exports = {
  extends: '@netlify/eslint-config-node',
  rules: {
    // Those rules from @netlify/eslint-config-node are currently disabled
    // TODO: remove, so those rules are enabled
    complexity: 0,
    'func-style': 0,
    'max-lines': 0,
    'max-params': 0,
    'max-statements': 0,
    'no-magic-numbers': 0,
    'require-await': 0,
    'fp/no-delete': 0,
    'fp/no-let': 0,
    'fp/no-mutating-methods': 0,
    'fp/no-mutation': 0,
  },
  overrides: [
    ...overrides,
    {
      files: ['src/node-compat/*.js', 'test/**/*edge-handlers/*.js'],
      parserOptions: {
        sourceType: 'module',
      },
      rules: {
        'node/no-unsupported-features/es-builtins': 0,
        'node/no-unsupported-features/es-syntax': 0,
      },
    },
  ],
}
