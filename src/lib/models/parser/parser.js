import * as acorn from './acorn.js';
import { PMAttribute, PMComment, PMElement, PMFragment, PMInvalid, PMScript, PMText } from './nodes/nodes';
import { Machine } from '$lib/machine/create';
import { isVoidElement } from './utlils';
import { PMStack } from './data';

/**
 * @param {string} char
 */
function quoteChar(char) {
	return char === '\'' ? `"${char}"` : `'${char}'`;
}

/**
 * @typedef {import('./nodes/nodes').PMTemplateNode} PMTemplateNode
 */
/**
 * @param {string} source
 */
export function parser(source) {
	const index = 0;
	const html = new PMFragment({
		start: index,
		end: source.length,
	});
	const stack = /** @type {PMStack} */(new PMStack(html));
	const parser = new Machine({
		data: {
			index,
			html,
			source,
			stack,
			maybeStack: /** @type {PMStack} */(new PMStack()),
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
					const current = /** @type {PMElement} */(this.data.stack.peek());

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
					const current = /** @type {PMAttribute | PMComment | PMElement} */(
						this.data.stack.peek()
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
					const current = this.data.maybeStack.peek();
					current.raw += value;
					return this.data.maybeStack;
				},
				pop() {
					this.data.maybeStack.pop();
					return this.data.maybeStack;
				},
				popText() {
					const current = this.data.maybeStack.pop({ expect: 'Text' });
					const parent = this.data.maybeStack.peek();
					current.end = this.data.index;
					// TODO: decode html character entities
					// https://github.com/sveltejs/svelte/blob/dd11917fe523a66d8f5d66aab8cbcf965f30f25f/src/compiler/parse/state/tag.ts#L521
					current.data = current.raw;
					parent.append(current);

					return this.data.maybeStack;
				},
				pushText() {
					const child = new PMText({
						start: this.data.index,
						data: '',
						raw: '',
					});
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
					const current = this.data.stack.peek();
					current.data += value;
					return this.data.stack;
				},
				addEnd() {
					const current = this.data.stack.peek();
					current.end = this.data.index;
					return this.data.stack;
				},
				addName(value) {
					const current = this.data.stack.peek();
					current.name += value;
					return this.data.stack;
				},
				addRaw(value) {
					const current = this.data.stack.peek();
					current.raw += value;
					return this.data.stack;
				},
				fromMaybeStack() {
					const current = this.data.maybeStack.peek();
					this.data.stack.push(current);
					return this.data.stack;
				},
				pop() {
					this.data.stack.pop();
					return this.data.stack;
				},
				popAttribute() {
					const current = this.data.stack.pop({ expect: 'Attribute' });
					if (Array.isArray(current.value) && !current.value.length) {
						current.end = current.start + current.name.length;
						current.value = true;
					} else {
						current.end = this.data.index;
					}
					const parent = this.data.stack.peek();
					parent.append(current);

					return this.data.stack;
				},
				popComment() {
					const current = this.data.stack.pop({ expect: 'Comment' });

					current.data = current.data.slice(0, -2)
					current.end = this.data.index;
					const last = this.data.stack.peek();

					last.append(current);

					return this.data.stack;
				},
				popElement() {
					const current = this.data.stack.pop({ expect: 'Element' });

					if (
						this.transition.from === 'endTagName'
						|| this.transition.from === 'beforeEndTagClose'
					) {
						let parentTag = this.data.stack.pop();

						// close any elements that don't have their own closing tags, e.g. <div><p></div>
						while (parentTag.type === 'Element' && parentTag.name !== current.name) {
							// TODO: handle autoclosed tags
							// if (parentTag.type !== 'Element') {
							console.error('Autoclose tags not implemented');
							// 	const error = parser.last_auto_closed_tag && parser.last_auto_closed_tag.tag === name
							// 		? parser_errors.invalid_closing_tag_autoclosed(name, parser.last_auto_closed_tag.reason)
							// 		: parser_errors.invalid_closing_tag_unopened(name);
							// 	parser.error(error, start);
							// }

							parentTag.end = current.start;
							const nextParent = this.data.stack.pop();
							nextParent.append(parentTag)
							parentTag = nextParent;
						}
						parentTag.end = this.data.index;
						const last = this.data.stack.peek();
						last.append(parentTag);
					} else {
						current.end = this.data.index;
						const last = this.data.stack.peek();
						last.append(current)
					}

					return this.data.stack;
				},
				popInvalid() {
					const invalid = this.data.stack.pop({ expect: 'Invalid' });
					invalid.end = this.data.index;

					const nodeWithError = this.data.stack.pop();
					nodeWithError.end = this.data.index;
					nodeWithError.error = invalid;

					const parent = this.data.stack.peek();
					parent.append(nodeWithError);

					return this.data.stack;
				},
				popText() {
					const current = this.data.stack.pop({ expect: 'Text' });
					const parent = this.data.stack.peek();
					current.end = this.data.index;
					// TODO: decode html character entities
					// https://github.com/sveltejs/svelte/blob/dd11917fe523a66d8f5d66aab8cbcf965f30f25f/src/compiler/parse/state/tag.ts#L521
					current.data = current.raw;
					parent.append(current)

					return this.data.stack;
				},
				pushAttribute() {
					const child = new PMAttribute({
						start: this.data.index,
						name: '',
					});
					this.data.stack.push(child);
					return this.data.stack;
				},
				pushComment() {
					const tag = this.data.stack.pop({ expect: 'Element' });
					const child = new PMComment({
						start: tag.start,
						data: '',
					});
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
					const child = new PMInvalid({
						start: this.data.index,
						...error,
					});
					this.data.stack.push(child);
					return this.data.stack;
				},
				pushTag() {
					const child = (new PMElement({
						start: this.data.index,
						name: '',
					}));
					this.data.stack.push(child);
					return this.data.stack;
				},
				pushText() {
					const child = new PMText({
						start: this.data.index,
						data: '',
						raw: '',
					});
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
				const current = this.data.stack.peek({ expect: 'Element' });
				return isVoidElement(current.name + value);
			},
			isWhitespace(value) {
				return /\s/.test(value);
			},
			stackNotEmpty() {
				return this.data.stack.size > 1;
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

const nonNewLineRE = /[^\n]/g;
const positionIndicatorRE = / \(\d+:\d+\)$/

/**
 * @param {ReturnType<parser>} parser
 */
export function transformToSvelte(parser) {
	const fragment = parser.data.stack.peek({ expect: 'Fragment' });

	// Convert to PMNodes to POJO
	const children = /** @type {PMTemplateNode[]} */(JSON.parse(JSON.stringify(fragment.children)));

	// Remove trailing whitespace text nodes
	let i = children.length - 1;
	let current;
	while ((current = children[i]) && current.type === 'Text' && !current.raw.trim()) {
		children.pop();
		i--;
	}

	if (current?.type === 'Text') {
		current.raw = current.raw.trim();
		current.data = current.raw;
		current.end = current.start + current.raw.length;
	}

	let instance;
	let module;
	const nonscripts = [];
	for (let i = 0; i < children.length; i++) {
		const node = children[i];
		if (node.type === 'Element' && node.name === 'script') {
			const contextIndex = node.attributes
				.findIndex(attribute => attribute.name === 'context');
			/** @type {'default' | 'module'} */
			let context = 'default';
			if (contextIndex > -1) {
				const contextAttribute = node.attributes[contextIndex];
				let error;
				if (typeof contextAttribute.value === 'boolean') {
					error = {
						code: 'invalid-script-context-boolean',
						message: 'If the context attribute is supplied, its value must be "module"'
					};
				} else if (contextAttribute.value.length !== 1 || contextAttribute.value[0].type !== 'Text') {
					error = {
						code: 'invalid-script-context-static',
						message: 'Context attribute must be static',
					}
				} else if (contextAttribute.value[0].data !== 'default' && contextAttribute.value[0].data !== 'module') {
					error = {
						code: 'invalid-script-context-value',
						message: 'If the context attribute is supplied, its value must be "module"',
					}
				} else {
					context = contextAttribute.value[0].data;
				}
				if (error) {
					contextAttribute.error = new PMInvalid({
						start: contextAttribute.start,
						end: contextAttribute.end,
						...error,
					});
					nonscripts.push(node)
					continue;
				}
			}

			let error;
			if (context === 'default' && instance) {
				error = {
					code: 'invalid-script-instance',
					message: 'A component can only have one instance-level <script> element',
				}
			} else if (context === 'module' && module) {
				error = {
					code: 'invalid-script-module',
					message: 'A component can only have one <script context="module"> element',
				}
			}

			if (error) {
				node.error = new PMInvalid({
					start: node.start,
					end: node.end,
					...error,
				});
				nonscripts.push(node);
				continue;
			}

			const scriptChild = node.children[0];
			if (node.children.length > 1 || (node.children.length === 1 && scriptChild.type !== 'Text')) {
				scriptChild.error = new PMInvalid({
					start: scriptChild.start,
					end: scriptChild.end,
					code: 'invalid-script-nested-elements',
					message: 'Script elements cannot have nested children',
				});
				nonscripts.push(node);
			} else {
				const start  = scriptChild
					? scriptChild.start
					: parser.data.source.indexOf('</', node.start);
				const end  = scriptChild
					? scriptChild.end
					: start;
				let ast;
				try {
					const code = parser.data.source
						.slice(0, start)
						.replace(nonNewLineRE, ' ')
						+ (scriptChild ? scriptChild.raw : '');
					ast = /** @type {import('estree').Program} */(acorn.parse(code));
					/** @type {any} */(ast).start = start;
					const script = new PMScript({
						start: node.start,
						end: node.end,
						context,
						content: ast,
					});
					if (context === 'default') {
						instance = script;
					} else if (context === 'module') {
						module = script;
					}
				} catch (error) {
					node.error = new PMInvalid({
						// @ts-ignore
						start: error.pos,
						end,
						code: 'parse-error',
						message: /** @type {Error} */(error).message.replace(positionIndicatorRE, '')
					});
					nonscripts.push(node);
				}
			}
		} else {
			nonscripts.push(node);
		}
	}

	/** @type {number | null} */
	let start;
	/** @type {number | null} */
	let end;

	if (nonscripts.length) {
		start = nonscripts[0].start;
		while (/\s/.test(parser.data.source[start])) start += 1;

		// TODO: is optional end on template nodes still necessary?
		end = /** @type {number} */(/** @type {PMTemplateNode} */(nonscripts.at(-1)).end);
		while (/\s/.test(parser.data.source[end - 1])) end -= 1;
	} else {
		start = end = null;
	}

	const result = {
		html: {
			start,
			end,
			type: 'Fragment',
			children: nonscripts,
		},
		instance,
		module,
	}


	return result;
}
