/**
 * @typedef {import('./types').Attribute} Attribute
 * @typedef {import('./types').Comment} Comment
 * @typedef {import('./types').Element} Element
 * @typedef {import('./types').Fragment} Fragment
 * @typedef {import('./types').Invalid} Invalid
 * @typedef {import('./types').TemplateNode} TemplateNode
 */

/**
 * @param {Object} options
 * @param {string} options.name
 * @param {number} options.start
 * @param {number} [options.end]
 * @return {import('type-fest').SetOptional<Attribute, 'end'>}
 */
export function attribute({ name, start, end }) {
	// Sort the object properties in the same order as the Svelte compiler to make
	// tests and debugging easier
	return {
		start,
		end,
		type: 'Attribute',
		name,
		value: /** @type {TemplateNode[]} */([]),
	};
}

/**
 * @param {Object} options
 * @param {string} options.name
 * @param {number} options.start
 * @param {number} [options.end]
 * @return {import('type-fest').SetOptional<Element, 'end'>}
 */
export function element({ name, start, end }) {
	// Sort the object properties in the same order as the Svelte compiler to make
	// tests and debugging easier
	return {
		start,
		end,
		type: 'Element',
		name,
		attributes: /** @type {Attribute[]} */([]),
		children: /** @type {TemplateNode[]} */([]),
	};
}

/**
 * @param {Object} options
 * @param {string} options.data
 * @param {number} options.start
 * @param {number} [options.end]
 * @return {import('type-fest').SetOptional<Comment, 'end'>}
 */
export function comment({ data, start, end }) {
	// Sort the object properties in the same order as the Svelte compiler to make
	// tests and debugging easier
	return {
		start,
		end,
		type: 'Comment',
		data,
		ignores: /** @type {string[]} */([]),
	};
}

/**
 * @param {number} start
 * @param {number} end
 * @return {Fragment}
 */
export function fragment(start, end) {
	// Sort the object properties in the same order as the Svelte compiler to make
	// tests and debugging easier
	return {
		start,
		end,
		type: 'Fragment',
		children: /** @type {TemplateNode[]} */([]),
	};
}

/**
 * @param {Object} options
 * @param {number} options.start
 * @param {number} [options.end]
 * @param {{ code: string, message: string }} options.error
 * @return {import('type-fest').SetOptional<Invalid, 'end'>}
 */
export function invalid({ error, start, end }) {
	// Sort the object properties in the same order as the Svelte compiler to make
	// tests and debugging easier
	return {
		error,
		start,
		end,
		type: 'Invalid',
	};
}
