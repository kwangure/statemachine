import * as codeRed from 'code-red';

/**
 * @param {string} source
 */
export function parse(source) {
	return codeRed.parse(source, {
		sourceType: 'module',
		ecmaVersion: 12,
		locations: true
	});
};

/**
 * @param {string} source
 * @param {number} index
 */
export function parseExpressionAt(source, index) {
	return codeRed.parseExpressionAt(source, index, {
		sourceType: 'module',
		ecmaVersion: 12,
		locations: true
	});
};
