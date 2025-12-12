/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: ['next/core-web-vitals'],
  rules: {
    // Reducimos ruido de lint en build: permitir variables/params no usados
    '@typescript-eslint/no-unused-vars': 'off',
  },
};
