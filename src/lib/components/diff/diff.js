// Copyright 2016 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
// https://github.com/ChromeDevTools/devtools-frontend/blob/main/front_end/ui/components/diff_view/DiffView.ts

import { diff_match_patch as DiffMatchPatch } from 'diff-match-patch';

/**
 * @typedef {{ 0: number; 1: string[] }[]} DiffArray
 * @typedef {{ text: string; className: string; }} Token
 * @typedef {'deletion' | 'addition' | 'equal' | 'spacer'} RowType
 * @typedef {{
 * 		originalLineNumber: number;
 * 		currentLineNumber: number;
 * 		tokens: Token[];
 * 		type: RowType;
 * }} Row
 *
 * @typedef {Object} DiffRowOptions
 * @property {boolean} [showDiffOnly=true] - When true only equal lines are skipped
 * @property {number} [paddingLines=3] - The number of equal lines to pad diffs is `showDiffOnly` is true
 */
export const OPERATION_EQUAL = 0;
export const OPERATION_INSERT = 1;
export const OPERATION_DELETE = -1;

/** @type {RowType} */
export const ROWTYPE_ADDITION = 'addition';
/** @type {RowType} */
export const ROWTYPE_DELETION = 'deletion';
/** @type {RowType} */
export const ROWTYPE_EQUAL = 'equal';
/** @type {RowType} */
export const ROWTYPE_SPACER = 'spacer';

/**
 * @template T
 * @type {CharacterIdMap<T>}
 */
class CharacterIdMap {
	/**
	 * @readonly
	 * @type {Map<T, string>}
	 */
	#elementToCharacter;
	/**
	 * @readonly
	 * @type {Map<string, T>}
	 */
	#characterToElement;
	/** @type {number} */
	#charCode;

	constructor() {
		this.#elementToCharacter = new Map();
		this.#characterToElement = new Map();
		this.#charCode = 33;
	}

