import { get, type Writable } from 'svelte/store';
import type { Actions, Conditions, Machine, Store, UnionToIntersection } from './types';

export function createMachine<M extends Machine, S extends Store>(options: {
	actions: Actions,
	conditions: Conditions,
	machine: M,
	state: Writable<string>,
	store: S
}) {
	const { actions, conditions, machine, state, store } = options;

	return (new Proxy(store, {
		get(target, prop, receiver) {
			if (Object.hasOwn(target, prop)) {
				return Reflect.get(target, prop, receiver);
			}
			const isEventListener = typeof prop === 'string'
				&& prop.toUpperCase() === prop;

			if (!isEventListener) return;

			return function (...args: any) {
				const $state = get(state);
				const transitions = Object.hasOwn(machine.states[$state].on, prop)
					? machine.states[$state].on[prop]
					: machine.on[prop] || [];

				for (const { actions: transitionActions, condition, transitionTo } of transitions) {
					if (condition) {
						const isSatisfied = conditions[/** @type {keyof conditions} */(condition)]();
						if (!isSatisfied) break;
					}
					/** @type {string[]} */
					const actionQueue = [];

					if (transitionTo) {
						const currentState = get(state);
						actionQueue.push(...machine.states[currentState].exit?.actions || []);
						actionQueue.push(...transitionActions || []);
						actionQueue.push(...machine.states[transitionTo].entry?.actions || []);
						state.set(/** @type {"deleted" | "editing" | "reading"} */(transitionTo));
					} else {
						actionQueue.push(...transitionActions || []);
					}

					for (const action of actionQueue) {
						actions[action](...args);
					}
				}

			}
		},
	})) as S & {
		[key in keyof UnionToIntersection<M['on'] | M['states'][keyof M['states']]['on']>]: (...args: any) => any
	};
}