/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			colors: {
				'bg-primary': '#F8FAFC',
				'bg-secondary': '#FFFFFF',
				'bg-panel': '#F1F5F9',
				'bg-card': '#FFFFFF',
				'text-primary': '#0F172A',
				'text-secondary': '#475569',
				'text-tertiary': '#94A3B8',
				'player-1': '#3B82F6',
				'player-2': '#F59E0B',
				'player-3': '#8B5CF6',
				'border-default': '#E2E8F0'
			},
			fontFamily: {
				sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
				mono: ['JetBrains Mono', 'Fira Code', 'Courier New', 'monospace']
			}
		}
	},
	plugins: [require('daisyui')],
	daisyui: {
		themes: [
			{
				light: {
					...require('daisyui/src/theming/themes')['light'],
					'base-100': '#F8FAFC',
					'base-200': '#FFFFFF',
					'base-300': '#F1F5F9',
					primary: '#3B82F6',
					secondary: '#F59E0B',
					accent: '#8B5CF6',
					success: '#10B981',
					warning: '#F59E0B',
					error: '#EF4444'
				}
			}
		],
		darkTheme: false
	}
};
