import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	
	// Optimize dependencies for faster dev startup
	optimizeDeps: {
		include: [
			'better-sqlite3',
			'bcryptjs',
			'jsonwebtoken',
			'chart.js'
		],
		exclude: ['@anthropic-ai/sdk'], // Exclude heavy SDK from pre-bundling
		esbuildOptions: {
			target: 'esnext'
		}
	},
	
	// Optimize esbuild for faster transforms
	esbuild: {
		target: 'esnext',
		// Disable source maps in dev for faster builds
		sourcemap: false
	},
	
	// Server configuration for better performance
	server: {
		// Reduce file watching overhead on Windows
		watch: {
			usePolling: false,
			// Ignore common directories that don't need watching
			ignored: [
				'**/node_modules/**',
				'**/.git/**',
				'**/build/**',
				'**/.svelte-kit/**',
				'**/database/**'
			]
		},
		// Increase HMR timeout for slower systems
		hmr: {
			overlay: true
		}
	},
	
	// Build optimizations
	build: {
		// Disable source maps in dev builds for speed
		sourcemap: false,
		// Increase chunk size warning limit
		chunkSizeWarningLimit: 1000
	},
	
	// Disable source maps in development for faster builds
	// Source maps can be re-enabled if needed for debugging
	// by setting sourcemap: true in esbuild and build sections
});
