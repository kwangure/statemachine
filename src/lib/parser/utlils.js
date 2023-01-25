/** regex of all html void element names */
const voidElementNamesRE = /^(?:area|base|br|col|command|embed|hr|img|input|keygen|link|meta|param|source|track|wbr)$/;

/**
 * @param {string} name
 */
export function isVoidElement(name) {
	return voidElementNamesRE.test(name) || name.toLowerCase() === '!doctype';
}