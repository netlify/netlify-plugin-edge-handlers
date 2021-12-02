const { overrides } = require('@netlify/eslint-config-node')

module.exports = {
  extends: '@netlify/eslint-config-node',
  parserOptions: {
    sourceType: 'module',
  },
  rules: {
    'import/extensions': [2, 'ignorePackages'],
    // Those rules from @netlify/eslint-config-node are currently disabled
    // TODO: remove, so those rules are enabled
    complexity: 0,
    'func-style': 0,
    'max-lines': 0,
    'max-params': 0,
    'max-statements': 0,
    'no-magic-numbers': 0,
    'require-await': 0,
  },
  overrides: [...overrides],
}
