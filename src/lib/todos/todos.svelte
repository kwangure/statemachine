<script>
	import '@kwangure/strawberry/default/button';
	import Todo from './todo.svelte';

	/** @type {string} */
	export let filter;
	/** @type {ReturnType<import('$lib/todos/todos.js').todos>} */
	export let todos;

	$: todos.emit.SHOW(filter);

	/** @type {import('svelte/action').Action<HTMLInputElement, typeof todos.data>} */
	function indeterminate(input, data) {
		/**
         * @param {typeof todos.data} data
         */
		function update(data){
			input.indeterminate = data.todos.length > 0
				&& 0 < data.completedTodos.length
				&& data.completedTodos.length < data.todos.length
		}

		// @ts-ignore
		update(data);

		return {
			update,
		};
	}
</script>

<div class="layout">
	<section class="app" data-state={$todos}>
		<header class="header">
			<h1>todos</h1>
			<div class="filters">
				<a class:selected={$todos.data.filter === "all"} href="#/">
					All
				</a>
				<a class:selected={$todos.data.filter === "active"} href="#/active">
					Active
				</a>
				<a class:selected={$todos.data.filter === "completed"} href="#/completed">
					Completed
				</a>
			</div>
		</header>
		<div class='header-actions'>
			<input id="toggle-all" class="toggle-all toggle" type="checkbox" checked={$todos.data.allCompleted ? true : false}
				use:indeterminate={$todos.data}
				title="Mark all as {$todos.data.markAllAs}"
				on:change={() => ($todos.data.allCompleted ? todos.emit[`MARK.ACTIVE`] : todos.emit["MARK.COMPLETED"])()}/>
			<!-- svelte-ignore a11y-autofocus -->
			<input class="new-todo" placeholder="What needs to be done?" autofocus
				on:keypress={(event) => (event.key === "Enter") ? todos.emit["NEWTODO.COMMIT"](event.currentTarget.value) : void 0}
				on:input={(event) => todos.emit["NEWTODO.CHANGE"](event.currentTarget.value)}
				value={$todos.data.newTodo}/>
		</div>
		<section class="main">
			<div class="todo-list">
				{#each $todos.data.filteredTodos as todo (todo.data.id)}
					<Todo todo={todo}/>
				{/each}
			</div>
		</section>
		<footer class="footer">
			<span class="todo-count">
				{$todos.data.activeTodos.length}
				item{$todos.data.activeTodos.length === 1 ? "" : "s"} left
			</span>
			<button on:click={todos.emit.CLEAR_COMPLETED} class="clear-completed"
				class:show-clear-completed={$todos.data.activeTodos.length < $todos.data.todos.length}>
				Clear completed
			</button>
		</footer>
	</section>
</div>

<style>
	.layout {
		height: 100%;
		display: flex;
		justify-content: center;
		--todo-item-padding: 12px 24px;
	}
	.app {
		margin: 128px 0 64px 0;
		width: min(90vw, 500px);
	}
	.header {
		display: flex;
		align-items: center;
		padding: var(--todo-item-padding);
	}
	h1 {
		margin: 0;
	}
	.toggle-all {
		padding-inline: 24px 12px;
	}
	.header-actions {
		border: var(--br-input-container-border);
		border-radius: var(--br-input-container-border-radius);
		background-color: var(--br-input-container-background-color);
		transition: var(--br-input-container-transition);
		position: var(--br-input-container-position, relative);
		display: grid;
		grid-template-columns: 20px 1fr;
		padding: 12px 12px 12px 24px;
		gap: 12px;
	}
	.header-actions:focus-within {
		box-shadow: var(--br-input-container-focus-box-shadow);
    	border: var(--br-input-container-focus-border);
	}
	.header-actions input:not([type=checkbox]) {
		border: none;
		outline: 0;
		padding-block: var(--br-input-root-padding-block);
		padding-inline: var(--br-input-root-padding-inline);
		color: var(--br-input-root-font-color);
		height: var(--br-input-container-inner-height);
		background-color: transparent;
		flex-grow: 1;
		color: inherit;
	}
	.new-todo.new-todo {
		position: relative;
		margin: 0;
		width: 100%;
		font-size: 24px;
		font-family: inherit;
		font-weight: inherit;
		line-height: 1.4em;
		color: inherit;
		padding: 6px;
		box-sizing: border-box;
		-webkit-font-smoothing: antialiased;
		-moz-osx-font-smoothing: grayscale;
		padding: 16px 16px 16px 12px;
		height: 65px;
	}
	footer {
		display: flex;
		gap: 32px;
		padding: 12px 24px;
		align-items: center;
	}
	.filters {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-left: auto;
	}
	.filters a {
		padding: 4px 12px;
		border: var(--br-button-root-border);
		border-radius: 4px;
	}
	.filters a.selected {
		border-color: #CE4646;
	}
	.filters a:hover {
		border-color: #DB7676;
	}
	.clear-completed {
		opacity: 0.5;
		pointer-events: none;
		margin-left: auto;
	}
	.show-clear-completed {
		opacity: 1;
		pointer-events: all;
	}
</style>