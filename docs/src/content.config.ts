import { defineCollection } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import rehypeBaseUrl from './plugins/rehype-base-url.js';

export const collections = {
	docs: defineCollection({ 
		loader: docsLoader({
			markdown: {
				rehypePlugins: [[rehypeBaseUrl, { base: '/Mistfall/' }]],
			},
		}), 
		schema: docsSchema() 
	}),
};
