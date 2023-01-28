<script>
	import { Container } from '@kwangure/strawberry/default/input/container';
	import { createEventDispatcher } from 'svelte';

	export let completed = false;
	export let title = '';

	const dispatch = createEventDispatcher();
	const dispatchDelete = () => dispatch('delete');

	/** @param {HTMLInputElement} node */
	function focus(node) {
		function update(){
			if (isEditing) node.focus();
		}
		update();
		return { update };
	}

	let isEditing = false;
	let prevTitle = '';

	function edit() {
		prevTitle = title;
		isEditing = true;
	}

	function view() {
		isEditing = false;
	}

	/** @param {KeyboardEvent} event */
	function enter(event) {
		if (event.key !== "Enter") return;
		isEditing = false;
	}

	/** @param {KeyboardEvent} event */
	function cancel(event) {
		if (event.key !== "Escape") return;
		title = prevTitle;
		isEditing = false;
	}
</script>

<div class="view">
	<input class="toggle" type="checkbox" bind:checked={completed}/>
	{#if isEditing}
		<Container>
			<input class="edit" bind:value={title} use:focus on:blur={view}
				on:keypress={enter} on:keydown={cancel}/>
		</Container>
	{:else}
		<div class='label' class:completed on:dblclick={edit}>
			{title}
		</div>
	{/if}
	<button class='destroy' on:click={dispatchDelete} />
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
