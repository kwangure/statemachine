import type { Exact } from 'type-fest';
import type { Readable, Subscriber } from 'svelte/store'

export interface Thing<T> {
	ops: {
		[x: string]: (...args: any) => void;
	},
	store: Readable<T>;
}

export interface Handler<A> {
	actions?: A[],
	transitionTo?: string,
	condition?: string,
}

export interface States<A extends string = string> {
	states: {
		[k: string]: Transitions<A> & {
			always?: Handler<A>[],
			entry?: Handler<A>,
			exit?: Handler<A>,
		},
	}
}

export interface Transitions<A extends string = string> {
	on?: {
		[k: string]: Handler<A>[],
	}
};

export type Machine<A> = {
	states: {
		[k: string]: {
			on?: {
				[k: string]: Handler<A>[],
			}
			always?: Handler<A>[],
			entry?: Handler<A>,
			exit?: Handler<A>,
		},
	},
	on?: {
		[k: string]: Handler<A>[],
	},
};

export type UnionToIntersection<U> =
	(U extends any ? (k: U)=>void : never) extends ((k: infer I)=>void) ? I : never
