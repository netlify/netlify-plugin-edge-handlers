const { overrides } = require('@netlify/eslint-config-node/.eslintrc_esm.cjs')

module.exports = {
  extends: '@netlify/eslint-config-node/.eslintrc_esm.cjs',
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
  },
  overrides: [...overrides],
}
