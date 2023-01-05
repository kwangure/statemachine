import { element, fragment, invalid } from "./nodes/nodes";
import { Machine } from "$lib/machine/create";

/**
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
				invalid_tag_name(value) {
					return {
						code: 'invalid_tag_name',
						message: `Expected an alphabet character but instead found '${value}'`,
					};
				},
				empty: () => null,
			},
			html: {},
			index: {
				increment() {
					return this.data.index + 1;
				}
			},
			source: {},
			stack: {
				addElement() {
					const child = /** @type {Element} */(element({
						start: this.data.index,
						name: '',
					}));
					this.data.stack.push(child);
					return this.data.stack;
				},
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
				addInvalid(value) {
					let error = {
						code: 'unknown-error',
						message: 'Unexpected character',
					}
					if (this.transition.from === 'tag') {
						error = {
							code: 'invalid_tag_name',
							message: `Expected an alphabet character but instead found '${value}'`,
						};
					} else {
						console.warn({ transition: this.transition });
					}
					const child = /** @type {Invalid} */(invalid({
						start: this.data.index,
						error,
					}));
					this.data.stack.push(child);
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
			},
		},
		config: {
			states: {
				fragment: {
					always: [{ transitionTo: "done", condition: "isDone" }],
					on: {
						CHARACTER: [{
							transitionTo: 'tag',
							condition: 'isTagStart',
							actions: [
								"$stack.addElement",
								"$index.increment"
							]
						}],
					}
				},
				tag: {
					always: [{ transitionTo: "done", condition: "isDone" }],
					on: {
						CHARACTER: [
							{
								transitionTo: 'tagname',
								condition: 'isAlphaCharacter',
								actions: [
									"$stack.addName",
									"$index.increment"
								],
							},
							{
								transitionTo: 'fragment',
								condition: 'isTagEnd',
								actions: [
									"$index.increment",
									"$stack.popElement",
								],
							},
							{
								transitionTo: 'invalid',
								actions: [
									"$stack.addInvalid",
									"$index.increment",
								],
							},
						],
					},
				},
				tagname: {
					always: [{ transitionTo: "done", condition: "isDone" }],
					on: {
						CHARACTER: [
							{
								transitionTo: 'tag',
								condition: 'isClosingTag',
								actions: [
									"$index.increment"
								],
							},
							{
								transitionTo: 'whitespace',
								condition: 'isWhitespace',
								actions: ["$index.increment"],
							},
							{
								transitionTo: 'invalid',
								condition: 'isNonAlphaCharacter',
								actions: ["$index.increment"],
							},
							{
								actions: ["$stack.addName", "$index.increment"],
							},
						],
					},
				},
				whitespace: {
					always: [{ transitionTo: "done", condition: "isDone" }],
					on: {
						CHARACTER: [
							{
								transitionTo: 'tag',
								condition: 'isClosingTag',
								actions: ["$index.increment"],
							},
							{
								transitionTo: 'invalid',
								condition: 'isInvalidWhitespace',
								actions: [
									"$stack.addInvalid",
									"$index.increment",
								],
							},
							{
								actions: ["$index.increment"],
							},
						],
					},
				},
				invalid: {
					always: [{ transitionTo: "done", condition: "isDone" }],
					on: {
						CHARACTER: [
							{
								transitionTo: 'tag',
								condition: 'isTagStart',
								actions: [
									"$stack.addElement",
									"$index.increment",
								],
							},
							{
								actions: [
									"$index.increment",
								],
							},
						],
					},
					exit: [{
						actions: [
							// Pop invalid element
							"$stack.popElement",
							// Pop the element it was parsing before it errored
							"$stack.popElement"
						],
					}]
				},
				done: {},
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
				return this.data.index === this.data.source.length;
			},
			isInvalidWhitespace(value) {
				return !/\s/.test(value);
			},
			isNonAlphaCharacter(value) {
				return !/[A-z]/.test(value);
			},
			isTagStart(value) {
				return value === '<';
			},
			isTagEnd(value) {
				return value === '>';
			},
			isFromTag() {
				return this.transition.from === 'tag';
			},
			isWhitespace(value) {
				return /\s/.test(value);
			},
		},
		actions: {
			log(value) {
				console.log({
					...structuredClone(this),
					value,
				});
			}
		}
	});
	return parser;
}