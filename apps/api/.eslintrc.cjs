module.exports = {
  root: true,
  env: {
    node: true,
    jest: false,
  },
  extends: ['../../packages/config/eslint.base.cjs'],
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ['./tsconfig.json'],
  },
  ignorePatterns: ['dist'],
};
