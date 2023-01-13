import { attribute, comment, element, fragment, invalid, text } from './nodes/nodes';
import { Machine } from '$lib/machine/create';
import { isVoidElement } from './utlils';

/**
 * @param {string} char
 */
function quoteChar(char) {
	return char === '\'' ? `"${char}"` : `'${char}'`;
}

/**
 * @typedef {import('./nodes/types').Attribute} Attribute
 * @typedef {import('./nodes/types').Comment} Comment
 * @typedef {import('./nodes/types').Element} Element
 * @typedef {import('./nodes/types').Fragment} Fragment
 * @typedef {import('./nodes/types').Invalid} Invalid
 * @typedef {import('./nodes/types').TemplateNode} TemplateNode
 * @typedef {import('./nodes/types').Text} Text
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
			maybeStack: /** @type {TemplateNode[]} */([]),
			openQuote: /** @type {'"' | '\''} */'\'',
			error: /** @type {{ code: string; message: string } | null} */(null),
		},
		ops: {
			error: {
				incompleteComment(value) {
					return {
						code: 'incomplete_comment',
						message: `Expected a valid comment character but instead found ${quoteChar(value)}`,
					};
				},
				invalidTagName(value) {
					return {
						code: 'invalid_tag_name',
						message: `Expected a valid tag character but instead found ${quoteChar(value)}`,
					};
				},
				invalidVoidContent() {
					const current = /** @type {Element} */(this.data.stack.at(-1));

					return {
						code: 'invalid-void-content',
						message: `<${current.name}> is a void element and cannot have children, or a closing tag`
					};
				},
				invalidAttributeName(value) {
					return {
						code: 'invalid_attribute_name',
						message: `Expected a valid attribute character but instead found ${quoteChar(value)}`,
					};
				},
				invalidUnquotedValue(value) {
					return {
						code: 'invalid_unquoted_value',
						message: `${quoteChar(value)} is not permitted in unquoted attribute values`
					}
				},
				unclosedBlock() {
					const current = /** @type {Attribute|Comment|Element} */(
						this.data.stack.at(-1)
					);
					const types = {
						Attribute: 'tag',
						Comment: 'comment',
						Element: `tag`,
					};
					const type = types[current.type] || 'block';
					return {
						code: `unclosed-${type}`,
						message: `${type[0].toUpperCase() + type.substring(1)} was left open`,
					};
				},
			},
			index: {
				increment() {
					return this.data.index + 1;
				},
			},
			html: {},
			maybeStack: {
				addRaw(value) {
					const current = this.data.maybeStack.at(-1);
					if (!current) {
						console.error('There\'s no item on the maybeStack.');
					} else if (!Object.hasOwn(current, 'raw')) {
						console.error('Invalid tag name. Adding ', value, 'to', current);
					} else {
						current.raw += value;
					}
					return this.data.maybeStack;
				},
				pop() {
					const current = this.data.maybeStack.pop();
					if (!current) {
						console.error('Popped from an empty maybeStack.');
					}
					return this.data.maybeStack;
				},
				popText() {
					const current = this.data.maybeStack.pop();
					if (!current) {
						console.error('Popped from an empty maybeStack.');
					} else if (current.type !== 'Text') {
						console.error('Popped element is not an text node');
					} else {
						const last = this.data.maybeStack.at(-1);
						current.end = this.data.index;
						// TODO: decode html character entities
						// https://github.com/sveltejs/svelte/blob/dd11917fe523a66d8f5d66aab8cbcf965f30f25f/src/compiler/parse/state/tag.ts#L521
						current.data = current.raw;
						if (!last) {
							console.error('The last element should not be popped');
						} else {
							if (last.type === 'Attribute') {
								// Because TypeScript
								if (Array.isArray(last.value)) last.value.push(current);
							} else if (last.type === 'Element' || last.type === 'Fragment') {
								last.children.push(current);
							} else {
								console.error('Parent does not take text nodes', structuredClone(last))
							}
						}
					}
					return this.data.maybeStack;
				},
				pushText() {
					const child = /** @type {Text} */(text({
						start: this.data.index,
						data: '',
						raw: '',
					}));
					this.data.maybeStack.push(child);
					return this.data.maybeStack;
				},
			},
			openQuote: {
				set(value) {
					return value;
				},
			},
			source: {},
			stack: {
				addData(value) {
					const current = this.data.stack.at(-1);
					if (!current) {
						console.error('There\'s no item on the stack.');
					} else if (!Object.hasOwn(current, 'data')) {
						console.error('Invalid tag name. Adding ', value, 'to', current);
					} else {
						current.data += value;
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
				addRaw(value) {
					const current = this.data.stack.at(-1);
					if (!current) {
						console.error('There\'s no item on the stack.');
					} else if (!Object.hasOwn(current, 'raw')) {
						console.error('Invalid tag name. Adding ', value, 'to', current);
					} else {
						current.raw += value;
					}
					return this.data.stack;
				},
				fromMaybeStack() {
					const current = this.data.maybeStack.at(-1);
					if (!current) {
						console.error('There\'s no item on the stack.');
					} else {
						this.data.stack.push(current);
					}
					return this.data.stack;
				},
				pop() {
					const current = this.data.stack.pop();
					if (!current) {
						console.error('Popped from an empty stack.');
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
							current.end = current.start + current.name.length;
							current.value = true;
						} else {
							current.end = this.data.index;
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
				popComment() {
					const current = (this.data.stack.pop());
					if (!current) {
						console.error('Popped from an empty stack.');
					} else if (current.type !== 'Comment') {
						console.error('Attempted pop non-comment');
					} else {
						current.data = current.data.slice(0, -2)
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
				popElement() {
					const current = this.data.stack.pop();
					if (!current) {
						console.error('Popped from an empty stack.');
					} else if (current.type !== 'Element') {
						console.error('Attempted pop non-element');
					} else {
						if (
							this.transition.from === 'endTagName'
							|| this.transition.from === 'beforeEndTagClose'
						) {
							let parentTag = this.data.stack.pop();
							if (!parentTag) {
								console.error('popped from an empty stack');
							} else {
								// close any elements that don't have their own closing tags, e.g. <div><p></div>
								while (parentTag.name !== current.name) {
									// TODO: handle autoclosed tags
									if (parentTag.type !== 'Element') {
										console.error('Autoclose tags not implemented');
									// 	const error = parser.last_auto_closed_tag && parser.last_auto_closed_tag.tag === name
									// 		? parser_errors.invalid_closing_tag_autoclosed(name, parser.last_auto_closed_tag.reason)
									// 		: parser_errors.invalid_closing_tag_unopened(name);
									// 	parser.error(error, start);
									}

									parentTag.end = current.start;
									const nextParent = this.data.stack.pop();
									if (!nextParent) {
										console.error('popped from an empty stack');
										break;
									} else if (!nextParent.children) {
										console.error("Autoclose element without valid parent");
										break;
									} else {
										nextParent.children.push(parentTag);
										parentTag = nextParent;
									}
								}
								parentTag.end = this.data.index;
								const last = this.data.stack.at(-1);
								if (!last) {
									console.error('The last element should not be popped');
								} else {
									if (!last.children) console.warn('Last has no children');
									last.children?.push(parentTag);
								}
							}
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
							switch (nodeWithError.type) {
								case 'Text':
									// Attribute
									parent.value.push(nodeWithError);
									break;
								case 'Attribute':
									// Element
									parent.attributes.push(nodeWithError);
									break;
								case 'Comment':
								case 'Element':
									// Fragment | Element
									parent.children?.push(nodeWithError);
									break;
								default:
									console.error('Unable to add invalid node to parent. Not implemented?', {
										nodeWithError,
										parent,
									});
									break;
							}
						}
					}
					return this.data.stack;
				},
				popText() {
					const current = this.data.stack.pop();
					if (!current) {
						console.error('Popped from an empty stack.');
					} else if (current.type !== 'Text') {
						console.error('Popped element is not an text node');
					} else {
						const last = this.data.stack.at(-1);
						current.end = this.data.index;
						// TODO: decode html character entities
						// https://github.com/sveltejs/svelte/blob/dd11917fe523a66d8f5d66aab8cbcf965f30f25f/src/compiler/parse/state/tag.ts#L521
						current.data = current.raw;
						if (!last) {
							console.error('The last element should not be popped');
						} else {
							let addTo = null;
							if (last.type === 'Attribute') {
								// Because TypeScript
								if (Array.isArray(last.value)) addTo = last.value;
							} else if (last.type === 'Element' || last.type === 'Fragment') {
								addTo = last.children;
							}

							if (addTo) {
								const lastChild = addTo.at(-1);
								if (lastChild?.type === 'Text') {
									lastChild.end = current.end;
									lastChild.raw += current.raw;
									lastChild.data = lastChild.raw;
								} else {
									addTo.push(current);
								}
							} else {
								console.error('Parent does not take text nodes', structuredClone(last))
							}
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
				pushComment() {
					const tag = this.data.stack.pop();
					if (!tag) {
						console.error('No tag found');
					} else if (tag.type !== 'Element') {
						console.error('Attempted to turn non-element to comment');
					} else {
						const child = /** @type {Comment} */(comment({
							start: tag.start,
							data: '',
						}));
						this.data.stack.push(child);
					}
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
				pushText() {
					const child = /** @type {Text} */(text({
						start: this.data.index,
						data: '',
						raw: '',
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
									'$maybeStack.pushText',
									'$maybeStack.addRaw',
									'$stack.pushTag',
									'$index.increment',
								],
							},
							{
								transitionTo: 'text',
								actions: [
									'$stack.pushText',
									'$stack.addRaw',
									'$index.increment',
								],
							}
						],
					},
				},
				afterAttributeName: {
					always: [{ transitionTo: 'done', condition: 'isDone' }],
					on: {
						CHARACTER: [
							{
								transitionTo: 'afterAttributeName',
								condition: 'isWhitespace',
								actions: [
									'$index.increment',
								],
							},
							{
								transitionTo: 'selfClosingTag',
								condition: 'isForwardSlash',
								actions: [
									'$stack.popAttribute',
									'$index.increment',
								],
							},
							{
								transitionTo: 'beforeAttributeValue',
								condition: 'isEquals',
								actions: [
									'$index.increment',
								],
							},
							{
								transitionTo: 'fragment',
								condition: 'isTagClose',
								actions: [
									'$stack.popAttribute',
									'$index.increment',
								],
							},
							{
								transitionTo: 'attributeName',
								condition: 'isAlphaCharacter',
								actions: [
									'$stack.popAttribute',
									'$stack.pushAttribute',
									'$stack.addName',
									'$index.increment',
								],
							},
							{
								transitionTo: 'invalid',
								actions: [
									'$error.invalidAttributeName',
									'$stack.pushInvalid',
									'$index.increment',
								],
							},
						],
					},
				},
				afterAttributeValueQuoted: {
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
								transitionTo: 'selfClosingTag',
								condition: 'isForwardSlash',
								actions: [
									'$index.increment',
								],
							},
							{
								transitionTo: 'fragment',
								condition: 'isTagClose',
								actions: [
									'$index.increment',
								],
							},
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
								transitionTo: 'invalid',
								actions: [
									'$error.invalidAttributeName',
									'$stack.pushInvalid',
									'$index.increment',
								],
							},
						],
					},
				},
				afterCommentBang: {
					always: [{ transitionTo: 'done', condition: 'isDone' }],
					on: {
						CHARACTER: [
							{
								transitionTo: 'beforeCommentStart',
								condition: 'isMinus',
								actions: [
									'$index.increment',
								],
							},
							{
								transitionTo: 'invalid',
								actions: [
									'$error.incompleteComment',
									'$stack.pushInvalid',
									'$index.increment',
								],
							},
						],
					},
				},
				afterCommentContent: {
					always: [{ transitionTo: 'done', condition: 'isDone' }],
					on: {
						CHARACTER: [
							{
								transitionTo: 'beforeCommentEnd',
								condition: 'isMinus',
								actions: [
									'$stack.addData',
									'$index.increment',
								],
							},
							{
								transitionTo: 'commentContent',
								actions: [
									'$stack.addData',
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
									'$index.increment',
								],
							},
							{
								transitionTo: 'selfClosingTag',
								condition: 'isForwardSlash',
								actions: [
									'$stack.popAttribute',
									'$index.increment',
								],
							},
							{
								transitionTo: 'fragment',
								condition: 'isTagClose',
								actions: [
									'$stack.popAttribute',
									'$index.increment',
								],
							},
							{
								transitionTo: 'beforeAttributeValue',
								condition: 'isEquals',
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
				attributeValueQuoted: {
					always: [{ transitionTo: 'done', condition: 'isDone' }],
					on: {
						CHARACTER: [
							{
								transitionTo: 'afterAttributeValueQuoted',
								condition: 'isQuoteClosed',
								actions: [
									'$stack.popText',
									'$index.increment',
									'$stack.popAttribute',
								],
							},
							{
								actions: [
									'$stack.addRaw',
									'$index.increment',
								],
							},
						],
					},
				},
				attributeValueUnquoted: {
					always: [{ transitionTo: 'done', condition: 'isDone' }],
					on: {
						CHARACTER: [
							{
								transitionTo: 'beforeAttributeName',
								condition: 'isWhitespace',
								actions: [
									'$stack.popText',
									'$stack.popAttribute',
									'$index.increment',
								],
							},
							{
								transitionTo: 'fragment',
								condition: 'isTagClose',
								actions: [
									'$stack.popText',
									'$stack.popAttribute',
									'$index.increment',
								],
							},
							{
								transitionTo: 'selfClosingTag',
								condition: 'isForwardSlash',
								actions: [
									'$stack.popText',
									'$stack.popAttribute',
									'$index.increment',
								],
							},
							{
								transitionTo: 'invalid',
								condition: 'isInvalidUnquotedValue',
								actions: [
									'$error.invalidUnquotedValue',
									'$stack.pushInvalid',
									'$index.increment',
								],
							},
							{
								actions: [
									'$stack.addRaw',
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
								transitionTo: 'beforeAttributeName',
								condition: 'isWhitespace',
								actions: [
									'$index.increment',
								],
							},
							{
								transitionTo: 'selfClosingTag',
								condition: 'isForwardSlash',
								actions: [
									'$index.increment',
								],
							},
							{
								transitionTo: 'fragment',
								condition: 'isTagClose',
								actions: [
									'$index.increment',
								],
							},
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
								transitionTo: 'invalid',
								actions: [
									'$error.invalidAttributeName',
									'$stack.pushInvalid',
									'$index.increment',
								],
							},
						],
					},
				},
				beforeAttributeValue: {
					always: [{ transitionTo: 'done', condition: 'isDone' }],
					on: {
						CHARACTER: [
							{
								transitionTo: 'beforeAttributeValue',
								condition: 'isWhitespace',
								actions: [
									'$index.increment',
								],
							},
							{
								transitionTo: 'attributeValueQuoted',
								condition: 'isQuote',
								actions: [
									'$openQuote.set',
									'$index.increment',
									'$stack.pushText',
								],
							},
							{
								transitionTo: 'fragment',
								condition: 'isTagClose',
								actions: [
									'$stack.popAttribute',
									'$index.increment',
								],
							},
							{
								transitionTo: 'attributeValueUnquoted',
								actions: [
									'$stack.pushText',
									'$stack.addRaw',
									'$index.increment',
								],
							},
						],
					},
				},
				beforeCommentEnd: {
					always: [{ transitionTo: 'done', condition: 'isDone' }],
					on: {
						CHARACTER: [
							{
								transitionTo: 'fragment',
								condition: 'isTagClose',
								actions: [
									'$index.increment',
									'$stack.popComment',
								],
							},
							{
								transitionTo: 'beforeCommentEnd',
								condition: 'isMinus',
								actions: [
									'$stack.addData',
									'$index.increment',
								],
							},
							{
								transitionTo: 'commentContent',
								actions: [
									'$stack.addData',
									'$index.increment',
								],
							},
						],
					},
				},
				beforeCommentStart: {
					always: [{ transitionTo: 'done', condition: 'isDone' }],
					on: {
						CHARACTER: [
							{
								transitionTo: 'commentContent',
								condition: 'isMinus',
								actions: [
									'$index.increment',
								],
							},
							{
								transitionTo: 'invalid',
								actions: [
									'$error.incompleteComment',
									'$stack.pushInvalid',
									'$index.increment',
								],
							},
						],
					},
				},
				beforeEndTagClose: {
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
								transitionTo: 'beforeEndTagClose',
								condition: 'isWhitespace',
								actions: [
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
				commentContent: {
					always: [{ transitionTo: 'done', condition: 'isDone' }],
					on: {
						CHARACTER: [
							{
								transitionTo: 'afterCommentContent',
								condition: 'isMinus',
								actions: [
									'$stack.addData',
									'$index.increment',
								],
							},
							{
								actions: [
									'$stack.addData',
									'$index.increment',
								],
							},
						],
					},
				},
				done: {
					always: [
						{
							transitionTo: 'invalid',
							actions: [
								'$error.unclosedBlock',
								'$stack.pushInvalid',
							],
							condition: 'stackNotEmpty',
						},
					],
				},
				endTagName: {
					on: {
						CHARACTER: [
							{
								transitionTo: 'beforeEndTagClose',
								condition: 'isWhitespace',
								actions: [
									'$index.increment',
								],
							},
							{
								transitionTo: 'endTagVoid',
								condition: 'isVoidTag',
								actions: [
									'$stack.addName',
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
				endTagOpen: {
					on: {
						CHARACTER: [
							{
								transitionTo: 'endTagName',
								condition: 'isAlphaCharacter',
								actions: [
									'$maybeStack.pop',
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
				endTagVoid: {
					on: {
						CHARACTER: [
							{
								transitionTo: 'endTagName',
								condition: 'isAlphaCharacter',
								actions: [
									'$stack.addName',
									'$index.increment',
								],
							},
							{
								transitionTo: 'invalid',
								condition: 'isTagClose',
								actions: [
									'$error.invalidVoidContent',
									'$stack.pushInvalid',
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
				notImplemented: {},
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
								],
							},
							{
								transitionTo: 'selfClosingTag',
								condition: 'isForwardSlash',
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
								// TODO: Parse doctype
								transitionTo: 'afterCommentBang',
								condition: 'isExclamation',
								actions: [
									'$stack.pushComment',
									'$index.increment',
								],
							},
							{
								transitionTo: 'endTagOpen',
								condition: 'isForwardSlash',
								actions: [
									'$index.increment',
								],
							},
							{
								transitionTo: 'tagName',
								condition: 'isAlphaCharacter',
								actions: [
									'$maybeStack.pop',
									'$stack.addName',
									'$index.increment',
								],
							},
							{
								transitionTo: 'text',
								actions: [
									'$stack.pop',
									'$stack.fromMaybeStack',
									'$maybeStack.pop',
									'$stack.addRaw',
									'$index.increment',
								],
							},
						],
					},
				},
				text: {
					always: [{
						transitionTo: 'done',
						condition: 'isDone',
						actions: [
							'$stack.popText',
						],
					}],
					on: {
						CHARACTER: [
							{
								transitionTo: 'tagOpen',
								condition: 'isTagOpen',
								actions: [
									'$maybeStack.pushText',
									'$maybeStack.addRaw',
									'$stack.popText',
									'$stack.pushTag',
									'$index.increment',
								],
							},
							// TODO: Mustache here
							{
								actions: [
									'$stack.addRaw',
									'$index.increment',
								]
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
			isEquals(value) {
				return value === '=';
			},
			isExclamation(value) {
				return value === '!';
			},
			isForwardSlash(value) {
				return value === '/';
			},
			isDone() {
				// TODO: Listen for a EOF char so that we never need the original source
				return this.data.index === this.data.source.length;
			},
			isInvalidUnquotedValue(value) {
				return /[\s"'=<>`]/.test(value);
			},
			isMinus(value) {
				return value === '-';
			},
			isNonAlphaCharacter(value) {
				return !/[A-z]/.test(value);
			},
			isQuote(value) {
				return value === '"' || value === '\'';
			},
			isQuoteClosed(value) {
				return value === this.data.openQuote;
			},
			isTagOpen(value) {
				return value === '<';
			},
			isTagClose(value) {
				return value === '>';
			},
			isVoidTag(value) {
				const current = /** @type {Element} */(this.data.stack.at(-1));
				return isVoidElement(current.name + value);
			},
			isWhitespace(value) {
				return /\s/.test(value);
			},
			stackNotEmpty() {
				return this.data.stack.length > 1;
			},
		},
		actions: {
			log(value) {
				console.log(structuredClone({
					value,
					state: this.state,
					transition: this.transition,
				}));
			},
		}
	});
	return parser;
}