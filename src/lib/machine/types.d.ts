import type { Exact } from 'type-fest';
import type { Readable, Subscriber } from 'svelte/store'

export interface Actions {
	[x: string]: (...args: any) => any;
}

export interface Conditions {
	[x: string]: (...args: any) => boolean;
}

export interface Data<T = any> {
	[x: string] : Thing<T>
}

export interface Thing<T> {
	ops: {
		[x: string]: (...args: any) => void;
	},
	store: Readable<T>;
}

interface LooseHandler {
	actions?: string[],
	transitionTo?: string,
	condition?: string,
}

export type Handler = {
	[K in keyof LooseHandler]: K extends keyof LooseHandler ? LooseHandler[K] : never
}

export interface States {
	states: {
		[k: string]: Transitions & {
			always?: Handler[],
			entry?: Handler,
			exit?: Handler,
		},
	}
}

export interface Transitions {
	on?: {
		[k: string]: Handler[],
	}
};

export type Machine = States & Transitions;

export type UnionToIntersection<U> =
	(U extends any ? (k: U)=>void : never) extends ((k: infer I)=>void) ? I : never
