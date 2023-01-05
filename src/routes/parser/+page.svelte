<script>
	import { Code, json } from '@kwangure/strawberry/default/code';
	import { parser as stateParser } from '$lib/models/parser';
	import { parse as svelteParse } from 'svelte/compiler';
	import { escape } from 'svelte/internal';

	const code = '< data/><data/>';
	const parserMachine = stateParser(code);

	$: ({ state, data } = $parserMachine)
	$: ({ index, source, stack } = data);
	$: if (index < source.length) {
		if (index === 0) console.clear();
		setTimeout(() => {
			console.log({ value: source[index], index, state });
			parserMachine.emit.CHARACTER(source[index])
		}, 100);
	}
	$: rendered = render(index);


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
	function render(index) {
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
		<h3>State Machine</h3>
		<Code highlight={json} code={JSON.stringify(stack, null, 4)}/>
		<h3>Svelte</h3>
		<Code highlight={json} code={JSON.stringify(parse(code), null, 4)}/>
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
	.code {
		display: grid;
		grid-template-rows: auto 1fr auto 1fr;
		min-height: 0;
	}
</style>
