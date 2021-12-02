const { overrides } = require('@netlify/eslint-config-node')

module.exports = {
  extends: '@netlify/eslint-config-node',
  parserOptions: {
    sourceType: 'module',
  },
  rules: {
    'import/extensions': [2, 'ignorePackages'],
    // TODO: remove once bug in eslint-plugin-node is fixed:
    // https://github.com/mysticatea/eslint-plugin-node/issues/250
    'node/no-unsupported-features/es-syntax': [2, { ignores: ['modules', 'dynamicImport'] }],
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
  overrides: [...overrides],
}
