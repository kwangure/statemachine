import type { Actions, Conditions, Machine, Store, Transitions } from './types';
import { get, type Writable } from 'svelte/store';
import type { SetRequired, UnionToIntersection } from 'type-fest';

export function createMachine<M extends Machine, S extends Store>(options: {
	actions: Actions,
	conditions: Conditions,
	machine: M,
	state: Writable<string>,
	store: S
}) {
	const { actions, conditions, machine, state, store } = options;

	type MightHaveEventHandlers = M | M['states'][keyof M['states']];
	type HaveEventHandlers = Extract<MightHaveEventHandlers, SetRequired<Transitions, 'on'>>;
	type EventHandlers = HaveEventHandlers['on'];

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
						const isSatisfied = conditions[condition](...args);
						if (!isSatisfied) continue;
					}

					const actionQueue: string[] = [];

					if (transitionTo) {
						const currentState = get(state);
						actionQueue.push(...machine.states[currentState].exit?.actions || []);
						actionQueue.push(...transitionActions || []);
						actionQueue.push(...machine.states[transitionTo].entry?.actions || []);
						if (!Object.hasOwn(machine.states, transitionTo)) {
							throw Error(`Attempted transition to unknown state '${transitionTo}'`);
						}
						state.set(transitionTo);
					} else {
						actionQueue.push(...transitionActions || []);
					}

					for (const action of actionQueue) {
						actions[action](...args);
					}

					// Do not execute actions/transitions that follow a successful transition
					if (transitionTo) break;
				}
			}
		},
	})) as S & {
		[key in keyof UnionToIntersection<EventHandlers>]: (...args: any) => any
	};
}