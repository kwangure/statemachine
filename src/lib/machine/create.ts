import { derived, get, type Readable } from 'svelte/store';
import type { Config, Handler, Transitions } from './types';
import type { SetRequired, UnionToIntersection } from 'type-fest';
import { thing } from '$lib/thing/thing';

/**
	TODO:
	- Replace `sendParent` w/ automatic bubbling
		- First add `children` & `parent` properties to machines, simplify `sendParent`
		- Then replace `sendParent` using these properties altogether
	- Explore asynchronous actions/events
 */

const dataOpRE = /^\$([_$\w]+)\.(\w+)$/;

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
type Depth2Path<T, U extends keyof T> = U extends string | number
	? keyof T[U] extends string | number
		? `$${U}.${keyof T[U]}`
		: never
	: never;

export function createMachine<
	ActionList extends Depth2Path<O, keyof O> | keyof A,
	C extends Config<C, ActionList, keyof Conditions>,
	D extends { [key: string]: any },
	ActionScope extends {
		data: { [key in keyof D]: D[key] };
		sendParent: (event: string, value?: any) => void;
		state: keyof C['states'],
	},
	ComputedScope extends {
		data: { [key in keyof D]: D[key] };
		state: keyof C['states'],
	},
	A extends {
		[x: string]: (this: ActionScope, ...args: any) => any;
	},
	Computed extends {
		[x: string]: (this: ComputedScope, ...args: any) => any;
	},
	Conditions extends {
		[x: string]: (this: ActionScope, ...args: any) => boolean;
	},
	O extends {
		[k in keyof D]: {
			[x: string]: (this: ActionScope, ...args: any) => D[k]
		}
	}>(options: {
		actions?: A,
		data?: D,
		conditions?: Conditions,
		computed?: Computed,
		config: C,
		initial?: keyof C['states'],
		ops?: O,
	}) {
	const nullo = () => Object.create(null);
	const { actions, computed, conditions, data = nullo(), initial, config, ops = nullo() } = options;

	const STATE = '__$$state';
	const states = Object.keys(config.states) as (keyof C['states'])[];
	const setters = Object
		.fromEntries(states.map((state) => [state, () => state]))
	const state = thing(initial || states[0], setters);

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
		get state() {
			return get(state.store);
		},
	} as ActionScope;

	const thingOps: {
		[x: string]: {
			[x: string]: (...args: any) => void;
		}
	} = Object.create(null);
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
	thingOps[STATE] = state.ops;

	const merged = derived([state.store, ...thingStores],
		([$state, ...$things]) => {
			const entries = $things.map(($thing, i) => {
				return [thingNames[i], $thing];
			});
			const data: D & {
				[key in keyof Computed]: ReturnType<Computed[key]>;
			} = Object.fromEntries(entries);

			if (computed) {
				const computedEntries = Object
					.entries(computed)
					.map(([funcName, func]) => {
						return [funcName, { get: () => func.call({ data, state: $state } as ComputedScope) }]
					});
				Object.defineProperties(data, Object.fromEntries(computedEntries));
			}

			return { data, state: $state };
		});

	const $state = get(state.store);
	executeHandlers(config.states[$state].entry || []);

	function isDefined<T>(argument: T | undefined): argument is T {
		return argument !== undefined
	}
	function executeHandlers(handlers: Handler<C, ActionList, keyof Conditions>[], ...args: any[]) {
		while (handlers.length) {
			const handler = handlers.shift() as Handler<C, ActionList, keyof Conditions>;
			if (conditions && handler.condition) {
				const isSatisfied = conditions[handler.condition].call(actionScope, ...args);
				if (!isSatisfied) continue;
			}

			const transitionActions = handler.actions || [];
			const transitionTo = handler.transitionTo;

			if (transitionTo) {
				const currentState = get(state.store);
				handlers = [
					...config.states[currentState].exit || [],
					{ actions: transitionActions },
					{ actions: [`$${STATE}.${transitionTo as string}` as ActionList] },
					...config.states[transitionTo].entry || [],
					...config.states[transitionTo].always || [],
				].filter(isDefined);
				continue;
			}

			for (const action of transitionActions as string[]) {
				const match = dataOpRE.exec(action);
				if (match) {
					const [_, value, op] = match;
					thingOps[value][op].call(actionScope, ...args);
				} else if (actions && Object.hasOwn(actions, action)) {
					actions[action].call(actionScope, ...args);
				} else {
					throw Error(`Attempted run to unknown action '${action}'`);
				}
			}
		}
	}

	const handlerStateProps = nullo();
	const handlerMap = nullo();
	for (let i = 0; i < states.length; i++) {
		const listeners = {
			// check for machine-level listener if config.states[state] doesn't exist
			...config.on,
			...config.states[states[i]].on,
		};

		const listenerMap = nullo();
		for (const prop in listeners) {
			listenerMap[prop] = (...args: any) => {
				executeHandlers([
					...(listeners[prop] ?? []),
					...(config.states[states[i]].always || []),
				], ...args);
			}
			if (!Object.hasOwn(handlerMap, prop)) {
				handlerMap[prop] = function (...args: any) {
					const $state = get(state.store);
					handlerStateProps[$state][prop]?.(...args);
				}
			}
		}
		handlerStateProps[states[i]] = listenerMap;
	};

	type MightHaveEventHandlers = C | C['states'][keyof C['states']];
	type HaveEventHandlers = Extract<MightHaveEventHandlers, SetRequired<Transitions, 'on'>>;
	type EventHandlers = HaveEventHandlers['on'];

	class Machine {
		emit: {
			[key in keyof UnionToIntersection<EventHandlers>]: (...args: any) => any
		};
		constructor() {
			this.emit = handlerMap;
		}
		createParentSender(fn: (event: string, value?: any) => void) {
			sendParent = fn;
		}
		destroy() { }
		get subscribe() {
			return merged.subscribe;
		}
	}

	return new Machine();
}
