import { ESArray, ESBoolean, ESMap, ESNumber, ESString } from "eventscript/nodes";

/** *
 * @param {PMBaseNode<string>} node
 * @param {string} property
 */
function PMError(node, property) {
	return Error(`${node.constructor.name.replace('PM', '')} does not have the ${property} property`);
}

/**
 * @template {string} T
 * @extends {ESMap<string, PMBaseNode<any>>}
 */
class PMBaseNode extends ESMap {
	/**
	 * @param {any} value
	 */
	constructor(value) {
		super(value);
	}

	/**
	 * @param {PMTemplateNode} node
	 */
	append(node) {
		throw Error(`${this.constructor.name.replace('PM', '')} nodes do not take '${node.get('type')}' as a child.`);
	}

	/** @type {number | ESNumber} */
	get end() {
		const value = this.get('end');
		if (!value) throw PMError(this, 'end');
		return Number(value);
	}
	set end(end) {
		const value = this.get('end');
		if (!value) throw PMError(this, 'end');
		value.set(end);
	}

	/** @param {PMInvalid} value */
	set error(value) {
		this.set('error', value);
	}

	/** @type {string} */
	get data() {
		const value = this.get('data');
		if (!value) throw PMError(this, 'data');
		return String(value);
	}
	set data(data) {
		const value = this.get('data');
		if (!value) throw PMError(this, 'data');
		value.set(data);
	}

	/** @type {string} */
	get name() {
		const value = this.get('name');
		if (!value) throw PMError(this, 'name');
		return String(value);
	}
	set name(name) {
		const value = this.get('name');
		if (!value) throw PMError(this, 'name');
		value.set(name);
	}

	/** @type {string} */
	get raw() {
		const value = this.get('raw');
		if (!value) throw PMError(this, 'raw');
		return String(value);
	}
	set raw(raw) {
		const value = this.get('raw');
		if (!value) throw PMError(this, 'raw');
		value.set(raw);
	}

	/** @type {number} */
	get start() {
		const value = this.get('start');
		if (!value) throw PMError(this, 'start');
		return Number(value);
	}
	set start(start) {
		const value = this.get('start');
		if (!value) throw PMError(this, 'start');
		value.set(start);
	}

	/** @type {T} */
	get type() {
		const value = this.get('type');
		if (!value) throw PMError(this, 'type');
		return /** @type {T} */(String(value));
	}

	/** @type {boolean | any[]} */
	get value() {
		const value = this.get('value');
		if (!value) throw PMError(this, 'value');
		if (value instanceof Boolean) {
			return Boolean(value);
		}
		return [...value];
	}
	set value(_value) {
		const value = this.get('value');
		if (!value) throw PMError(this, 'value');
		// TODO: Preserve subscribers? Cast? 🤔
		if (typeof _value === 'boolean') {
			this.set('value', new ESBoolean(_value));
		} else {
			this.set('value', new ESArray(_value));
		}
	}
}

/**
 * @typedef {PMAttribute | PMComment | PMElement | PMFragment | PMInvalid | PMText} PMTemplateNode
 */

/** @extends {PMBaseNode<'Attribute'>} */
export class PMAttribute extends PMBaseNode {
	/**
	 * @param {Object} options
	 * @param {string} options.name
	 * @param {number} options.start
	 * @param {number} [options.end]
	 */
	constructor({ name, start, end }) {
		super([
			['start', new ESNumber(start)],
			['end', new ESNumber(end)],
			['type', new ESString('Attribute')],
			['name', new ESString(name)],
			['value', new ESArray()],
		]);
	}

	/**
	 * @param {PMTemplateNode} node
	 */
	append(node) {
		switch (String(node.get('type'))) {
			case 'Text':
				if (this.get('value') instanceof ESArray) {
					this.get('value').push(node);
				} else {
					this.set('value', new ESArray([node]));
				}
				break;
			default:
				super.append(node);
		}
	}
}

