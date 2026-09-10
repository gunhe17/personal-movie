import adapter from '@sveltejs/adapter-node'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),

  kit: {
    adapter: adapter({
      out: 'build',
      precompress: true,
      envPrefix: ''
    }),
    alias: {
      '$stores/*': 'src/lib/stores/*',
      '$utils/*': 'src/lib/utils/*',
      '$types/*': 'src/lib/types/*',
      '$services/*': 'src/lib/services/*',
      '$components/*': 'src/lib/components/*',
      '$features/*': 'src/lib/features/*'
    }
  }
}

export default config
