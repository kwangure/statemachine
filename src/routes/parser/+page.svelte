<script>
	import { Code, json } from '@kwangure/strawberry/default/code';
	import { Container } from '@kwangure/strawberry/default/input/container';
	import { parser as stateParser, transformToSvelte } from '$lib/models/parser';
	import { parse as svelteParse } from 'svelte/compiler';
	import { escape } from 'svelte/internal';
    import Diff from '$lib/components/diff/diff.svelte';
    import { localStorageWritable } from '$lib/stores/localStorageWritable';

	let code = localStorageWritable('code', '');
	let showing = 'sveltish';

	let svelteLike = {};
	$: parserMachine = stateParser($code);
	$: ({ state, data } = $parserMachine)
	$: ({ index, maybeStack, source, stack } = data);
	$: if (index < source.length) {
		if (index === 0) console.clear();
		setTimeout(() => {
			console.log({ value: source[index], index, state });
			parserMachine.emit.CHARACTER(source[index])
		}, 0);
	} else {
		svelteLike = transformToSvelte(parserMachine);
	}
	$: rendered = renderParsing(index);
	$: [maybeStackJson, sveltish, svelteJson, stateMachineJson] = [
		JSON.stringify(maybeStack, null, 4),
		JSON.stringify(svelteLike, null, 4),
		JSON.stringify(parse($code), null, 4),
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
		<Container>
			<textarea bind:value={$code}/>
		</Container>
		{#if state === 'done'}
			<pre class="source seen">{source}</pre>
		{:else}
			<pre class="source">{@html rendered}</pre>
		{/if}
	</div>
	<div class="code">
		<div class="buttons">
			<button on:click={() => showing = 'sveltish'}>
				Sveltish
			</button>
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
		{#if showing === 'sveltish'}
			<h3>State Machine</h3>
			<Code highlight={json} code={`${sveltish}`}/>
		{:else if showing === 'statemachine'}
			<h3>State Machine</h3>
			<Code highlight={json} code={`${stateMachineJson}\n${maybeStackJson}`}/>
		{:else if showing === 'svelte'}
			<h3>Svelte</h3>
			<Code highlight={json} code={`${svelteJson}`}/>
		{:else if showing === 'diff'}
			<h3>Diff</h3>
			<Diff currentCode={sveltish}
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
