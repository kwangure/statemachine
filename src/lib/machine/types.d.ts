import type { Exact } from 'type-fest';
import type { Readable, Subscriber } from 'svelte/store'

export interface Thing<T> {
	ops: {
		[x: string]: (...args: any) => void;
	},
	store: Readable<T>;
}

export interface Handler<C, A, Condition> {
	actions?: A[],
	transitionTo?: keyof C['states'],
	condition?: Condition,
}

export type Config<C, A, Condition> = {
	states: Record<keyof C['states'], {
		on?: {
			[k: string]: {
				actions?: A[],
				transitionTo?: keyof C['states'],
				condition?: Condition,
			}[],
		}
		always?: {
			actions?: A[],
			transitionTo?: keyof C['states'],
			condition?: Condition,
		}[],
		entry?: {
			actions?: A[],
			condition?: Condition,
		}[],
		exit?: {
			actions?: A[],
			condition?: Condition,
		}[],
	}>,
	on?: {
		[k: string]: {
			actions?: A[],
			condition?: Condition,
			transitionTo?: keyof C['states'],
		}[],
	},
};

export type UnionToIntersection<U> =
	(U extends any ? (k: U) => void : never) extends ((k: infer I) => void) ? I : never
