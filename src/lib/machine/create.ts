import { derived, get, writable, type Readable, type Subscriber } from 'svelte/store';
import type { Config, Handler } from './types';
import type { UnionToIntersection } from 'type-fest';
import { thing } from '$lib/thing/thing';

/**
	TODO:
	- Automatically bubble events to parents
	- Explore asynchronous actions/events
 */

const dataOpRE = /^\$([_$\w]+)\.(\w+)$/;

const STATE = '__$$state';
const TRANSITION_ACTIVE = '__$$transition_active';
const TRANSITION_FROM = '__$$transition_from';
const TRANSITION_TO = '__$$transition_to';

const SUBSCRIBERS = '__$$subscribers';

function isDefined<T>(argument: T | undefined): argument is T {
	return argument !== undefined
}

const nullo = () => Object.create(null);

export class Machine<
	ActionList extends keyof Actions,
	C extends Config<C, ActionList, keyof Conditions>,
	Data extends { [key: string]: ReturnType<typeof thing> },
	// Unfortunately we have to manually type `this` for non-static member
	// of the class. I don't think there's a way to pass it automatically?
	This extends {
		append: (...children: Machine<any, any, any, any, any, any>[]) => void;
		children: ReadonlyArray<Machine<any, any, any, any, any, any>>;
		parent: Readonly<Machine<any, any, any, any, any, any>>;
		data: { [key in keyof Data]: Data[key] };
		emit: {
			[
				key in keyof UnionToIntersection<
					Extract<C | C['states'][keyof C['states']], { on: any }>['on']
				>
			]: (...args: any) => any
		},
		removeChild<T>(child: T extends Machine<any, any, any, any, any, any> ? T : never): T;
		remove: () => void;
		state: keyof C['states'],
		transition: {
			active: boolean;
			to: keyof C["states"] | null;
			from: keyof C["states"] | null;
		};
	},
	Actions extends {
		[x: string]: (this: This, ...args: any) => any;
	},
	Conditions extends {
		[x: string]: (this: This, ...args: any) => boolean;
	},
