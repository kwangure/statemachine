<script>
	import Todo from './todo.svelte';

	/** @type {string} */
	export let filter;
	/** @type {ReturnType<import('$lib/models/todos').todos>} */
	export let todos;

	$: todos.SHOW(filter);
</script>

<section class="todoapp" data-state={$todos}>
	<header class="header">
	  	<h1>todos</h1>
	  	<!-- svelte-ignore a11y-autofocus -->
	  	<input class="new-todo" placeholder="What needs to be done?" autofocus
			on:keypress={(event) => (event.key === "Enter") ? todos["NEWTODO.COMMIT"](event.currentTarget.value) : void 0}
			on:input={(event) => todos["NEWTODO.CHANGE"](event.currentTarget.value)}
			value={$todos.data.newTodo}/>
	</header>
	<section class="main">
	  	<input id="toggle-all" class="toggle-all" type="checkbox" checked={$todos.data.allCompleted}
			on:change={(e) => ($todos.data.allCompleted ? todos[`MARK.ACTIVE`] : todos["MARK.COMPLETED"])()}/>
		<label for="toggle-all" title={`Mark all as ${$todos.data.markAllAs}`}>
			Mark all as {$todos.data.markAllAs}
		</label>
		<ul class="todo-list">
			{#each $todos.data.filteredTodos as todo}
				<Todo todo={todo}
					on:TODO.COMMIT={todos['TODO.COMMIT']}
					on:TODO.DELETE={() => todos['TODO.DELETE'](todo)}/>
			{/each}
		</ul>
	</section>
	<footer class="footer">
		<span class="todo-count">
		  	<strong>{$todos.data.activeTodos.length}</strong>
			item{$todos.data.activeTodos.length === 1 ? "" : "s"} left
		</span>
		<ul class="filters">
			<li>
				<a class:selected={$todos.data.filter === "all"} href="#/">
					All
				</a>
			</li>
			<li>
				<a class:selected={$todos.data.filter === "active"} href="#/active">
					Active
				</a>
			</li>
			<li>
				<a class:selected={$todos.data.filter === "completed"} href="#/completed">
					Completed
				</a>
			</li>
		</ul>
		{#if $todos.data.activeTodos.length < $todos.data.todos.length}
			<button on:click={todos.CLEAR_COMPLETED} class="clear-completed">
				Clear completed
			</button>
		{/if}
	</footer>
</section>