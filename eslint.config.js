import js from '@eslint/js';
import globals from 'globals';
import { defineConfig } from 'eslint/config';

export default defineConfig({
	files: ['**/*.js'],
	ignores: ['dist/**'],
	plugins: { js },
	extends: ['js/recommended'],
	languageOptions: {
		globals: {
			...globals.browser,
			...globals.node
		}
	},
	rules: {
		'semi': ['error', 'always'],
		'quotes': ['error', 'single'],
		'indent': ['error', 'tab']
	}
});
