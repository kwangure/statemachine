import { createMachine } from '$lib/machine/create';
import { get } from 'svelte/store';
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
	return createMachine({
		initial: 'loading',
		machine: {
			states: {
				loading: {
					entry: [{
						transitionTo: 'ready',
						actions: ['$todos.load'],
					}],
				},
				ready: {},
			},
			on: {
				'CLEAR_COMPLETED': [{
					actions: ['$todos.clearCompleted'],
				}],
				'MARK.ACTIVE': [{
					actions: ['$todos.activateAll'],
				}],
				'MARK.COMPLETED': [{
					actions: ['$todos.completeAll'],
				}],
				'NEWTODO.CHANGE': [{
					actions: ['$newTodo.update']
				}],
				'NEWTODO.COMMIT': [{
					actions: ['$newTodo.empty', '$todos.addNew', 'persist'],
					condition: 'notEmpty',
				}],
				'SHOW': [{
					actions: ['$filter.update'],
				}],
				'TODO.COMMIT': [{
					actions: ['$todos.forceRerender', 'persist'],
				}],
				'TODO.DELETE': [{
					actions: ['$todos.delete', 'persist'],
				}],
			}
		},
		data: {
			newTodo: '',
			todos: /** @type {ReturnType<todo>[]} */([]),
			filter: /** @type {'all' | 'active' | 'completed'} */('all'),
		},
		ops: {
			newTodo: {
				update: (_, newValue) => newValue,
				empty: () => '',
			},
			todos: {
				activateAll($todos) {
					return $todos.map((todo) => {
						todo.SET_ACTIVE();
						return todo;
					});
				},
				clearCompleted($todos) {
					return $todos.filter((todo) => {
						const $todo = get(todo);
						if ($todo.data.completed) todo.destroy();
						return !$todo.data.completed;
					});
				},
				completeAll($todos) {
					return $todos.map((todo) => {
						todo.SET_COMPLETED();
						return todo;
					});
				},
				addNew($todos, title) {
					const newTodo = todo(createNewTodo(title.trim()));
					return [...$todos, newTodo];
				},
				delete($todos, deleted) {
					return $todos.filter((todo) =>{
						return todo !== deleted;
					});;
				},
				forceRerender($todos) {
					return [...$todos];
				},
				load() {
					// TODO: Add loading state to parse JSON
					const todosJson = /** @type {ReturnType<createNewTodo>[]} */ (
						JSON.parse(getLocalStorageItem(TODOS_STORE, '[]'))
					).map((todoJson) => todo(todoJson));

					return todosJson;
				}
			},
			filter: {
				update: (_, newFilter) => newFilter,
			},
		},
		computed: {
			activeTodos() {
				return this.data.todos
					.filter((todo) => !get(todo).data.completed);
			},
			allCompleted() {
				return this.data.todos.length > 0 && this.data.todos
					.filter((todo) => !get(todo).data.completed).length === 0;
			},
			completedTodos() {
				return this.data.todos
					.filter((todo) => get(todo).data.completed);
			},
			filteredTodos() {
				switch (this.data.filter) {
					case 'active':
						return this.data.todos
							.filter((todo) => !get(todo).data.completed);
					case 'completed':
						return this.data.todos
							.filter((todo) => get(todo).data.completed);
					default:
						return this.data.todos;
				}
			},
			markAllAs() {
				const allCompleted = this.data.todos.length > 0 && this.data.todos
					.filter((todo) => !get(todo).data.completed).length === 0;
				return allCompleted ? "active" : "completed";
			}
		},
		actions: {
			persist() {
				try {
					const todosJson = JSON.stringify(this.data.todos.map((todo) => get(todo).data));
					localStorage.setItem(TODOS_STORE, todosJson);
				} catch (error) {
					console.error(error);
				}
			},
		},
		conditions: {
			notEmpty: (value) => Boolean(value.trim().length),
		},
	});
}

