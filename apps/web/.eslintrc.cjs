module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
  },
  extends: ['../../packages/config/eslint.react.cjs'],
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ['./tsconfig.json'],
  },
  ignorePatterns: ['dist'],
};
