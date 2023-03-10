import * as acorn from './acorn.js';
import { PMAttribute, PMComment, PMElement, PMFragment, PMInvalid, PMMustacheTag, PMScript, PMText } from './nodes/nodes.js';
import { ESArray, ESBoolean, ESNumber } from "eventscript/nodes";
import { Machine } from '$lib/machine/create.js'
import { isVoidElement } from './utlils.js';
import { PMStack } from './data.js';

import { afterAttributeNameState } from './states/afterAttributeName.js';
import { afterAttributeValueQuoted } from './states/afterAttributeValueQuoted.js';
import { afterCommentBangState } from './states/afterCommentBang.js';
import { afterCommentContentState } from './states/afterCommentContent.js';
import { attributeNameState } from './states/attributeName.js';
import { attributeValueMustacheState } from './states/attributeValueMustache.js';
import { attributeValueQuotedState } from './states/attributeValueQuoted.js';
import { attributeValueUnquotedState } from './states/attributeValueUnquoted.js';
import { beforeAttributeNameState } from './states/beforeAttributeName.js';
import { beforeAttributeValueState } from './states/beforeAttributeValue.js';
import { beforeCommentEndState } from './states/beforeCommentEnd.js';
import { beforeCommentStartState } from './states/beforeCommentStart.js';
import { beforeEndTagCloseState } from './states/beforeEndTagClose.js';
import { commentContentState } from './states/commentContent.js';
import { doneState } from './states/done.js';
import { endTagOpenState } from './states/endTagOpen.js';
import { endTagVoidState } from './states/endTagVoid.js';
import { endTagNameState } from './states/endTagName.js';
import { fragmentState } from './states/fragment.js';
import { notImplementedState } from './states/notImplemented.js';
import { invalidState } from './states/invalid.js';
import { selfClosingTagState } from './states/selfClosingTag.js';
import { tagNameState } from './states/tagName.js';
import { tagOpenState } from './states/tagOpen.js';
import { textState } from './states/text.js';

/**
 * @param {string} char
 */
function quoteChar(char) {
	return char === '\'' ? `"${char}"` : `'${char}'`;
}

/**
 * @typedef {import('./nodes/nodes.js').PMTemplateNode} PMTemplateNode
 * @param {string} source
 * @param {{ language?: 'svelte' | 'html'; }} [options]
 */
