// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	site: 'https://danielphilipjohnson.github.io',
	base: '/Mistfall/',
	trailingSlash: 'always',
	integrations: [
		starlight({
			editLink: {
				baseUrl: 'https://danielphilipjohnson.github.io/Mistfall/',
			},
			title: 'Mistfall Demo Docs',
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/withastro/starlight' }],
			sidebar: [
				{
					label: 'Overview',
					items: [
						{ label: 'Welcome', slug: 'index' },
						{ label: 'Product Overview', slug: 'overview' },
						{ label: 'Quickstart', slug: 'quickstart' },
						{ label: 'Why Mistfall', slug: 'why-mistfall' },
						{ label: 'Getting Started', slug: 'getting-started' },
					],
				},
				{
					label: 'Foundations',
					items: [
						{ label: 'Working with Schema', slug: 'working-with-schema' },
						{ label: 'Connecting to Mistfall', slug: 'foundations-connecting' },
						{ label: 'Querying Data', slug: 'foundations-querying' },
						{ label: 'Migrations', slug: 'foundations-migrations' },
						{ label: 'API Reference', slug: 'api-reference' },
					],
				},
				{
					label: 'Integrations',
					items: [
						{ label: 'Overview', slug: 'integrations/overview' },
						{ label: 'Astro', slug: 'integrations/astro' },
					],
				},
				{
					label: 'Demos',
					items: [
						{ label: 'Schema DSL', slug: 'demos/schema-dsl' },
						{ label: 'Runtime CRUD', slug: 'demos/runtime-crud' },
						{ label: 'Predicates', slug: 'demos/predicates' },
						{ label: 'Pagination', slug: 'demos/pagination' },
						{ label: 'Transactions', slug: 'demos/transactions' },
						{ label: 'Adapters', slug: 'demos/adapters' },
						{ label: 'Todo Demo', slug: 'todo-demo' },
						{ label: 'Ecommerce Demo', slug: 'ecommerce-demo' },
					],
				},
				{
					label: 'Tutorials',
					items: [
						{ label: 'Full Guide', slug: 'tutorials/full-guide' },
						{ label: 'Tables & Columns', slug: 'tutorials/tables-and-columns' },
						{ label: 'Querying', slug: 'tutorials/querying' },
					],
				},
			],
		}),
	],
});
