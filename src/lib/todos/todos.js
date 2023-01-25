import { get } from 'svelte/store';
import { Machine } from '$lib/machine/create';
import { todo } from "./todo.js";
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
							'load',
							'$todos.fromChildren',
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
						'clearCompleted',
						'$todos.fromChildren',
						'$activeTodos.update',
						'$completedTodos.update',
						'$filteredTodos.update',
						'$allCompleted.update',
						'$markAllAs.update',
						'persist',
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
						'persist',
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
						'persist',
					],
				}],
				'NEWTODO.CHANGE': [{
					actions: ['$newTodo.update']
				}],
				'NEWTODO.COMMIT': [{
					actions: [
						'$newTodo.empty',
						'addNew',
						'$todos.fromChildren',
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
						'delete',
						'$todos.fromChildren',
						'$activeTodos.update',
						'$completedTodos.update',
						'$filteredTodos.update',
						'$allCompleted.update',
						'$markAllAs.update',
						'persist',
					],
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
				completeAll() {
					return this.data.todos.map((todo) => {
						todo.emit.SET_COMPLETED();
						return todo;
					});
				},
				forceRerender() {
					return [...this.data.todos];
				},
				fromChildren() {
					return [...this.children];
				},
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
			addNew(title) {
				const newTodo = todo(createNewTodo(title.trim()));
				this.append(newTodo);
			},
			delete(child) {
				child.remove();
			},
			clearCompleted() {
				return this.data.todos.forEach((todo) => {
					if (todo.data.completed) {
						todo.remove();
					}
				});
			},
			load() {
				const todosJson = /** @type {ReturnType<createNewTodo>[]} */ (
					JSON.parse(getLocalStorageItem(TODOS_STORE, '[]'))
				);
				const todoMachines = todosJson
					.map((todoJson) => todo(todoJson));

				this.append(...todoMachines);
			},
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

