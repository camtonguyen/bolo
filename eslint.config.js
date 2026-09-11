import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: { ecmaVersion: 2022, globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // The terminal never breaks character — use an in-world DispatchPrompt instead.
      'no-restricted-globals': [
        'error',
        { name: 'alert', message: 'Use an in-world DispatchPrompt instead of alert().' },
        { name: 'confirm', message: 'Use an in-world DispatchPrompt instead of confirm().' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'window', property: 'alert', message: 'Use an in-world DispatchPrompt instead of window.alert().' },
        { object: 'window', property: 'confirm', message: 'Use an in-world DispatchPrompt instead of window.confirm().' },
      ],
    },
  },
);
