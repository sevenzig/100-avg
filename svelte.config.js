import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			out: 'build'
			// Note: Body size limit is controlled by BODY_SIZE_LIMIT environment variable
			// Set in docker-compose.prod.yml and .env.production (12MB = 12582912 bytes)
		})
	}
};

export default config;
