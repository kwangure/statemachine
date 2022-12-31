import { derived, get, type Readable } from 'svelte/store';
import type { Machine, Transitions } from './types';
import type { SetRequired, UnionToIntersection } from 'type-fest';
import { thing } from '$lib/thing/thing';

const dataOpRE = /^\$(\w+)\.(\w+)$/;

export function createMachine<
	M extends Machine,
	D extends { [key: string]: any },
	This extends {
		data: { [key in keyof D]: D[key]}
		sendParent: (event: string, value?: any) => void;
	}>(options: {
	actions: {
		[x: string]: (this: This, ...args: any) => any;
	},
	data: D,
	conditions: {
		[x: string]: (this: This, ...args: any) => boolean;
	},
	machine: M,
	initial?: string,
	ops: {
		[k in keyof D]: {
			[x: string]: (this: This, value: D[k], ...args: any) => D[k]
		}
	},
}) {
	const { actions, conditions, data, initial, machine, ops } = options;

	const states = Object.keys(machine.states);
	const setters = Object
		.fromEntries(states.map((state) => [state, () => state]))
	const state  = thing(initial || states[0], setters);

	type MightHaveEventHandlers = M | M['states'][keyof M['states']];
	type HaveEventHandlers = Extract<MightHaveEventHandlers, SetRequired<Transitions, 'on'>>;
	type EventHandlers = HaveEventHandlers['on'];

	let sendParent: (event: string, value?: any) => void;
	const scope = {
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
	} as This;

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
		Object.defineProperty(scope.data, key, {
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
			const data = Object.fromEntries(entries);

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
					// check for machine-level listener if machine[state] doesn't exist
					...machine.on,
					...machine.states[$state].on,
				};
				const handlers = [
					...(listeners[prop] ?? []),
					...(machine.states[$state].always || []),
				];


				for (const { actions: transitionActions, condition, transitionTo } of handlers) {
					if (condition) {
						const isSatisfied = conditions[condition].call(scope, ...args);
						if (!isSatisfied) continue;
					}

					const actionQueue: string[] = [];

					if (transitionTo) {
						const currentState = get(state.store);
						actionQueue.push(...machine.states[currentState].exit?.actions || []);
						actionQueue.push(...transitionActions || []);
						actionQueue.push(...machine.states[transitionTo].entry?.actions || []);
						if (!Object.hasOwn(state.ops, transitionTo)) {
							throw Error(`Attempted transition from '${get(state.store)}' to unknown state '${transitionTo}'`);
						}
						state.ops[transitionTo].call(scope);
					} else {
						actionQueue.push(...transitionActions || []);
					}

					for (const action of actionQueue) {
						const match = dataOpRE.exec(action);
						if (match) {
							const [_, value, op] =  match;
							console.log({ value, op, thingOps, thingStores })
							if (!Object.hasOwn(thingOps, value)) {
								throw Error(`Attempted run to unknown action '${action}'. No data store named '${value}' was provided.`);
							}
							if (!Object.hasOwn(thingOps[value], op)) {
								throw Error(`Attempted run to unknown action '${action}'. Data store '${value}' has no function '${op}'.`);
							}
							thingOps[value][op].call(scope, ...args);
						} else if (Object.hasOwn(actions, action)) {
							actions[action].call(scope, ...args);
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