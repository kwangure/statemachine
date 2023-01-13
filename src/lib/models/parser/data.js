/**
 * @template T
 * @type {Stack<T>}
 */
export class Stack {
	/** @type {T[]} */
	#value;

	/**
	 * @param {T[]} values
	 */
	constructor(...values) {
		this.#value = [...values];
	}

	peek() {
		if (this.#value.length === 0) {
			throw Error('Attempted to peek an empty stack');
		}
		return /** @type {T} */(this.#value.at(-1));
	}

	pop() {
		if (this.#value.length === 0) {
			throw Error('Attempted to pop an empty stack');
		}
		return /** @type {T} */(this.#value.pop());
	}

	/**
	 * @param {T[]} values
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
