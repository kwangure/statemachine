import type { Actions, Conditions, Data, Machine, Store, Thing, Transitions } from './types';
import { get } from 'svelte/store';
import type { SetRequired, UnionToIntersection } from 'type-fest';

const dataOpRE = /^\$(\w+)\.(\w+)$/;

export function createMachine<M extends Machine, S extends Store, D extends Data>(options: {
	actions: Actions,
	data: D,
	conditions: Conditions,
	machine: M,
	state: Thing<string>,
	store: S
}) {
	const { actions, conditions, data, machine, state, store } = options;

	type MightHaveEventHandlers = M | M['states'][keyof M['states']];
	type HaveEventHandlers = Extract<MightHaveEventHandlers, SetRequired<Transitions, 'on'>>;
	type EventHandlers = HaveEventHandlers['on'];

	const scope = {
		data: Object.create(null),
	};
	for (const value in data) {
		if (Object.hasOwn(data, value)) {
			Object.defineProperty(scope.data, value, {
				get() {
					return get(data[value].store);
				},
			});
		}
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
							if (!Object.hasOwn(data, value)) {
								throw Error(`Attempted run to unknown action '${action}'. No data store named '${value}' was provided.`);
							}
							if (!Object.hasOwn(data[value].ops, op)) {
								throw Error(`Attempted run to unknown action '${action}'. Data store '${value}' has no function '${op}'.`);
							}
							data[value].ops[op].call(scope, ...args);
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
	})) as S & {
		[key in keyof UnionToIntersection<EventHandlers>]: (...args: any) => any
	};
}