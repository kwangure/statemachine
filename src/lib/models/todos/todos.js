import { derived, get, writable } from 'svelte/store';
import { todo } from "./todo";
import { uid } from 'uid';

const TODOS_STORE = 'todos';
/**
 * @param {string} title
 */
function createNewTodo(title) {
	return {
		completed: false,
		id: uid(),
		title,
	}
}

/**
 * @param {string} key
 * @param {string} defaultValue
 */
function getLocalStorageItem(key, defaultValue) {
	if (typeof window === 'undefined')
		return defaultValue;
	return localStorage.getItem(key) ?? defaultValue;
}

export function todos() {
    const state = writable("ready");
    const newTodo = writable("");
	const todosJson = /** @type {ReturnType<createNewTodo>[]} */ (
		JSON.parse(getLocalStorageItem(TODOS_STORE, '[]'))
	).map((todoJson) => todo(todoJson));
    const todos = writable(todosJson);
    const filter = writable('all');

	function persist() {
		const $todos = get(todos);
		try {
			const todosJson = JSON.stringify($todos.map((todo) => get(todo).data));
			localStorage.setItem(TODOS_STORE, todosJson);
		} catch (error) {
			console.error(error);
		}
	}

	const merged = derived(
        [filter, newTodo, state, todos],
        ([$filter, $newTodo, $state, $todos]) => {
			const activeTodos = $todos.filter((todo) => !get(todo).data.completed);
			const completedTodos = $todos.filter((todo) => get(todo).data.completed);
			const filteredTodos = ($filter === "active")
				? activeTodos
				: ($filter === "completed")
					? completedTodos
					: $todos;
			const activeTodoCount = activeTodos.length;
			const allCompleted = $todos.length > 0 && activeTodoCount === 0;
			const markAllAs = allCompleted ? "active" : "completed";
            return {
                state: $state,
                data: {
					activeTodos,
					allCompleted,
					completedTodos,
					filter: $filter,
					filteredTodos,
					markAllAs,
                    newTodo: $newTodo,
                    todos: $todos,
                },
            };
        });

    const { subscribe } = merged;

    return {
        subscribe,
		/**
		 * @param {string} value
		 */
		["NEWTODO.CHANGE"](value) {
			newTodo.set(value);
		},
		/**
		 * @param {string} value
		 */
		["NEWTODO.COMMIT"](value) {
			if (!value.trim().length) return;
			newTodo.set("");
			todos.update(($todos) => {
				$todos.push(todo(createNewTodo(value.trim())))
				return $todos;
			});
			persist();
		},
		["TODO.COMMIT"]() {
			// fake update to update subscribers
			todos.update((todo) => todo);
			persist();
		},
		/**
		 * @param {ReturnType<import('$lib/models/todos/todo').todo>} deleted
		 */
		["TODO.DELETE"](deleted) {
			todos.update(($todos) => {
				return $todos.filter((todo) =>{
					return todo !== deleted;
				});
			});
			persist();
		},
		/**
		 * @param {string} type
		 */
		["SHOW"](type) {
			filter.set(type);
		},
		["MARK.ACTIVE"]() {
			const $todos = get(todos);
			$todos.forEach((todo) => todo.SET_ACTIVE())
		},
		["MARK.COMPLETED"]() {
			const $todos = get(todos);
			$todos.forEach((todo) => todo.SET_COMPLETED())
		},
		CLEAR_COMPLETED() {
			todos.update(($todos) => {
				return $todos
					.filter((todo) => {
						const $todo = get(todo);
						if ($todo.data.completed) todo.destroy();
						return !$todo.data.completed;
					});
			});
		}
    }
}

