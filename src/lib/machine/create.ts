import { derived, get, type Readable } from 'svelte/store';
import type { Config, Handler } from './types';
import type { UnionToIntersection } from 'type-fest';
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

const STATE = '__$$state';

function isDefined<T>(argument: T | undefined): argument is T {
	return argument !== undefined
}

const nullo = () => Object.create(null);

export class Machine<
	ActionList extends Depth2Path<Ops, keyof Ops> | keyof Actions,
	C extends Config<C, ActionList, keyof Conditions>,
	Data extends { [key: string]: any },
	// Unfortunately we have to manually type `this` for non-static member
	// of the class. I don't think there's a way to pass it automatically?
	This extends {
		data: { [key in keyof Data]: Data[key] };
		emit: {
			[
				key in keyof UnionToIntersection<
					Extract<C | C['states'][keyof C['states']], { on: any }>['on']
				>
			]: (...args: any) => any
		},
		sendParent: (event: string, value?: any) => void;
		state: keyof C['states'],
	},
	Actions extends {
		[x: string]: (this: This, ...args: any) => any;
	},
	Computed extends {
		[x: string]: (this: This, ...args: any) => any;
	},
	Conditions extends {
		[x: string]: (this: This, ...args: any) => boolean;
	},
	Ops extends {
		[k in keyof Data]: {
			[x: string]: (this: This, ...args: any) => Data[k]
		}
	}> {
	#actions: Actions | undefined;
	#conditions: Conditions | undefined;
	#config: C;
	#data: ReturnType<typeof derived<Readable<any>[], {
		data: Data & { [key in keyof Computed]: ReturnType<Computed[key]>; };
		state: keyof C["states"];
	}>>
	#sendParent: ((event: string, value?: any) => void) | null = null;
	#thingOps: any;

	emit: This['emit'];

	constructor(options: {
		actions?: Actions,
		data?: Data,
		conditions?: Conditions,
		computed?: Computed,
		config: C,
		initial?: keyof C['states'],
		ops?: Ops,
	}) {
		this.#actions = options.actions;
		this.#conditions = options.conditions;
		this.#config = options.config;

		const states = (Object.keys(this.#config.states) as (keyof C['states'])[])
		const setters = Object
			.fromEntries(states.map((state) => [state, () => state]))
		const state = thing(options.initial || states[0], setters);

		this.#thingOps = Object.create({ [STATE]: state.ops });
		const thingNames: string[] = [];
		const thingStores: Readable<any>[] = [state.store];

		this.#data = derived(thingStores,
			(thingStoreValues) => {
				let $state: keyof C['states'];
				let $things: any[];
				[$state, ...$things] = thingStoreValues;
				const entries = $things.map(($thing, i) => {
					return [thingNames[i], $thing];
				});
				const data: Data & {
					[key in keyof Computed]: ReturnType<Computed[key]>;
				} = Object.fromEntries(entries);

				if (options.computed) {
					const computedEntries = Object
						.entries(options.computed)
						.map(([funcName, func]) => {
							return [funcName, { get: () => func.call(this as unknown as This) }]
						});
					Object.defineProperties(data, Object.fromEntries(computedEntries));
				}

				return { data, state: $state };
			});
		const ops = options.ops || nullo();
		for (const [key, value] of Object.entries(options.data || nullo())) {
			const { ops: ops2, store } = thing(value, ops[key]);
			this.#thingOps[key] = ops2;
			thingNames.push(key);
			thingStores.push(store);
		}
		const handlerStateProps = nullo();
		const handlerMap = nullo();
		const self = this;
		for (let i = 0; i < states.length; i++) {
			const listeners = {
				// check for machine-level listener if config.states[state] doesn't exist
				...this.#config.on,
				...this.#config.states[states[i]].on,
			};
			const listenerMap = nullo();
			for (const prop in listeners) {
				listenerMap[prop] = (...args: any) => {
					this.#executeHandlers([
						...(listeners[prop] ?? []),
						...(this.#config.states[states[i]].always || []),
					], ...args);
				}
				if (!Object.hasOwn(handlerMap, prop)) {
					handlerMap[prop] = function (...args: any) {
						handlerStateProps[self.state][prop]?.(...args);
					}
				}
			}
			handlerStateProps[states[i]] = listenerMap;
		};

		this.emit = handlerMap;
		this.#executeHandlers(this.#config.states[this.state].entry || [])
	}
	createParentSender(fn: (event: string, value?: any) => void) {
		this.#sendParent = fn;
	}
	get data() {
		return get(this.#data).data;
	}
	destroy() { }
	#executeHandlers(handlers: Handler<C, ActionList, keyof Conditions>[], ...args: any[]) {
		while (handlers.length) {
			const handler = handlers.shift() as Handler<C, ActionList, keyof Conditions>;
			if (this.#conditions && handler.condition) {
				const isSatisfied = this.#conditions[handler.condition].call(this as unknown as This, ...args);
				if (!isSatisfied) continue;
			}

			const transitionActions = handler.actions || [];
			const transitionTo = handler.transitionTo;

			if (transitionTo) {
				handlers = [
					...this.#config.states[this.state].exit || [],
					{ actions: transitionActions },
					{ actions: [`$${STATE}.${String(transitionTo)}` as ActionList] },
					...this.#config.states[transitionTo].entry || [],
					...this.#config.states[transitionTo].always || [],
				].filter(isDefined);
				continue;
			}

			for (const action of transitionActions as string[]) {
				const match = dataOpRE.exec(action);
				if (match) {
					const [_, value, op] = match;
					this.#thingOps[value][op].call(this as unknown as This, ...args);
				} else if (this.#actions && Object.hasOwn(this.#actions, action)) {
					this.#actions[action].call(this as unknown as This, ...args);
				} else {
					throw Error(`Attempted run to unknown action '${action}'`);
				}
			}
		}
	}
	sendParent(event: string, value: any) {
		if (!this.#sendParent) {
			throw Error([
				'Attempted to call \'sendParent\' before assigning a parent sender.',
				'Usage:',
				'    store.createParentSender((event, value) => {',
				'        dispatch(event, value);',
				'    });',
			].join('\n'));
		}
		this.#sendParent(event, value);
	}
	get state() {
		return get(this.#data).state;
	}
	get subscribe() {
		return this.#data.subscribe;
	}
}

