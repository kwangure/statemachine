class PMBaseNode {
	/** @type {PMInvalid | undefined} */
	error;

	/**
	 * @param {PMTemplateNode} node
	 */
	append(node) {
		throw Error(`${this.constructor.name.replace('PM', '')} nodes do not take '${node.type}' as a child.`);
	}
}

/**
 * @typedef {PMAttribute | PMComment | PMElement | PMFragment | PMInvalid | PMText} PMTemplateNode
 */

export class PMAttribute extends PMBaseNode {
	/**
	 * @param {Object} options
	 * @param {string} options.name
	 * @param {number} options.start
	 * @param {number} [options.end]
	 */
	constructor({ name, start, end }) {
		super();

		this.start = start;
		this.end = end;
		/** @type {'Attribute'} */
		this.type = 'Attribute';
		this.name = name;
		/** @type {PMTemplateNode[] | true} */
		this.value = ([]);
	}

	/**
	 * @param {PMTemplateNode} node
	 */
	append(node) {
		switch (node.type) {
			case 'Text':
				if (Array.isArray(this.value)) {
					this.value.push(node);
				} else {
					this.value = [node];
				}
				break;
			default:
				super.append(node);
		}
	}
}

export class PMElement extends PMBaseNode {
	/**
	 * @param {Object} options
	 * @param {string} options.name
	 * @param {number} options.start
	 * @param {number} [options.end]
	 */
	constructor({ name, start, end }) {
		super();
		this.start = start;
		this.end = end;
		/** @type {'Element'} */
		this.type = 'Element';
		this.name = name;
		this.attributes = /** @type {PMAttribute[]} */([]);
		this.children = /** @type {PMTemplateNode[]} */([]);
	}

	/**
	 * @param {PMTemplateNode} node
	 */
	append(node) {
		switch (node.type) {
			case 'Attribute':
				this.attributes.push(node);
				break;
			case 'Comment':
			case 'Element':
			case 'Invalid':
				this.children.push(node);
				break;
			case 'Text':
				const lastChild = this.children.at(-1);
				if (lastChild?.type === 'Text') {
					lastChild.end = node.end;
					lastChild.raw += node.raw;
					lastChild.data = lastChild.raw;
				} else {
					this.children.push(node);
				}
				break;
			default:
				super.append(node);
		}
	}
}

export class PMComment extends PMBaseNode {
	/**
	 * @param {Object} options
	 * @param {string} options.data
	 * @param {number} options.start
	 * @param {number} [options.end]
	 */
	constructor({ data, start, end }) {
		super();
		this.data = data;
		this.start = start;
		this.end = end;
		/** @type {'Comment'} */
		this.type = 'Comment';
		this.ignores = /** @type {string[]} */([]);
	}
}

export class PMFragment extends PMBaseNode {
	/**
	 * @param {Object} options
	 * @param {number} options.start
	 * @param {number} [options.end]
	 */
	constructor({ start, end }) {
		super();
		this.start = start;
		this.end = end;
		/** @type {'Fragment'} */
		this.type = 'Fragment';
		this.children = /** @type {PMTemplateNode[]} */([]);
	}

	/**
	 * @param {PMTemplateNode} node
	 */
	append(node) {
		switch (node.type) {
			case 'Comment':
			case 'Element':
				this.children.push(node);
				break;
			case 'Text':
				const lastChild = this.children.at(-1);
				if (lastChild?.type === 'Text') {
					lastChild.end = node.end;
					lastChild.raw += node.raw;
					lastChild.data = lastChild.raw;
				} else {
					this.children.push(node);
				}
				break;
			default:
				super.append(node);
		}
	}
}

export class PMInvalid extends PMBaseNode {
	/**
	 * @param {Object} options
	 * @param {string} options.code
	 * @param {string} options.message
	 * @param {number} options.start
	 * @param {number} [options.end]
	 */
	constructor({ code, message, start, end }) {
		super();

		this.code = code;
		this.message = message;
		this.start = start;
		this.end = end;
		/** @type {'Invalid'} */
		this.type = 'Invalid';
	}

	/**
	 * @param {{ type: any; }} node
	 */
	append(node) {
		throw Error(`Invalid nodes do not take '${node.type}' as child.`);
	}
}

export class PMText extends PMBaseNode {
	/**
	 * @param {Object} options
	 * @param {string} options.data
	 * @param {string} options.raw
	 * @param {number} options.start
	 * @param {number} [options.end]
	 */
	constructor({ data, raw, start, end }) {
		super();
		this.start = start;
		this.end = end;
		/** @type {'Text'} */
		this.type = 'Text';
		this.raw = raw;
		this.data = data;
		this.raw
	}
}
