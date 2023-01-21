import { get } from 'svelte/store';

const dataOpRE = /^\$([_$\w]+)\.(\w+)$/;

const STATE = '__$$state';
const TRANSITION_ACTIVE = '__$$transition_active';
const TRANSITION_FROM = '__$$transition_from';
const TRANSITION_TO = '__$$transition_to';

const SUBSCRIBERS = '__$$subscribers';

/**
 * @typedef {{
 *     actions?: string[];
 *     condition?: string;
 * 	   transitionTo?: string;
 * }} Handler
 */

/**
 * @template T
 * @param {*} argument
 * @returns {argument is T}
 */
function isDefined(argument) {
	return argument !== undefined
}

const nullo = () => Object.create(null);

/**
 * @template T
 */
export class Machine {
	/** @type {Machine<any>[]} */
	#children = [];
	#data;
	#state;
	/**
	 * @type {{
	 * 		to: string | null,
	 *  	from: string | null,
	 *  	active: boolean,
	 * }}
	 * */
	#transition = {
		to: null,
		from: null,
		active: false,
	};
	#stores;
	#subscribers = new Set();

	/** @type {Machine<any> | null} */
	__parent = null;

	/**
	 * @param {{
	 *     actions: any;
	 *     conditions: any;
	 *     config: any;
	 *     data: () => T;
	 *     ops: any;
	 * }} options
	 */
	constructor(options) {
		this.actions = options.actions;
		this.conditions = options.conditions;
		this.config = options.config;
		this.#data = options.data;

		const states = Object.keys(this.config.states);
		this.#state = states[0];
		this.#stores = Object.assign(nullo(), options.ops, {
			[`$${TRANSITION_ACTIVE}.true`]: () => this.#transition.active = true,
			[`$${TRANSITION_ACTIVE}.false`]: () => this.#transition.active = false,
			[`$${SUBSCRIBERS}.call`]: this.#callSubscribers,
		});
		for (const state of states) {
			this.#stores[`$${STATE}.${String(state)}`] = () => this.#state = state;
			this.#stores[`$${TRANSITION_TO}.${String(state)}`] = () => this.#transition.to = state;
			this.#stores[`$${TRANSITION_FROM}.${String(state)}`] = () => this.#transition.from = state;
		}

		const handlerStateProps = nullo();
		const handlerMap = nullo();
		const self = this;
		for (let i = 0; i < states.length; i++) {
			const listeners = {
				// check for machine-level listener if config.states[state] doesn't exist
				...this.config.on,
				...this.config.states[states[i]].on,
			};
			const listenerMap = nullo();
			for (const prop in listeners) {
				listenerMap[prop] = (/** @type {any} */ ...args) => {
					this.#executeHandlers([
						...(listeners[prop] ?? []),
						...(this.config.states[states[i]].always || []),
					], ...args);
				}
				if (!Object.hasOwn(handlerMap, prop)) {
					handlerMap[prop] = function (/** @type {any} */ ...args) {
						handlerStateProps[self.state][prop]?.(...args);
					}
				}
			}
			handlerStateProps[states[i]] = listenerMap;
		};

		this.emit = handlerMap;
		this.#executeHandlers(this.config.states[this.state].entry || [])
	}
	/**
	 * @param {Machine<any>[]} children
	 */
	append(...children) {
		for (const child of children) {
			child.__parent = this;
		}
		return this.#children.push(...children);
	}
	#callSubscribers() {
		for (const subscriber of this.#subscribers) {
			subscriber(get(this));
		}
	}
	get children() {
		return this.#children;
	}
	/** @type {T} */
	get data() {
		return this.#data();
	}
	destroy() { }
	/**
	 * @param {Handler[]} handlers
	 * @param {any} args
	 */
	#executeHandlers(handlers, ...args) {
		const CALL_SUBSCRIBERS_ACTION = { actions: [`$${SUBSCRIBERS}.call`] };
		handlers.push(CALL_SUBSCRIBERS_ACTION);
		while (handlers.length) {
			const handler = handlers.shift();
			if (this.conditions && handler?.condition) {
				const isSatisfied = this.conditions[handler.condition].call(this, ...args);
				if (!isSatisfied) continue;
			}

			const transitionActions = handler?.actions || [];
			const transitionTo = handler?.transitionTo;

			if (transitionTo) {
				// @ts-ignore
				handlers = [
					{ actions: [`$${TRANSITION_TO}.${String(transitionTo)}`] },
					{ actions: [`$${TRANSITION_FROM}.${String(this.state)}`] },
					{ actions: [`$${TRANSITION_ACTIVE}.true`] },
					...this.config.states[this.state].exit || [],
					{ actions: transitionActions },
					{ actions: [`$${STATE}.${String(transitionTo)}`] },
					...this.config.states[transitionTo].entry || [],
					...this.config.states[transitionTo].always || [],
					{ actions: [`$${TRANSITION_ACTIVE}.false`] },
					{ actions: [`$${SUBSCRIBERS}.call`] },
					CALL_SUBSCRIBERS_ACTION,
				].filter(isDefined);
				continue;
			}

			for (const action of transitionActions) {
				const match = dataOpRE.exec(action);
				if (match) {
					try {
						this.#stores[action].call(this, ...args);
					} catch (error) {
						console.log({ stores: this.#stores });

						// @ts-expect-error
						if (error.message.includes('undefined')) {
							// @ts-expect-error
							error.message = `Attempted to run unknown action '${action}'. ${error.message}`;
						}
						throw error;
					}
				} else if (this.actions && Object.hasOwn(this.actions, action)) {
					this.actions[action].call(this, ...args);
				} else {
					throw Error(`Attempted run to unknown action '${action}'`);
				}
			}
		}
	}
	get parent() {
		return this.__parent;
	}
	remove() {
		this.__parent?.removeChild(this);
	}
	/**
	 * @param {Machine<any>} child
	 */
	removeChild(child) {
		this.#children = this.#children.filter(($child) => {
			const found = $child === child;
			if (found) child.__parent = null;
			return !found;
		});
	}
	get state() {
		return this.#state;
	}
	/**
	 * @param {(arg: this) => void} fn
	 */
	subscribe(fn) {
		this.#subscribers.add(fn)
		fn(this);
		return () => this.#subscribers.delete(fn);
	}
	get transition() {
		return structuredClone(this.#transition);
	}
}

