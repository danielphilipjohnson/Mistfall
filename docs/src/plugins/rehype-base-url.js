import { visit } from 'unist-util-visit';

/** @type {import('unified').Plugin<[{ base?: string }], import('hast').Root>} */
export default function rehypeBaseUrl(options = {}) {
	const baseUrl = options.base || '/Mistfall/';
	
	return (tree) => {
		visit(tree, 'element', (node) => {
			if (node.tagName === 'a' && node.properties?.href) {
				const href = node.properties.href;
				// Only prefix absolute paths (starting with /) that don't already have the base
				if (typeof href === 'string' && href.startsWith('/') && !href.startsWith(baseUrl)) {
					// Remove leading slash and add base
					const pathWithoutSlash = href.slice(1);
					node.properties.href = baseUrl + pathWithoutSlash;
				}
			}
		});
	};
}

