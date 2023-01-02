<script>
    import { createEventDispatcher } from 'svelte';

	/** @type {ReturnType<import('$lib/models/todos').todo>} */
	export let todo;


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
		<input id={$todo.data.id} class="toggle" type="checkbox" on:change={todo.emit.TOGGLE_COMPLETE} checked={$todo.data.completed}/>
        <div class='label' on:dblclick={todo.emit.EDIT}>
			{$todo.data.title}
		</div>
        <button class="destroy" on:click={todo.emit.DELETE} />
    </div>
    <input class="edit" value={$todo.data.title} use:focus={$todo.state}
		on:blur={todo.emit.BLUR}
        on:input={(/** @type {Event & {
			currentTarget: EventTarget & HTMLInputElement;
		}}*/ event) => todo.emit.CHANGE(event.currentTarget.value)}
        on:keypress={(/** @type {KeyboardEvent} */ event) => (event.key === "Enter") ? todo.emit.COMMIT() : void 0}
        on:keydown={(/** @type {KeyboardEvent} */ event) => event.key === "Escape" ? todo.emit.CANCEL() : void 0}
    />
</li>
