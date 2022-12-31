import { derived, get, type Readable } from 'svelte/store';
import type { Machine, Transitions } from './types';
import type { SetRequired, UnionToIntersection } from 'type-fest';
import { thing } from '$lib/thing/thing';

const dataOpRE = /^\$(\w+)\.(\w+)$/;

/**
 *
 * ```javascript
 * type Ops = {
 * 		completed: {
 * 			toggle: (value: boolean) => boolean;
 * 		};
 * 		count: {
 * 			increment: (value: number) => number;
 * 		};
 * 	}
 *  Depth2Path<Ops, keyof Ops> === "$completed.toggle" | "$count.increment"`
 * ```
 */
type Depth2Path<T, U extends keyof T> = U extends string
	? keyof T[U] extends string
		? `$${U}.${keyof T[U]}`
		: never
	: never;

export function createMachine<
	ActionList extends Depth2Path<O, keyof O> | keyof A,
	M extends Machine<ActionList>,
	D extends { [key: string]: any },
	ActionScope extends {
		data: { [key in keyof D]: D[key]};
		sendParent: (event: string, value?: any) => void;
	},
	ComputedScope extends {
		data: { [key in keyof D]: D[key]};
	},
	A extends {
		[x: string]: (this: ActionScope, ...args: any) => any;
	},
	C extends {
		[x: string]: (this: ComputedScope, ...args: any) => any;
	},
	O extends {
		[k in keyof D]: {
			[x: string]: (this: ActionScope, value: D[k], ...args: any) => D[k]
		}
	}>(options: {
	actions?: A,
	data?: D,
	conditions?: {
		[x: string]: (this: ActionScope, ...args: any) => boolean;
	},
	computed?: C,
	machine: M,
	initial?: keyof M['states'],
	ops?: O,
}) {
	const nullo = () => Object.create(null);
	const { actions, computed, conditions, data = nullo(), initial, machine, ops = nullo()  } = options;

	const states = Object.keys(machine.states);
	const setters = Object
		.fromEntries(states.map((state) => [state, () => state]))
	const state  = thing(initial as string || states[0], setters);

	type MightHaveEventHandlers = M | M['states'][keyof M['states']];
	type HaveEventHandlers = Extract<MightHaveEventHandlers, SetRequired<Transitions<string>, 'on'>>;
	type EventHandlers = HaveEventHandlers['on'];

	let sendParent: (event: string, value?: any) => void;
	const actionScope = {
		data: Object.create(null),
		sendParent(event: string, value: any) {
			if (!sendParent) {
				throw Error([
					'Attempted to call \'sendParent\' before assigning a parent sender.',
					'Usage:',
					'    store.createParentSender((event, value) => {',
					'        dispatch(event, value);',
					'    });',
				].join('\n'));
			}
			sendParent(event, value);
		},
	} as ActionScope;

	const thingOps: { [x: string]: {
        [x: string]: (...args: any) => void;
    }} = Object.create(null);
	const thingNames: string[] = [];
	const thingStores: Readable<any>[] = [];
	for (const [key, value] of Object.entries(data)) {
		const { ops: ops2, store } = thing(value, ops[key]);
		thingOps[key] = ops2;
		thingNames.push(key);
		thingStores.push(store);
		Object.defineProperty(actionScope.data, key, {
			get() {
				return get(store);
			},
		});
	}

	const merged = derived([state.store, ...thingStores],
        ([$state, ...$things]) => {
			const entries = $things.map(($thing, i) => {
				return [thingNames[i], $thing];
			});
			const data: D & {
				[key in keyof C]: ReturnType<C[key]>;
			} = Object.fromEntries(entries);

			if (computed) {
				const computedEntries = Object
					.entries(computed)
					.map(([funcName, func]) => {
						return [funcName, { get: () => func.call({ data } as ComputedScope) }]
					});
				Object.defineProperties(data, Object.fromEntries(computedEntries));
			}

            return { data, state: $state };
        });

	const store = {
		createParentSender: (fn: (event: string, value?: any) => void) => {
			if (typeof fn === 'function') sendParent = fn;
		},
		destroy: () => {},
		subscribe: merged.subscribe,
	}

	return (new Proxy(store, {
		get(target, prop, receiver) {
			if (Object.hasOwn(target, prop)) {
				return Reflect.get(target, prop, receiver);
			}
			const isEventListener = typeof prop === 'string'
				&& prop.toUpperCase() === prop;

			if (!isEventListener) return;

			return function (...args: any) {
				const $state = get(state.store);
				const listeners = {
					// check for machine-level listener if machine.states[$state] doesn't exist
					...machine.on,
					...machine.states[$state].on,
				};
				const handlers = [
					...(listeners[prop] ?? []),
					...(machine.states[$state].always || []),
				];


				for (const { actions: transitionActions, condition, transitionTo } of handlers) {
					if (conditions && condition) {
						const isSatisfied = conditions[condition].call(actionScope, ...args);
						if (!isSatisfied) continue;
					}

					const actionQueue: ActionList[] = [];

					if (transitionTo) {
						const currentState = get(state.store);
						actionQueue.push(...machine.states[currentState].exit?.actions || []);
						actionQueue.push(...transitionActions || []);
						actionQueue.push(...machine.states[transitionTo].entry?.actions || []);
						if (!Object.hasOwn(state.ops, transitionTo)) {
							throw Error(`Attempted transition from '${get(state.store)}' to unknown state '${transitionTo}'`);
						}
						state.ops[transitionTo].call(actionScope);
					} else {
						actionQueue.push(...transitionActions || []);
					}

					for (const action of actionQueue as string[]) {
						const match = dataOpRE.exec(action);
						if (match) {
							const [_, value, op] =  match;
							if (!Object.hasOwn(thingOps, value)) {
								throw Error(`Attempted run to unknown action '${action}'. No data store named '${value}' was provided.`);
							}
							if (!Object.hasOwn(thingOps[value], op)) {
								throw Error(`Attempted run to unknown action '${action}'. Data store '${value}' has no function '${op}'.`);
							}
							thingOps[value][op].call(actionScope, ...args);
						} else if (actions && Object.hasOwn(actions, action)) {
							actions[action].call(actionScope, ...args);
						} else {
							throw Error(`Attempted run to unknown action '${action}'`);
						}
					}

					// Do not execute actions/transitions that follow a successful transition
					if (transitionTo) break;
				}
			}
		},
	})) as typeof store & {
		[key in keyof UnionToIntersection<EventHandlers>]: (...args: any) => any
	};
}