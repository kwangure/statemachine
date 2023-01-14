/**
 * @typedef {import("./nodes/nodes").PMTemplateNode} PMTemplateNode
 */

export class PMStack {
	/** @type {PMTemplateNode[]} */
	#value;

	/**
	 * @param {PMTemplateNode[]} values
	 */
	constructor(...values) {
		this.#value = [...values];
	}

	/**
	 * @template {PMTemplateNode['type']} T
	 * @param {{ depth?: number, expect?: T } | undefined} [options]
	 */
	peek(options) {
		const { depth = 1, expect } = options || {};
		if (this.#value.length === 0) {
			throw Error('Attempted to peek an empty stack');
		}
		const value = /** @type {PMTemplateNode} */(this.#value.at(-1 * depth));
		if (expect && value.type !== expect) {
			throw Error(`Expected to peek a '${expect}' node, but found a '${value.type}' instead.`);
		}
		return /** @type {Extract<PMTemplateNode, { type: T }>} */(value);
	}

	/**
	 * @template {PMTemplateNode['type']} T
	 * @param {{ expect?: T } | undefined} [options]
	 */
	pop(options = {}) {
		if (this.#value.length === 0) {
			throw Error('Attempted to pop an empty stack');
		}
		const value = /** @type {PMTemplateNode} */(this.#value.pop());
		if (options.expect && value.type !== options.expect) {
			throw Error(`Expected to pop a '${options.expect}' node, but found a '${value.type}' instead.`);
		}
		return /** @type {Extract<PMTemplateNode, { type: T }>} */(value);
	}

	/**
	 * @param {PMTemplateNode[]} values
	 */
	push(...values) {
		return this.#value.push(...values);
	}

	toJSON() {
		return this.#value;
	}

	get size() {
		return this.#value.length;
	}
}