	/**
	 * @param {T} object
	 */
	toChar(object) {
		let character = this.#elementToCharacter.get(object);
		if (!character) {
			if (this.#charCode >= 0xFFFF) {
				throw new Error('CharacterIdMap ran out of capacity!');
			}
			character = String.fromCharCode(this.#charCode++);
			this.#elementToCharacter.set(object, character);
			this.#characterToElement.set(character, object);
		}
		return character;
	}

	/**
	 * @param {string} character
	 */
	fromChar(character) {
		const object = this.#characterToElement.get(character);
		if (object === undefined) {
			return null;
		}
		return object;
	}
}

/**
 * @param {string} text1
 * @param {string} text2
 * @param {boolean} [cleanup]
 */
function charDiff(text1, text2, cleanup) {
	const differ = new DiffMatchPatch();
	const diff = differ.diff_main(text1, text2);
	if (cleanup) {
		differ.diff_cleanupSemantic(diff);
	}
	return diff;
}

const newLineRE = /\r\n?|\n/;
/**
 *  @type {{
 * 		(lines1:string, lines2:string): DiffArray;
 * 		(lines1:string[], lines2: string[]): DiffArray;
 * }}
 */
export const lineDiff = function (lines1, lines2) {
	lines1 = typeof lines1 === 'string' ? lines1.split(newLineRE) : lines1;
	lines2 = typeof lines2 === 'string' ? lines2.split(newLineRE) : lines2;

	const idMap = new CharacterIdMap();
	const text1 = lines1.map(line => idMap.toChar(line)).join('');
	const text2 = lines2.map(line => idMap.toChar(line)).join('');

	const diff = charDiff(text1, text2);
	const lineDiff = [];
	for (let i = 0; i < diff.length; i++) {
		const lines = [];
		for (let j = 0; j < diff[i][1].length; j++) {
			lines.push(idMap.fromChar(diff[i][1][j]) || '');
		}

		lineDiff.push({ 0: diff[i][0], 1: lines });
	}
	return lineDiff;
}

/**
 * @param {DiffArray} diff
 * @param {DiffRowOptions} [options]
 */
export function buildDiffRows(diff, options = {}) {
	let currentLineNumber = 0;
	let originalLineNumber = 0;
	const { paddingLines = 3, showDiffOnly = true } = options;

	/** @type {string[]} */
	const originalLines = [];
	/** @type {string[]} */
	const currentLines = [];
	/** @type {Row[]} */
	const rows = [];

	for (let i = 0; i < diff.length; ++i) {
		const token = diff[i];
		switch (token[0]) {
			case OPERATION_EQUAL:
				if (showDiffOnly) {
					rows.push(...createEqualRows(token[1], i === 0, i === diff.length - 1));
				} else {
					for (const line of token[1]) {
						rows.push(createRow(line, ROWTYPE_EQUAL));
					}
				}
				originalLines.push(...token[1]);
				currentLines.push(...token[1]);
				break;
			case OPERATION_INSERT:
				for (const line of token[1]) {
					rows.push(createRow(line, ROWTYPE_ADDITION));
				}
				currentLines.push(...token[1]);
				break;
			case OPERATION_DELETE:
				originalLines.push(...token[1]);
				if (diff[i + 1] && diff[i + 1][0] === OPERATION_INSERT) {
					i++;
					rows.push(...createModifyRows(token[1].join('\n'), diff[i][1].join('\n')));
					currentLines.push(...diff[i][1]);
				} else {
					for (const line of token[1]) {
						rows.push(createRow(line, ROWTYPE_DELETION));
					}
				}
				break;
		}
	}

	return { originalLines, currentLines, rows };

	/**
	 * @param {string[]} lines
	 * @param {boolean} atStart
	 * @param {boolean} atEnd
	 * @returns {Row[]}
	 */
	function createEqualRows(lines, atStart, atEnd) {
		const equalRows = [];
		if (!atStart) {
			for (let i = 0; i < paddingLines && i < lines.length; i++) {
				equalRows.push(createRow(lines[i], ROWTYPE_EQUAL));
			}
			if (lines.length > paddingLines * 2 + 1 && !atEnd) {
				equalRows.push(createRow(`( … Skipping ${(lines.length - paddingLines * 2)} matching lines … )`, ROWTYPE_SPACER));
			}
		}
		if (!atEnd) {
			const start = Math.max(lines.length - paddingLines - 1, atStart ? 0 : paddingLines);
			let skip = lines.length - paddingLines - 1;
			if (!atStart) {
				skip -= paddingLines;
			}
			if (skip > 0) {
				originalLineNumber += skip;
				currentLineNumber += skip;
			}

			for (let i = start; i < lines.length; i++) {
				equalRows.push(createRow(lines[i], ROWTYPE_EQUAL));
			}
		}
		return equalRows;
	}

	/**
	 * @param {string} before
	 * @param {string} after
	 * @returns {Row[]}
	 */
	function createModifyRows(before, after) {
		const internalDiff = charDiff(before, after, true /* cleanup diff */);
		const deletionRows = [createRow('', ROWTYPE_DELETION)];
		const insertionRows = [createRow('', ROWTYPE_ADDITION)];

		for (const token of internalDiff) {
			const text = token[1];
			const type = token[0];
			const className = type === OPERATION_EQUAL ? '' : 'inner-diff';
			const lines = text.split('\n');
			for (let i = 0; i < lines.length; i++) {
				if (i > 0 && type !== OPERATION_INSERT) {
					deletionRows.push(createRow('', ROWTYPE_DELETION));
				}
				if (i > 0 && type !== OPERATION_DELETE) {
					insertionRows.push(createRow('', ROWTYPE_ADDITION));
				}
				if (!lines[i]) {
					continue;
				}
				if (type !== OPERATION_INSERT) {
					deletionRows[deletionRows.length - 1].tokens.push({ text: lines[i], className });
				}
				if (type !== OPERATION_DELETE) {
					insertionRows[insertionRows.length - 1].tokens.push({ text: lines[i], className });
				}
			}
		}
		return deletionRows.concat(insertionRows);
	}

	/**
	 * @param {string} text
	 * @param {RowType} type
	 */
	function createRow(text, type) {
		if (type === ROWTYPE_ADDITION) {
			currentLineNumber++;
		}
		if (type === ROWTYPE_DELETION) {
			originalLineNumber++;
		}
		if (type === ROWTYPE_EQUAL) {
			originalLineNumber++;
			currentLineNumber++;
		}

		return { originalLineNumber, currentLineNumber, tokens: text ? [{ text, className: 'inner-diff' }] : [], type };
	}
}