export function parser(source, options = {}) {
	const { language = 'svelte' } = options;
	let index = new ESNumber(0);
	let html = new PMFragment({
		start: Number(index),
		end: source.length,
	});
	let stack = new PMStack(html);
	let maybeStack = new PMStack();
	let mustacheDepth = new ESNumber(0);
	let openQuote = /** @type {'"' | '\''} */'\'';
	let error = /** @type {{ code: string; message: string } | null} */(null);
	const parser = new Machine({
		data() {
			return {
				error,
				index: Number(index),
				html,
				language,
				maybeStack,
				mustacheDepth,
				source,
				stack,
				openQuote,
			};
		},
		ops: {
			['$index.increment']() {
				// @ts-ignore
				return index.set(index + 1);
			},
			/** @param {string} value */
			['$stack.addData'](value) {
				stack.peek().data += value;
			},
			['$stack.addEnd']() {
				stack.peek().end = index;
			},
			/** @param {string} value */
			['$stack.addName'](value) {
				stack.peek().name += value;
			},
			/** @param {string} value */
			['$stack.addRaw'](value) {
				stack.peek().raw += value;
			},
			['$stack.fromMaybeStack']() {
				stack.push(maybeStack.peek());
			},
			['$stack.pop']() {
				stack.pop();
			},
			['$stack.popAttribute']() {
				const current = stack.pop({ expect: 'Attribute' });
				if (current.get('value') instanceof ESArray && current.get('value').length < 1) {
					current.end = current.start + current.name.length;
					current.set('value', new ESBoolean(true));
				} else {
					current.end = index;
				}
				const parent = stack.peek();
				parent.append(current);
			},
			['$stack.popComment']() {
				const current = stack.pop({ expect: 'Comment' });

				current.data = current.data.slice(0, -2);
				current.end = index;
				const last = stack.peek();
				last.append(current);
			},
			['$stack.popElement']() {
				const current = stack.pop({ expect: 'Element' });

				if (
					this.transition.from === 'endTagName'
					|| this.transition.from === 'beforeEndTagClose'
				) {
					let parentTag = stack.pop();

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
						const nextParent = stack.pop();
						nextParent.append(parentTag)
						parentTag = nextParent;
					}
					parentTag.end = index;
					const last = stack.peek();
					last.append(parentTag);
				} else {
					current.end = index;
					const last = stack.peek();
					last.append(current)
				}
			},
			['$stack.popInvalid']() {
				const invalid = stack.pop({ expect: 'Invalid' });
				invalid.end = index;

				const nodeWithError = stack.pop();
				nodeWithError.end = index;
				nodeWithError.error = invalid;

				const parent = stack.peek();
				parent.append(nodeWithError);
			},
			['$stack.popMustache']() {
				const current = stack.pop({ expect: 'MustacheTag' });
				const parent = stack.peek();
				current.end = index;
				parent.append(current);
			},
			['$stack.popText']() {
				const current = stack.pop({ expect: 'Text' });
				const parent = stack.peek();
				current.end = index;
				// TODO: decode html character entities
				// https://github.com/sveltejs/svelte/blob/dd11917fe523a66d8f5d66aab8cbcf965f30f25f/src/compiler/parse/state/tag.ts#L521
				current.data = current.raw;
				parent.append(current);
			},
			['$stack.pushAttribute']() {
				const child = new PMAttribute({
					start: Number(index),
					name: '',
				});
				stack.push(child);
			},
			['$stack.pushComment']() {
				const tag = stack.pop({ expect: 'Element' });
				const child = new PMComment({
					start: tag.start,
					data: '',
				});
				stack.push(child);
			},
			/** @param {string} value */
			['$stack.pushInvalid'](value) {
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
					start: Number(index),
					...error,
				});
				stack.push(child);
				error = null;
			},
			['$stack.pushTag']() {
				const child = (new PMElement({
					start: Number(index),
					name: '',
				}));
				stack.push(child);
			},
			['$stack.pushMustache']() {
				const child = new PMMustacheTag({
					start: Number(index),
					raw: '',
				});
				stack.push(child);
			},
			['$stack.pushText']() {
				const child = new PMText({
					start: Number(index),
					data: '',
					raw: '',
				});
				stack.push(child);
			},
			/** @param {string} value */
			['$maybeStack.addRaw'](value) {
				maybeStack.peek().raw += value;
			},
			['$maybeStack.pop']() {
				maybeStack.pop();
			},
			['$maybeStack.popText']() {
				const current = maybeStack.pop({ expect: 'Text' });
				const parent = maybeStack.peek();
				current.end = index;
				// TODO: decode html character entities
				// https://github.com/sveltejs/svelte/blob/dd11917fe523a66d8f5d66aab8cbcf965f30f25f/src/compiler/parse/state/tag.ts#L521
				current.data = current.raw;
				parent.append(current);
			},
			['$maybeStack.pushText']() {
				const child = new PMText({
					start: Number(index),
					data: '',
					raw: '',
				});
				maybeStack.push(child);
			},
			/** @param {string} value */
			['$openQuote.set'](value) {
				openQuote = value;
			},
			/** @param {string} value */
			['$error.incompleteComment'](value) {
				error = {
					code: 'incomplete_comment',
					message: `Expected a valid comment character but instead found ${quoteChar(value)}`,
				};
			},
			/** @param {string} value */
			['$error.invalidTagName'](value) {
				error = {
					code: 'invalid_tag_name',
					message: `Expected a valid tag character but instead found ${quoteChar(value)}`,
				};
			},
			['$error.invalidVoidContent']() {
				const current = /** @type {PMElement} */(stack.peek());

				error = {
					code: 'invalid-void-content',
					message: `<${current.name}> is a void element and cannot have children, or a closing tag`
				};
			},
			/** @param {string} value */
			['$error.invalidAttributeName'](value) {
				error = {
					code: 'invalid_attribute_name',
					message: `Expected a valid attribute character but instead found ${quoteChar(value)}`,
				};
			},
			/** @param {string} value */
			['$error.invalidUnquotedValue'](value) {
				error = {
					code: 'invalid_unquoted_value',
					message: `${quoteChar(value)} is not permitted in unquoted attribute values`
				}
			},
			['$error.unclosedBlock']() {
				const current = /** @type {PMAttribute | PMComment | PMElement} */(
					stack.peek()
				);
				const types = {
					Attribute: 'tag',
					Comment: 'comment',
					Element: `tag`,
				};
				const type = types[current.type] || 'block';
				error = {
					code: `unclosed-${type}`,
					message: `${type[0].toUpperCase() + type.substring(1)} was left open`,
				};
			},
			['$mustacheDepth.increment']() {
				// @ts-ignore
				return mustacheDepth.set(mustacheDepth + 1);
			},
			['$mustacheDepth.decrement']() {
				// @ts-ignore
				return mustacheDepth.set(mustacheDepth - 1);
			},
		},
		config: {
			states: [
				fragmentState,
				afterAttributeNameState,
				afterAttributeValueQuoted,
				afterCommentBangState,
				afterCommentContentState,
				attributeNameState,
				attributeValueMustacheState,
				attributeValueQuotedState,
				attributeValueUnquotedState,
				beforeAttributeNameState,
				beforeAttributeValueState,
				beforeCommentEndState,
				beforeCommentStartState,
				beforeEndTagCloseState,
				commentContentState,
				doneState,
				endTagOpenState,
				endTagNameState,
				endTagVoidState,
				invalidState,
				notImplementedState,
				selfClosingTagState,
				tagNameState,
				tagOpenState,
				textState,
			],
		},
		conditions: {
			/** @param {string} value */
			isAlphaCharacter(value) {
				return /[A-z]/.test(value);
			},
			/** @param {string} value */
			isEquals(value) {
				return value === '=';
			},
			/** @param {string} value */
			isExclamation(value) {
				return value === '!';
			},
			/** @param {string} value */
			isForwardSlash(value) {
				return value === '/';
			},
			isDone() {
				// TODO: Listen for a EOF char so that we never need the original source
				return Number(index) === source.length;
			},
			/** @param {string} value */
			isInvalidUnquotedValue(value) {
				return /[\s"'=<>`]/.test(value);
			},
			/** @param {string} value */
			isMinus(value) {
				return value === '-';
			},
			/** @param {string} value */
			isNonAlphaCharacter(value) {
				return !/[A-z]/.test(value);
			},
			/** @param {string} value */
			isQuote(value) {
				return value === '"' || value === '\'';
			},
			/** @param {string} value */
			isQuoteClosed(value) {
				return value === openQuote;
			},
			/** @param {string} value */
			isTagOpen(value) {
				return value === '<';
			},
			/** @param {string} value */
			isSvelteMustacheClosed(value) {
				return language === 'svelte' && value === '}';
			},
			/** @param {string} value */
			isSvelteMustacheOpen(value) {
				return language === 'svelte' && value === '{';
			},
			/** @param {string} value */
			isSveltemustacheDepthDone(value) {
				return language === 'svelte'
					&& Number(mustacheDepth) === 0
					&& value === '}';
			},
			/** @param {string} value */
			isTagClose(value) {
				return value === '>';
			},
			/** @param {string} value */
			isVoidTag(value) {
				const current = stack.peek({ expect: 'Element' });
				return isVoidElement(current.name + value);
			},
			/** @param {string} value */
			isWhitespace(value) {
				return /\s/.test(value);
			},
			stackNotEmpty() {
				return stack.size > 1;
			},
		},
		actions: {
			/** @param {string} value */
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

	// Do not modify original stack
	const children = /** @type {any} */(fragment.toJSON()['children']);

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
				.findIndex((/** @type {{ name: string; }} */ attribute) => attribute.name === 'context');
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
					}).toJSON();
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
				}).toJSON();
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
				}).toJSON();
				nonscripts.push(node);
			} else {
				const start = scriptChild
					? scriptChild.start
					: parser.data.source.indexOf('</', node.start);
				const end = scriptChild
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
					const script = Object.assign(new PMScript({
						start: node.start,
						end: node.end,
						context,
						// @ts-ignore
						content: ''
					}).toJSON(), { content: JSON.parse(JSON.stringify(ast)) });
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
					}).toJSON();
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
		// @ts-ignore
		while (/\s/.test(parser.data.source[start])) start += 1;

		// TODO: is optional end on template nodes still necessary?
		end = /** @type {number} */(/** @type {PMTemplateNode} */(nonscripts.at(-1)).end);
		while (/\s/.test(parser.data.source[end - 1])) end -= 1;
	} else {
		start = end = null;
	}

	/** @type {Record<string, any>} */
	const result = {
		html: {
			start,
			end,
			type: 'Fragment',
			children: nonscripts,
		},
	}

	if (instance) {
		result.instance = instance
	}
	if (module) {
		result.module = module
	}

	return result;
}
