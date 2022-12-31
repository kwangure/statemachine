import type { Exact } from 'type-fest';
import type { Readable, Subscriber } from 'svelte/store'

export interface Thing<T> {
	ops: {
		[x: string]: (...args: any) => void;
	},
	store: Readable<T>;
}

export interface Handler<M extends Machine, A, C> {
	actions?: A[],
	transitionTo?: keyof M['states'],
	condition?: C,
}

export interface Transitions<M extends Machine = Machine, A extends string = string, C extends string = string> {
	on?: {
		[k: string]: Handler<M, A, C>[],
	}
};

export type Machine<M, A, C> = {
	states: {
		[k: string]: {
			on?: {
				[k: string]: Handler<M, A, C>[],
			}
			always?: Handler<M, A, C>[],
			entry?: Handler<M, A, C>[],
			exit?: Handler<M, A, C>[],
		},
	},
	on?: {
		[k: string]: Handler<M, A, C>[],
	},
};

export type UnionToIntersection<U> =
	(U extends any ? (k: U)=>void : never) extends ((k: infer I)=>void) ? I : never
