/**
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
 * @return {import('type-fest').SetOptional<Element, 'end'>}
 */
export function element({ name, start, end }) {
	return {
		start,
		end,
		type: 'Element',
		name,
		children: /** @type {TemplateNode[]} */([]),
	};
}

/**
 * @param {number} start
 * @param {number} end
 * @return {Fragment}
 */
export function fragment(start, end) {
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
	return {
		error,
		start,
		end,
		type: 'Invalid',
	};
}
