import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

// Standalone config for unit tests so we don't need to load SvelteKit/vite.config
export default defineConfig({
	test: {
		include: ['tests/**/*.test.ts'],
		environment: 'node',
		globals: true
	},
	resolve: {
		alias: {
			$lib: resolve(__dirname, './src/lib'),
			'$env/dynamic/private': resolve(__dirname, './tests/mocks/env-private.ts'),
			'$app/environment': resolve(__dirname, './tests/mocks/app-environment.ts')
		}
	}
});
