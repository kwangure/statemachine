<script>
    import '@kwangure/strawberry/default/button';
    import { getLocalStorageItem } from '$lib/utils/index.js';
    import { page } from '$app/stores';
	import { Todo } from '$lib/todos2/index.js';
	import { uid } from 'uid';

	const TODOS_STORE = 'todos';

	/**
	 * @typedef {{
	 *     completed: boolean;
	 *     id: string;
	 *     title: string;
	 * }} Todo
	*/

	const todoJson = getLocalStorageItem(TODOS_STORE, '[]');
	let todos = /** @type {Todo[]} */ (JSON.parse(todoJson));

	/** @param {Todo[]} todos */
	function saveTodos(todos) {
		try {
			const todosJson = JSON.stringify(todos);
			localStorage.setItem(TODOS_STORE, todosJson);
		} catch (error) {
			console.error(error);
		}
	};

    $: filter = /** @type {"all" | "active" | "completed"} */ ($page.url.hash.slice(2) || 'all');
	$: activeTodos = todos.filter((todo) => !todo.completed);
	$: completedTodos = todos.filter((todo) => todo.completed);
	$: allCompleted = todos.length > 0 && activeTodos.length === 0;
	$: markAllAsLabel = allCompleted ? "active" : "completed";
	$: filteredTodos = (() => {
		let toMap = todos;
		if (filter === 'active') toMap = activeTodos;
		if (filter === 'completed') toMap = completedTodos;
		return new Set(toMap.map((todo) => todo.id));
	})();
	$: saveTodos(todos);

	/** @type {HTMLInputElement} */
	let input;
	$: {
		if (input) {
			input.indeterminate = todos.length > 0
				&& 0 < completedTodos.length
				&& completedTodos.length < todos.length
		}
	}

	/**
     * @param {boolean} value
     */
	function markAllAs(value) {
		todos = todos.map((todo) => {
			todo.completed = value;
			return todo;
		});
	}

	/**
     * @param {KeyboardEvent & {
	 *     currentTarget: HTMLInputElement;
	 * }} event
     */
	function addTodo(event) {
		if (event.key !== "Enter" || !event.currentTarget.value) return;
		todos = [
			...todos,
			{
				completed: false,
				id: uid(),
				title: event.currentTarget.value,
			},
		];
	}

	function clearCompleted() {
		todos = todos.filter((todo) => {
			return !todo.completed;
		});
	}

    /** @param {string} id */
    function deleteById(id) {
		todos = todos.filter((todo) => {
			return todo.id !== id;
		});
	}
</script>

<div class="layout">
	<section class="app" data-state={todos}>
		<header class="header">
			<h1>todos</h1>
			<div class="filters">
				<a class:selected={filter === "all"} href="#/">
					All
				</a>
				<a class:selected={filter === "active"} href="#/active">
					Active
				</a>
				<a class:selected={filter === "completed"} href="#/completed">
					Completed
				</a>
			</div>
		</header>
		<div class='header-actions'>
			<input id="toggle-all" class="toggle-all toggle" type="checkbox" checked={allCompleted}
				bind:this={input} title="Mark all as {markAllAsLabel}"
				on:change={() => markAllAs(!allCompleted)}/>
			<!-- svelte-ignore a11y-autofocus -->
			<input class="new-todo" placeholder="What needs to be done?" autofocus on:keypress={addTodo}/>
		</div>
		<section class="main">
			<div class="todo-list">
				{#each todos as { id }, i (id)}
					{#if filteredTodos.has(id)}
						<Todo bind:completed={todos[i].completed}
							bind:title={todos[i].title}
                            on:delete={deleteById.bind(null, id)}/>
					{/if}
				{/each}
			</div>
		</section>
		<footer class="footer">
			<span class="todo-count">
				{activeTodos.length}
				item{activeTodos.length === 1 ? "" : "s"} left
			</span>
			<button on:click={clearCompleted} class="clear-completed"
				class:show-clear-completed={activeTodos.length < todos.length}>
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
