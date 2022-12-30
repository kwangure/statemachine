import type { Subscriber } from 'svelte/store'

export interface Actions {
	[x: string]: (...args: any) => any;
}

export interface Conditions {
	[x: string]: (...args: any) => boolean;
}

export interface States {
	states: {
		[k: string]: Transitions & {
			entry?: {
				actions: string[],
			},
			exit?: {
				actions: string[],
			}
		},
	}
}

export interface Transitions {
	on?: {
		[k: string]: {
			actions?: string[],
			transitionTo?: string,
			condition?: string,
		}[],
	}
};

export type Machine = States & Transitions;

export interface Store {
	createParentSender?: (fn : (event: string, value?: any) => void) => void;
	subscribe: Subscriber,
	destroy: (...args: any) => any;
}

export type UnionToIntersection<U> =
	(U extends any ? (k: U)=>void : never) extends ((k: infer I)=>void) ? I : never
