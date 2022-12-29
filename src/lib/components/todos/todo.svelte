<script>
    import { createEventDispatcher } from 'svelte';

	/** @type {ReturnType<import('$lib/models/todos').todo>} */
	export let todo;

	const dispatch = createEventDispatcher();
	todo.createParentSender((event, value) => {
		dispatch(event, value);
	});

	/** @type {import('svelte/action').Action<HTMLInputElement>} */
	function focus(node, state) {

		/**
         * @param {string} state
         */
		function update(state){
			if (state === 'editing') node.focus();
		}

		update(state)

		return { update };
	}
</script>

<li class:editing={$todo.state === "editing"}
	class:completed={$todo.data.completed}
	data-todo-state={$todo.data.completed ? "completed" : "active"}>
    <div class="view">
		<input id={$todo.data.id} class="toggle" type="checkbox" on:change={todo.TOGGLE_COMPLETE} checked={$todo.data.completed}/>
        <label for={$todo.data.id} on:dblclick={todo.EDIT}>
			{$todo.data.title}
		</label>
        <button class="destroy" on:click={todo.DELETE} />
    </div>
    <input class="edit" value={$todo.data.title} use:focus={$todo.state}
		on:blur={todo.BLUR}
        on:input={(/** @type {Event & {
			currentTarget: EventTarget & HTMLInputElement;
		}}*/ event) => todo.CHANGE(event.currentTarget.value)}
        on:keypress={(/** @type {KeyboardEvent} */ event) => (event.key === "Enter") ? todo.COMMIT() : void 0}
        on:keydown={(/** @type {KeyboardEvent} */ event) => event.key === "Escape" ? todo.CANCEL() : void 0}
    />
</li>
