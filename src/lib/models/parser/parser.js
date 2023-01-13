import { PMAttribute, PMComment, PMElement, PMFragment, PMInvalid, PMText } from './nodes/nodes';
import { Machine } from '$lib/machine/create';
import { isVoidElement } from './utlils';
import { Stack } from './data';

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
	const stack = /** @type {Stack<PMTemplateNode>} */(new Stack(html));
	const parser = new Machine({
		data: {
			index,
			html,
			source,
			stack,
			maybeStack: /** @type {Stack<PMTemplateNode>} */(new Stack()),
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
					if ('raw' in current) {
						current.raw += value;
					} else {
						console.error('Invalid tag name. Adding ', value, 'to', current);
					}
					return this.data.maybeStack;
				},
				pop() {
					this.data.maybeStack.pop();
					return this.data.maybeStack;
				},
				popText() {
					const current = this.data.maybeStack.pop();
					if (current.type !== 'Text') {
						console.error('Popped element is not an text node');
					} else {
						const parent = this.data.maybeStack.peek();
						current.end = this.data.index;
						// TODO: decode html character entities
						// https://github.com/sveltejs/svelte/blob/dd11917fe523a66d8f5d66aab8cbcf965f30f25f/src/compiler/parse/state/tag.ts#L521
						current.data = current.raw;
						parent.append(current);
					}
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
					if ('data' in current) {
						current.data += value;
					} else {
						console.error('Invalid tag name. Adding ', value, 'to', current);
					}
					return this.data.stack;
				},
				addEnd() {
					const current = this.data.stack.peek();
					current.end = this.data.index;
					return this.data.stack;
				},
				addName(value) {
					const current = this.data.stack.peek();
					if ('name' in current) {
						current.name += value;
					} else {
						console.error('Invalid tag name. Adding ', value, 'to', current);
					}
					return this.data.stack;
				},
				addRaw(value) {
					const current = this.data.stack.peek();
					if ('raw' in current) {
						current.raw += value;
					} else {
						console.error('Invalid tag name. Adding ', value, 'to', current);
					}
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
					const current = this.data.stack.pop();
					if (current.type !== 'Attribute') {
						console.error('Popped element is not an attribute');
					} else {
						if (Array.isArray(current.value) && !current.value.length) {
							current.end = current.start + current.name.length;
							current.value = true;
						} else {
							current.end = this.data.index;
						}
						const parent = this.data.stack.peek();
						parent.append(current);
					}
					return this.data.stack;
				},
				popComment() {
					const current = this.data.stack.pop();
					if (current.type !== 'Comment') {
						throw Error('Attempted pop non-comment');
					}

					current.data = current.data.slice(0, -2)
					current.end = this.data.index;
					const last = this.data.stack.peek();

					last.append(current);

					return this.data.stack;
				},
				popElement() {
					const current = this.data.stack.pop();
					if (current.type !== 'Element') {
						throw Error('Attempted pop non-element');
					}

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
					const invalid = /** @type {PMInvalid} */(this.data.stack.pop());
					invalid.end = this.data.index;

					const nodeWithError = this.data.stack.pop();
					nodeWithError.end = this.data.index;
					nodeWithError.error = invalid;

					const parent = this.data.stack.peek();
					parent.append(nodeWithError);

					return this.data.stack;
				},
				popText() {
					const current = this.data.stack.pop();
					if (current.type !== 'Text') {
						throw Error('Popped element is not an text node');
					}

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
					const tag = this.data.stack.pop();
					if (tag.type !== 'Element') {
						console.error('Attempted to turn non-element to comment');
					} else {
						const child = new PMComment({
							start: tag.start,
							data: '',
						});
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
					const child = new PMInvalid({
						start: this.data.index,
						error,
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
				const current = /** @type {PMElement} */(this.data.stack.peek());
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