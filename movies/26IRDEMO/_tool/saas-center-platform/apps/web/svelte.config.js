import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		// adapter-node for Node.js server deployment
		adapter: adapter({
			out: 'build',
			precompress: true,
			envPrefix: ''
		}),
		alias: {
			'@assessment/rorschach/*': 'assessment/rorschach/*',
			'@common/*': 'common/*',
			'$root/*': './*',
			'$services/*': 'src/lib/services/*',
			'$types/*': 'src/lib/types/*',
			'$stores/*': 'src/lib/stores/*',
			'$utils/*': 'src/lib/utils/*'
		}
	}
};

export default config;