/** @extends {PMBaseNode<'Element'>} */
export class PMElement extends PMBaseNode {
	/**
	 * @param {Object} options
	 * @param {string} options.name
	 * @param {number} options.start
	 * @param {number} [options.end]
	 */
	constructor({ name, start, end }) {
		super([
			['start', new ESNumber(start)],
			['end', new ESNumber(end)],
			['type', new ESString('Element')],
			['name', new ESString(name)],
			['attributes', new ESArray()],
			['children', new ESArray()],
		]);
	}

	/**
	 * @param {PMTemplateNode} node
	 */
	append(node) {
		switch (String(node.get('type'))) {
			case 'Attribute':
				this.get('attributes').push(node);
				break;
			case 'Comment':
			case 'Element':
			case 'Invalid':
				this.get('children').push(node);
				break;
			case 'Text':
				const lastChild = this.get('children').at(-1);
				if (String(lastChild?.get('type')) === 'Text') {
					lastChild.end = node.end;
					lastChild.raw += node.raw;
					lastChild.data = lastChild.raw;
				} else {
					this.get('children').push(node);
				}
				break;
			default:
				super.append(node);
		}
	}
}

/** @extends {PMBaseNode<'Comment'>} */
export class PMComment extends PMBaseNode {
	/**
	 * @param {Object} options
	 * @param {string} options.data
	 * @param {number} options.start
	 * @param {number} [options.end]
	 */
	constructor({ data, start, end }) {
		super([
			['start', new ESNumber(start)],
			['end', new ESNumber(end)],
			['type', new ESString('Comment')],
			['data', new ESString(data)],
			['ignores', new ESArray()],
		]);
	}
}

/** @extends {PMBaseNode<'Fragment'>} */
export class PMFragment extends PMBaseNode {
	/**
	 * @param {Object} options
	 * @param {number} options.start
	 * @param {number} [options.end]
	 */
	constructor({ start, end }) {
		super([
			['start', new ESNumber(start)],
			['end', new ESNumber(end)],
			['type', new ESString('Fragment')],
			['children', new ESArray()],
		]);
	}

	/**
	 * @param {PMTemplateNode} node
	 */
	append(node) {
		switch (String(node.get('type'))) {
			case 'Comment':
			case 'Element':
				this.get('children').push(node);
				break;
			case 'Text':
				const lastChild = this.get('children').at(-1);
				if (String(lastChild?.get('type')) === 'Text') {
					lastChild.end = node.end;
					lastChild.raw += node.raw;
					lastChild.data = lastChild.raw;
				} else {
					this.get('children').push(node);
				}
				break;
			default:
				super.append(node);
		}
	}
}

/** @extends {PMBaseNode<'Invalid'>} */
export class PMInvalid extends PMBaseNode {
	/**
	 * @param {Object} options
	 * @param {string} options.code
	 * @param {string} options.message
	 * @param {number} options.start
	 * @param {number} [options.end]
	 */
	constructor({ code, message, start, end }) {
		super([
			['code', new ESString(code)],
			['message', new ESString(message)],
			['start', new ESNumber(start)],
			['end', new ESNumber(end)],
			['type', new ESString('Invalid')],
		]);
	}

	/**
	 * @param {any} node
	 */
	append(node) {
		throw Error(`Invalid nodes do not take '${node.get('type')}' as child.`);
	}
}

/** @extends {PMBaseNode<'Script'>} */
export class PMScript extends PMBaseNode {
	/**
	 * @param {Object} options
	 * @param {import("estree").Program} options.content
	 * @param {string} options.context
	 * @param {number} options.start
	 * @param {number} [options.end]
	 */
	constructor({ content, context, start, end }) {
		super([
			['type', new ESString('Script')],
			['start', new ESNumber(start)],
			['end', new ESNumber(end)],
			['context', new ESString(context)],
			['content', new ESString(content)],
		]);
	}
}

/** @extends {PMBaseNode<'Text'>} */
export class PMText extends PMBaseNode {
	/**
	 * @param {Object} options
	 * @param {string} options.data
	 * @param {string} options.raw
	 * @param {number} options.start
	 * @param {number} [options.end]
	 */
	constructor({ data, raw, start, end }) {
		super([
			['start', new ESNumber(start)],
			['end', new ESNumber(end)],
			['type', new ESString('Text')],
			['raw', new ESString(raw)],
			['data', new ESString(data)]
		]);
	}
}
