import { get } from 'svelte/store';
import { Machine } from '$lib/machine/create';
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
	return new Machine({
		initial: 'loading',
		config: {
			states: {
				loading: {
					entry: [{
						transitionTo: 'ready',
						actions: [
							'$todos.load',
							'$activeTodos.update',
							'$completedTodos.update',
							'$filteredTodos.update',
							'$allCompleted.update',
							'$markAllAs.update',
						],
					}],
				},
				ready: {},
			},
			on: {
				'CLEAR_COMPLETED': [{
					actions: [
						'$todos.clearCompleted',
						'$activeTodos.update',
						'$completedTodos.update',
						'$filteredTodos.update',
						'$allCompleted.update',
						'$markAllAs.update',
					],
				}],
				'MARK.ACTIVE': [{
					actions: [
						'$todos.activateAll',
						'$activeTodos.update',
						'$completedTodos.update',
						'$filteredTodos.update',
						'$allCompleted.update',
						'$markAllAs.update',
					],
				}],
				'MARK.COMPLETED': [{
					actions: [
						'$todos.completeAll',
						'$activeTodos.update',
						'$completedTodos.update',
						'$filteredTodos.update',
						'$allCompleted.update',
						'$markAllAs.update',
					],
				}],
				'NEWTODO.CHANGE': [{
					actions: ['$newTodo.update']
				}],
				'NEWTODO.COMMIT': [{
					actions: [
						'$newTodo.empty',
						'$todos.addNew',
						'$activeTodos.update',
						'$completedTodos.update',
						'$filteredTodos.update',
						'$allCompleted.update',
						'$markAllAs.update',
						'persist',
					],
					condition: 'notEmpty',
				}],
				'SHOW': [{
					actions: [
						'$filter.update',
						'$filteredTodos.update',
					],
				}],
				'TODO.COMMIT': [{
					actions: [
						'$todos.forceRerender',
						'$activeTodos.update',
						'$completedTodos.update',
						'$filteredTodos.update',
						'$allCompleted.update',
						'$markAllAs.update',
						'persist'],
				}],
				'TODO.DELETE': [{
					actions: [
						'$todos.delete',
						'$activeTodos.update',
						'$completedTodos.update',
						'$filteredTodos.update',
						'$allCompleted.update',
						'$markAllAs.update',
						'persist'],
				}],
			}
		},
		data: {
			newTodo: '',
			todos: /** @type {ReturnType<todo>[]} */([]),
			filter: /** @type {'all' | 'active' | 'completed'} */('all'),
			activeTodos: /** @type {ReturnType<todo>[]} */([]),
			completedTodos: /** @type {ReturnType<todo>[]} */([]),
			filteredTodos: /** @type {ReturnType<todo>[]} */([]),
			markAllAs: /** @type {'active' | 'completed'} */('active'),
			allCompleted: false,
		},
		ops: {
			newTodo: {
				update: (newValue) => newValue,
				empty: () => '',
			},
			todos: {
				activateAll() {
					return this.data.todos.map((todo) => {
						todo.emit.SET_ACTIVE();
						return todo;
					});
				},
				clearCompleted() {
					return this.data.todos.filter((todo) => {
						const $todo = get(todo);
						if ($todo.data.completed) todo.destroy();
						return !$todo.data.completed;
					});
				},
				completeAll() {
					return this.data.todos.map((todo) => {
						todo.emit.SET_COMPLETED();
						return todo;
					});
				},
				addNew(title) {
					const newTodo = todo(createNewTodo(title.trim()));
					return [...this.data.todos, newTodo];
				},
				delete(deleted) {
					return this.data.todos.filter((todo) => {
						return todo !== deleted;
					});
				},
				forceRerender() {
					return [...this.data.todos];
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
				update: (newFilter) => newFilter,
			},
			activeTodos: {
				update() {
					return this.data.todos
						.filter((todo) => !get(todo).data.completed);
				},
			},
			completedTodos: {
				update() {
					return this.data.todos
						.filter((todo) => get(todo).data.completed);
				}
			},
			filteredTodos: {
				update() {
					switch (this.data.filter) {
						case 'active':
							return this.data.activeTodos;
						case 'completed':
							return this.data.completedTodos;
						default:
							return this.data.todos;
					}
				}
			},
			allCompleted: {
				update() {
					return this.data.todos.length > 0
						&& this.data.activeTodos.length === 0;
				},
			},
			markAllAs: {
				update() {
					const allCompleted = this.data.todos.length > 0 && this.data.todos
						.filter((todo) => !get(todo).data.completed).length === 0;
					return allCompleted ? "active" : "completed";
				}
			},
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

