<script>
	import { Code, json } from '@kwangure/strawberry/default/code';
	import { parser as stateParser } from '$lib/models/parser';
	import { parse as svelteParse } from 'svelte/compiler';
	import { escape } from 'svelte/internal';
    import Diff from '$lib/components/diff/diff.svelte';

	const code = '<div/>';
	const parserMachine = stateParser(code);
	let showing = 'statemachine';

	$: ({ state, data } = $parserMachine)
	$: ({ index, source, stack } = data);
	$: if (index < source.length) {
		if (index === 0) console.clear();
		setTimeout(() => {
			console.log({ value: source[index], index, state });
			parserMachine.emit.CHARACTER(source[index])
		}, 100);
	}
	$: rendered = renderParsing(index);
	$: [svelteJson, stateMachineJson] = [
		JSON.stringify(parse(code), null, 4),
		JSON.stringify(stack, null, 4),
	];

	/**
     * @param {string} code
     */
	function parse(code) {
		try {
			return svelteParse(code);
		} catch (error) {
			return error;
		}
	}
	/**
     * @param {number} index
     */
	function renderParsing(index) {
		const seen = source.substring(0, index);
		const current = source[index];
		const unseen = source.substring(index + 1);
		return [
			`<span class='seen'>${escape(seen)}</span>`,
			`<span class='current'>${escape(current)}</span>`,
			`<span class='unseen'>${escape(unseen)}</span>`,
		].join('');
	}
</script>
<pre>
{state} {index};
</pre>
<div class="desk">
	<div>
		{#if state === 'done'}
			<pre class="source seen">{source}</pre>
		{:else}
			<pre class="source">{@html rendered}</pre>
		{/if}
	</div>
	<div class="code">
		<div class="buttons">
			<button on:click={() => showing = 'statemachine'}>
				State Machine
			</button>
			<button on:click={() => showing = 'svelte'}>
				Svelte
			</button>
			<button on:click={() => showing = 'diff'}>
				Diff
			</button>
		</div>
		{#if showing === 'statemachine'}
			<h3>State Machine</h3>
			<Code highlight={json} code={stateMachineJson}/>
		{:else if showing === 'svelte'}
			<h3>Svelte</h3>
			<Code highlight={json} code={svelteJson}/>
		{:else if showing === 'diff'}
			<h3>Diff</h3>
			<Diff currentCode={stateMachineJson}
				currentCodeHighlight={json}
				originalCode={svelteJson}
				originalCodeHighlight={json}/>
		{/if}
	</div>
</div>

<style>
	.source :global(.current) {
		color: greenyellow;
		background-color: purple;
	}
	.source :global(.seen) {
		color: darkslategray;
		background-color: lightblue;
	}
	.desk {
		display: grid;
		grid-template-columns: 1fr 1fr;
	}
	.buttons {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
	}
	.code {
		display: grid;
		grid-template-rows: auto 1fr auto 1fr;
		min-height: 0;
	}
</style>