> {
	#actions: Actions | undefined;
	#children = writable([] as Machine<any, any, any, any, any, any>[]);
	#conditions: Conditions | undefined;
	#config: C;
	#data: ReturnType<typeof derived<Readable<any>[], {
		children: Machine<any, any, any, any, any, any>[];
		data: Data ;
		state: keyof C["states"];
		transition: {
			active: boolean;
			to: keyof C["states"] | null;
			from: keyof C["states"] | null;
		};
	}>>
	#stores: any;
	#subscribers = new Set<Subscriber<this>>();

	emit: This['emit'];
	__parent: Machine<any, any, any, any, any, any> | null = null;

	constructor(options: {
		actions?: Actions,
		data: Data,
		conditions?: Conditions,
		config: C,
		initial?: keyof C['states'],
	}) {
		this.#actions = options.actions;
		this.#conditions = options.conditions;
		this.#config = options.config;

		const states = (Object.keys(this.#config.states) as (keyof C['states'])[])
		const stateSetters = states.map((state) => [state, () => state]);
		const state = thing(options.initial || states[0], Object.fromEntries(stateSetters));
		const transitionTo = thing(null, Object.fromEntries(stateSetters));
		const transitionFrom = thing(null, Object.fromEntries(stateSetters));
		const transitionActive = thing(false, { true: () => true, false: () => false });

		this.#stores = Object.assign({
			[STATE]: state,
			[TRANSITION_TO]: transitionTo,
			[TRANSITION_FROM]: transitionFrom,
			[TRANSITION_ACTIVE]: transitionActive,
			[SUBSCRIBERS]: {
				call: this.#callSubscribers,
			},
		}, options.data);

		const thingNames: string[] = [...Object.keys(options.data)];
		const thingStores: Readable<any>[] = [
			state,
			transitionTo,
			transitionFrom,
			transitionActive,
			this.#children,
			...Object.values(options.data)
		];

		this.#data = derived(thingStores,
			(thingStoreValues) => {
				let $state: keyof C['states'];
				let $transitionTo: keyof C['states'] | null;
				let $transitionFrom: keyof C['states'] | null;
				let $transitionActive: boolean;
				let $children: Machine<any, any, any, any, any, any>[];
				let $things: any[];
				[$state, $transitionTo, $transitionFrom, $transitionActive, $children, ...$things] = thingStoreValues;
				const entries = $things.map(($thing, i) => {
					return [thingNames[i], $thing];
				});
				const data: Data = Object.fromEntries(entries);

				return {
					children: $children,
					data,
					state: $state,
					transition: {
						active: $transitionActive,
						to: $transitionTo,
						from: $transitionFrom,
					},
				};
			});
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
	append(...children: Machine<any, any, any, any, any, any>[]) {
		for (const child of children) {
			child.__parent = this;
		}
		return this.#children
			.update(($children) => [...$children, ...children]);
	}
	#callSubscribers() {
		for (const subscriber of this.#subscribers) {
			subscriber(get(this));
		}
	}
	get children(): ReadonlyArray<Machine<any, any, any, any, any, any>> {
		return get(this.#data).children;
	}
	get data() {
		return get(this.#data).data;
	}
	destroy() { }
	#executeHandlers(handlers: Handler<C, ActionList, keyof Conditions>[], ...args: any[]) {
		const CALL_SUBSCRIBERS_ACTION = { actions: [`$${SUBSCRIBERS}.call` as ActionList] };
		handlers.push(CALL_SUBSCRIBERS_ACTION);
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
					{ actions: [`$${TRANSITION_TO}.${String(transitionTo)}` as ActionList] },
					{ actions: [`$${TRANSITION_FROM}.${String(this.state)}` as ActionList] },
					{ actions: [`$${TRANSITION_ACTIVE}.true` as ActionList] },
					...this.#config.states[this.state].exit || [],
					{ actions: transitionActions },
					{ actions: [`$${STATE}.${String(transitionTo)}` as ActionList] },
					...this.#config.states[transitionTo].entry || [],
					...this.#config.states[transitionTo].always || [],
					{ actions: [`$${TRANSITION_ACTIVE}.false` as ActionList] },
					{ actions: [`$${SUBSCRIBERS}.call` as ActionList] },
					CALL_SUBSCRIBERS_ACTION,
				].filter(isDefined);
				continue;
			}

			for (const action of transitionActions as string[]) {
				const match = dataOpRE.exec(action);
				if (match) {
					const [_, value, op] = match;
					try {
						this.#stores[value][op].call(this as unknown as This, ...args);
					} catch (error) {
						// @ts-expect-error
						if (error.message.includes('undefined')) {
							throw Error(`Attempted to run unknown operation on value. Value: '${value}'; Operation: '${op}'`)
						} else {
							throw error;
						}
					}
				} else if (this.#actions && Object.hasOwn(this.#actions, action)) {
					this.#actions[action].call(this as unknown as This, ...args);
				} else {
					throw Error(`Attempted run to unknown action '${action}'`);
				}
			}
		}
	}
	get parent(): Readonly<Machine<any, any, any, any, any, any>> | null {
		return this.__parent;
	}
	remove() {
		this.__parent?.removeChild(this);
	}
	removeChild(child: Machine<any, any, any, any, any, any>) {
		this.#children
			.update(($children) => $children.filter(($child) => {
				const found = $child === child;
				if (found) child.__parent = null;
				return !found;
			}));
	}
	get state() {
		return get(this.#data).state;
	}
	subscribe(fn: Subscriber<this>) {
		this.#subscribers.add(fn)
		fn(this);
		return () => this.#subscribers.delete(fn);
	}
	get transition() {
		return get(this.#data).transition;
	}
}

