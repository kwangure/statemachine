<script>
	import './todo.css';
    import { page } from "$app/stores";
    import { Todos } from "$lib/todos";
    import { todos } from "$lib/todos";

	// https://codesandbox.io/s/xstate-todomvc-33wr94qv1
</script>

<Todos filter={$page.url.hash.slice(2) || 'all'} todos={todos()}/>
