import { get } from 'svelte/store';
import { Machine } from '$lib/machine/create.js';
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
	let newTodo = '';
	let todos = /** @type {ReturnType<todo>[]} */([]);
	let filter = /** @type {'all' | 'active' | 'completed'} */('all');
	let activeTodos = /** @type {ReturnType<todo>[]} */([]);
	let completedTodos = /** @type {ReturnType<todo>[]} */([]);
	let filteredTodos = /** @type {ReturnType<todo>[]} */([]);
	let markAllAs = /** @type {'active' | 'completed'} */('active');
	let allCompleted = false;
	return new Machine({
		config: {
			states: [
				['loading', {
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
				}],
				['ready', {}],
			],
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
		data() {
			return {
				newTodo,
				todos,
				filter,
				activeTodos,
				allCompleted,
				completedTodos,
				filteredTodos,
				markAllAs,
			};
		},
		ops: {
			/** @param {string} newValue */
			['$newTodo.update']: (newValue) => {
				newTodo = newValue;
			},
			['$newTodo.empty']: () => {
				newTodo = '';
			},
			['$todos.activateAll']() {
				todos.forEach((todo) => {
					todo.emit.SET_ACTIVE();
				});
			},
			['$todos.completeAll']() {
				todos.forEach((todo) => {
					todo.emit.SET_COMPLETED();
				});
			},
			['$todos.forceRerender']() {
				todos = [...todos];
			},
			['$todos.fromChildren']() {
				todos = [...this.children];
			},
			/** @param {'all' | 'active' | 'completed'} newFilter */
			['$filter.update']: (newFilter) => {
				console.log('filter.update', { newFilter });
				filter = newFilter;
			},
			['$activeTodos.update']() {
				activeTodos = todos
					.filter((todo) => !get(todo).data.completed);
			},
			['$completedTodos.update']() {
				completedTodos = todos
					.filter((todo) => get(todo).data.completed);
			},
			['$filteredTodos.update']() {
				switch (filter) {
					case 'active':
						filteredTodos = activeTodos;
						break;
					case 'completed':
						filteredTodos = completedTodos;
						break;
					default:
						filteredTodos = todos;
				}
			},
			['$allCompleted.update']() {
				allCompleted = todos.length > 0
					&& activeTodos.length === 0;
			},
			['$markAllAs.update']() {
				const allCompleted = todos.length > 0 && todos
					.filter((todo) => !get(todo).data.completed).length === 0;
				markAllAs = allCompleted ? "active" : "completed";
			}
		},
		actions: {
			/**
			 * @param {string} title
			 */
			addNew(title) {
				const newTodo = todo(createNewTodo(title.trim()));
				this.append(newTodo);
			},
			/**
			 * @param {{ remove: () => void; }} child
			 */
			delete(child) {
				child.remove();
			},
			clearCompleted() {
				todos.forEach((todo) => {
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
					const todosJson = JSON.stringify(todos.map((todo) => get(todo).data));
					localStorage.setItem(TODOS_STORE, todosJson);
				} catch (error) {
					console.error(error);
				}
			},
		},
		conditions: {
			/** @param {string} value */
			notEmpty(value) {
				return Boolean(value.trim().length);
			}
		},
	});
}

