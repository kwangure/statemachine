<script>
	import { Container } from '@kwangure/strawberry/default/input/container';

	/** @type {ReturnType<import('$lib/todos/todo.js').todo>} */
	export let todo;

	/** @type {import('svelte/action').Action<HTMLInputElement>} */
	function focus(node, state) {
		/** @param {string} state */
		function update(state){
			if (state === 'editing') node.focus();
		}

		update(state)

		return { update };
	}

	/**
	 * @param {Event & {
	 *     currentTarget: EventTarget & HTMLInputElement;
	 * }} event */
	function input(event) {
		todo.emit.CHANGE(event.currentTarget.value);
	}
	/** @param {KeyboardEvent} event */
	function keypress(event) {
		if (event.key === "Enter") {
			todo.emit.COMMIT()
		}
	}
	/** @param {KeyboardEvent} event */
	function keydown(event) {
		if (event.key === "Escape") {
			todo.emit.CANCEL()
		}
	}
</script>

<div>
	<div class="view">
		<input id={$todo.data.id} class="toggle" type="checkbox" on:change={todo.emit.TOGGLE_COMPLETE} checked={$todo.data.completed}/>
		{#if $todo.state === 'editing'}
			<Container>
				<input class="edit" value={$todo.data.title} use:focus={$todo.state}
					on:blur={todo.emit.BLUR} on:input={input} on:keypress={keypress}
					on:keydown={keydown}/>
			</Container>
		{:else}
			<div class='label' class:completed={$todo.data.completed}
				on:dblclick={todo.emit.EDIT}>
				{$todo.data.title}
			</div>
		{/if}
		<button class='destroy' on:click={todo.emit.DELETE} />
	</div>
</div>

<style>
	.view {
		font-size: 24px;
		border-bottom: var(--br-button-root-border);
		display: grid;
		grid-template-columns: 20px 1fr 40px;
		padding: var(--todo-item-padding);
		gap: 12px;
	}
	.label {
		word-break: break-all;
		flex: 1;
		line-height: 1.2;
		transition: color 0.4s;
		font-weight: 400;
		padding-block: 4px;
    	padding-inline: 13px 8px;
	}
	.label.completed {
		opacity: 0.9;
		text-decoration: line-through;
	}
	.destroy {
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 30px;
		opacity: 0.8;
	}
	.destroy:after {
		content: '×';
		display: block;
		height: 100%;
		line-height: 1.1;
	}
</style>
