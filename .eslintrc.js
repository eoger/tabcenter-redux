module.exports = {
  "env": {
    "browser": true,
    "es6": true,
    "commonjs": true,
    "webextensions": true
  },
  "extends": "eslint:recommended",
  "parserOptions": {
    "ecmaVersion": 8
  },
  "rules": {
    "brace-style": [
      "error",
      "1tbs"
    ],
    "curly": [
      "error"
    ],
    "indent": [
      "error",
      2
    ],
    "key-spacing": ["error"],
    "keyword-spacing": [
      "error",
      {
        "before": true,
        "after": true
      }
    ],
    "no-console": [
      0
    ],
    "no-multi-spaces": [
      "error"
    ],
    "no-trailing-spaces": [
      "error"
    ],
    "no-var": [
      "error"
    ],
    "prefer-template": [
      "error"
    ],
    "quotes": [
      "error",
      "double"
    ],
    "semi": [
      "error",
      "always"
    ],
    "space-before-blocks": ["error"]
  }
};
