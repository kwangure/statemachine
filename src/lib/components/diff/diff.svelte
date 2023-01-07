<script>
    import { ROWTYPE_ADDITION, ROWTYPE_DELETION, ROWTYPE_EQUAL, ROWTYPE_SPACER } from "./diff";
	import { buildDiffRows, lineDiff } from './diff.js';
	/**
	 * @typedef {import('$lib/components/diff/diff').Row} Row
	 * @typedef {import('$lib/components/diff/diff').RowType} RowType
	*/
	/** @type {string} */
	export let originalCode;
	/** @type {string} */
	export let currentCode;
	// Any syntax highlighter
	/** @type {typeof import('@kwangure/strawberry/components/code').css} */
	export let originalCodeHighlight;
	/** @type {typeof import('@kwangure/strawberry/components/code').css} */
	export let currentCodeHighlight;

	$: diffArray = lineDiff(originalCode, currentCode);
	$: ({ originalLines, currentLines, rows } = buildDiffRows(diffArray, { showDiffOnly: true }));
	$: originalMap = documentMap(originalLines);
	$: currentMap = documentMap(currentLines);

	const markers = {
		[ROWTYPE_ADDITION]: '+',
		[ROWTYPE_DELETION]: '-',
		[ROWTYPE_EQUAL]: ' ',
		[ROWTYPE_SPACER]: ' ',
	};
	const markerClasses = {
		[ROWTYPE_ADDITION]: 'diff-line-addition',
		[ROWTYPE_DELETION]: 'diff-line-deletion',
		[ROWTYPE_EQUAL]: '',
		[ROWTYPE_SPACER]: '',
	};

	/**
     * @param {Row} row
     */
	function render(row) {
		const { currentLineNumber, originalLineNumber, type } = row;
		const baseNumber = type === ROWTYPE_EQUAL || type === ROWTYPE_DELETION
			? String(originalLineNumber) : '';
		const curNumber = type === ROWTYPE_EQUAL || type === ROWTYPE_ADDITION
			? String(currentLineNumber) : '';
		if (row.type === 'spacer') {
			return {
				...row,
				baseNumber,
				curNumber,
				tokens: row.tokens
					.map(({ text, ...rest }) => {
						return { color: '', segment: text, ...rest }
					}),
			};
		}

		const code = type === "deletion" ? originalCode : currentCode;
		const highlighter = type === "deletion" ? originalCodeHighlight : currentCodeHighlight;
		const startPos = /** @type {number} */ (type === 'deletion'
			? originalMap.get(originalLineNumber)
			: currentMap.get(currentLineNumber))

		// We highlight token by token so that we augment syntax-highlighting
		// with inner-diff coloring color
		const tokens = [];
		let pos = startPos;
		for (const { className = '', text } of row.tokens) {
			const highlighted = highlighter(code, {
				from: pos,
				to: pos + text.length,
			}).map((h) => ({ ...h, className }));
			tokens.push(...highlighted);
			pos += text.length;
		}

		return {
			baseNumber,
			curNumber,
			originalLineNumber,
			tokens,
			type
		};
	}

	/**
	 * @param {string[]} lines
	 * @return {Map<number, number>}
	 */
	 function documentMap(lines) {
		const map = new Map();
		for (let pos = 0, lineNo = 0; lineNo < lines.length; lineNo++) {
			map.set(lineNo + 1, pos);
			pos += lines[lineNo].length + 1;
		}
		return map;
	}
</script>


<div class="diff-listing">
	{#each rows as row}
		{@const { baseNumber = '', curNumber = '', tokens, type } = render(row)}
		<div class="diff-line-number" aria-hidden="true">{baseNumber}</div>
		<div class="diff-line-number" aria-hidden="true">{curNumber}</div>
		<div class="diff-line-marker {markerClasses[type]}" aria-hidden="true">
			{markers[type]}
		</div>
		<div class="diff-line-content diff-line-{type}" data-line-number={curNumber}>
			{#if type === "addition"}
				<span class="diff-hidden-text">Addition:</span>
			{:else if type === "deletion"}
				<span class="diff-hidden-text">Deletion:</span>
			{/if}
			{#each tokens as { className, segment, color }}
				<span class="{className}" style='color: var(--br-code-token-{color}-color);'>{segment}</span>
			{/each}
		</div>
	{:else}
		No difference
	{/each}
</div>


<style>
	.diff-listing {
		display: grid;
		grid-template-columns: max-content max-content max-content auto;
		font-family: var(--source-code-font-family);
		font-size: var(--source-code-font-size);
		white-space: pre;
		user-select: text;
		padding: 16px;
		overflow: auto;
		font-size: 85%;
		line-height: 1.45;
		background-color: var(--br-code-root-background-color);
		color: var(--br-code-root-font-color);
		border-radius: var(--br-code-root-border-radius);
		margin: 0;
		font-family: monospace;
	}
	.diff-line-number {
		color: var(--color-line-number);
		padding: 0 3px 0 9px;
		text-align: right;
		user-select: none;
	}
	.diff-line-marker {
		border-right: 1px solid var(--color-details-hairline);
		width: 20px;
		text-align: center;
	}
	.diff-line-content {
		padding: 0 4px;
	}
	.diff-line-marker-addition,
	.diff-line-addition {
		--override-addition-background-color: hsl(144deg 55% 49% / 20%);

		background-color: var(--override-addition-background-color);
	}
	.diff-line-marker-deletion,
	.diff-line-deletion {
		--override-deletion-background-color: rgb(255 0 0 / 20%);

		background-color: var(--override-deletion-background-color);
	}

	.diff-line-addition .inner-diff {
		--override-addition-inner-diff-background-color: hsl(144deg 55% 49% / 30%);

		background-color: var(--override-addition-inner-diff-background-color);
	}
	.diff-line-deletion .inner-diff {
		--override-deletion-inner-diff-background-color: rgb(255 0 0 / 30%);

		background-color: var(--override-deletion-inner-diff-background-color);
	}

	.diff-hidden-text {
		display: inline-block;
		width: 0;
		overflow: hidden;
	}
	.diff-line-spacer {
		--override-spacer-background-color: rgb(0 0 255 / 10%);

		text-align: center;
		background-color: var(--override-spacer-background-color);
	}
</style>