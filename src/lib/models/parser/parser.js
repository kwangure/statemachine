import { attribute, element, fragment, invalid } from './nodes/nodes';
import { Machine } from '$lib/machine/create';

/**
 * @typedef {import('./nodes/types').Attribute} Attribute
 * @typedef {import('./nodes/types').Element} Element
 * @typedef {import('./nodes/types').Fragment} Fragment
 * @typedef {import('./nodes/types').Invalid} Invalid
 * @typedef {import('./nodes/types').TemplateNode} TemplateNode
 */
/**
 * @param {string} source
 */
export function parser(source) {
	const index = 0;
	const html = fragment(index, source.length);
	const stack = /** @type {TemplateNode[]} */([html]);
	const parser = new Machine({
		data: {
			index,
			html,
			source,
			stack,
			error: /** @type {{ code: string; message: string } | null} */(null),
		},
		ops: {
			error: {
				invalidTagName(value) {
					return {
						code: 'invalid_tag_name',
						message: `Expected a valid tag character but instead found '${value}'`,
					};
				},
				invalidAttributeName(value) {
					return {
						code: 'invalid_attribute_name',
						message: `Expected a valid attribute character but instead found '${value}'`,
					};
				},
			},
			index: {
				increment() {
					return this.data.index + 1;
				},
			},
			html: {},
			source: {},
			stack: {
				addName(value) {
					const current = this.data.stack.at(-1);
					if (!current) {
						console.error('There\'s no item on the stack.');
					} else if (!Object.hasOwn(current, 'name')) {
						console.error('Invalid tag name. Adding ', value, 'to', current);
					} else {
						current.name += value;
					}
					return this.data.stack;
				},
				addEnd() {
					const current = this.data.stack.at(-1);
					if (!current) {
						console.error('There\'s no item on the stack.');
					} else {
						current.end = this.data.index;
					}
					return this.data.stack;
				},
				popAttribute() {
					const current = this.data.stack.pop();
					if (!current) {
						console.error('Popped from an empty stack.');
					} else if (current.type !== 'Attribute') {
						console.error('Popped element is not an attribute');
					} else {
						if (Array.isArray(current.value) && !current.value.length) {
							current.value = true;
						}
						const last = this.data.stack.at(-1);
						if (!last) {
							console.error('The last element should not be popped');
						} else {
							if (!last.attributes) {
								console.error('Last has no attributes')
							} else {
								last.attributes?.push(current);
							}
						}
					}
					return this.data.stack;
				},
				popElement() {
					const current = this.data.stack.pop();
					if (!current) {
						console.error('Popped from an empty stack.');
					} else {
						current.end = this.data.index;
						const last = this.data.stack.at(-1);
						if (!last) {
							console.error('The last element should not be popped');
						} else {
							if (!last.children) console.warn('Last has no children');
							last.children?.push(current);
						}
					}
					return this.data.stack;
				},
				popInvalid() {
					const invalid = /** @type {Invalid} */(this.data.stack.pop());
					const nodeWithError = this.data.stack.pop();
					if (!invalid || !nodeWithError) {
						console.error('Popped from an empty stack.');
					} else {
						invalid.end = this.data.index;
						nodeWithError.end = this.data.index;
						nodeWithError.error = invalid;
						const parent = this.data.stack.at(-1);
						if (!parent) {
							console.error('Errored element has no parent');
						} else {
							if (!parent.children) console.warn('Last has no children');
							parent.children?.push(nodeWithError);
						}
					}
					return this.data.stack;
				},
				pushAttribute() {
					const child = /** @type {Attribute} */(attribute({
						start: this.data.index,
						name: '',
					}));
					this.data.stack.push(child);
					return this.data.stack;
				},
				pushInvalid(value) {
					let error = this.data.error;
					if (!error) {
						console.error('Unknown error code', {
							transition: this.transition,
						});
						error = {
							code: 'unknown-error',
							message: `Unexpected character '${value}'`,
						};
					}
					const child = /** @type {Invalid} */(invalid({
						start: this.data.index,
						error,
					}));
					this.data.stack.push(child);
					return this.data.stack;
				},
				pushTag() {
					const child = /** @type {Element} */(element({
						start: this.data.index,
						name: '',
					}));
					this.data.stack.push(child);
					return this.data.stack;
				},
			},
		},
		config: {
			states: {
				fragment: {
					always: [{ transitionTo: 'done', condition: 'isDone' }],
					on: {
						CHARACTER: [
							{
								transitionTo: 'tagOpen',
								condition: 'isTagOpen',
								actions: [
									'$stack.pushTag',
									'$index.increment',
								],
							},
						],
					},
				},
				attributeName: {
					always: [{ transitionTo: 'done', condition: 'isDone' }],
					on: {
						CHARACTER: [
							{
								transitionTo: 'afterAttributeName',
								condition: 'isWhitespace',
								actions: [
									'$stack.addEnd',
									'$index.increment',
								],
							},
							{
								transitionTo: 'selfClosingTag',
								condition: 'isClosingTag',
								actions: [
									'$stack.popAttribute',
									'$index.increment',
								],
							},
							{
								actions: [
									'$stack.addName',
									'$index.increment',
								],
							},
						],
					},
				},
				afterAttributeName: {
					always: [{ transitionTo: 'done', condition: 'isDone' }],
					on: {
						CHARACTER: [
							{
								transitionTo: 'selfClosingTag',
								condition: 'isClosingTag',
								actions: [
									'$stack.popAttribute',
									'$index.increment',
								],
							},
							{
								actions: [
									'$index.increment',
								],
							},
						],
					},
				},
				beforeAttributeName: {
					always: [{ transitionTo: 'done', condition: 'isDone' }],
					on: {
						CHARACTER: [
							{
								transitionTo: 'attributeName',
								condition: 'isAlphaCharacter',
								actions: [
									'$stack.pushAttribute',
									'$stack.addName',
									'$index.increment',
								],
							},
							{
								transitionTo: 'selfClosingTag',
								condition: 'isClosingTag',
								actions: [
									'$index.increment',
								],
							},
							{
								transitionTo: 'invalid',
								condition: 'isNonWhitespace',
								actions: [
									'$error.invalidAttributeName',
									'$stack.pushInvalid',
									'$index.increment',
								],
							},
							{
								actions: [
									'$index.increment',
								],
							},
						],
					},
				},
				done: {},
				invalid: {
					always: [{ transitionTo: 'done', condition: 'isDone' }],
					on: {
						CHARACTER: [
							{
								transitionTo: 'tagOpen',
								condition: 'isTagOpen',
								actions: [
									'$stack.pushTag',
									'$index.increment',
								],
							},
							{
								actions: [
									'$index.increment',
								],
							},
						],
					},
					exit: [{
						actions: [
							'$stack.popInvalid',
						],
					}]
				},
				selfClosingTag: {
					always: [{ transitionTo: 'done', condition: 'isDone' }],
					on: {
						CHARACTER: [
							{
								transitionTo: 'fragment',
								condition: 'isTagClose',
								actions: [
									'$index.increment',
									'$stack.popElement',
								],
							},
							{
								actions: [
									'log',
								],
							},
						],
					},
				},
				tagName: {
					always: [{ transitionTo: 'done', condition: 'isDone' }],
					on: {
						CHARACTER: [
							{
								transitionTo: 'beforeAttributeName',
								condition: 'isWhitespace',
								actions: [
									'$index.increment',
								],
							},
							{
								transitionTo: 'fragment',
								condition: 'isTagClose',
								actions: [
									'$index.increment',
									'$stack.popElement',
								],
							},
							{
								transitionTo: 'selfClosingTag',
								condition: 'isClosingTag',
								actions: [
									'$index.increment',
								],
							},
							{
								transitionTo: 'invalid',
								condition: 'isNonAlphaCharacter',
								actions: [
									'$error.invalidTagName',
									'$stack.pushInvalid',
									'$index.increment',
								],
							},
							{
								actions: [
									'$stack.addName',
									'$index.increment',
								],
							},
						],
					},
				},
				tagOpen: {
					always: [{ transitionTo: 'done', condition: 'isDone' }],
					on: {
						CHARACTER: [
							{
								transitionTo: 'tagName',
								condition: 'isAlphaCharacter',
								actions: [
									'$stack.addName',
									'$index.increment',
								],
							},
							{
								transitionTo: 'invalid',
								actions: [
									'$error.invalidTagName',
									'$stack.pushInvalid',
									'$index.increment',
								],
							},
						],
					},
				},
			},
		},
		conditions: {
			isAlphaCharacter(value) {
				return /[A-z]/.test(value);
			},
			isClosingTag(value) {
				return value === '/';
			},
			isDone(value) {
				// TODO: Listen for a EOF char so that we never need the original source
				return this.data.index === this.data.source.length;
			},
			isNonAlphaCharacter(value) {
				return !/[A-z]/.test(value);
			},
			isNonWhitespace(value) {
				return !/\s/.test(value);
			},
			isTagOpen(value) {
				return value === '<';
			},
			isTagClose(value) {
				return value === '>';
			},
			isWhitespace(value) {
				return /\s/.test(value);
			},
		},
		actions: {
			log(value) {
				console.log(value, this.state);
			},
		}
	});
	return parser;
}