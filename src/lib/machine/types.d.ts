import type { Exact } from 'type-fest';
import type { Readable, Subscriber } from 'svelte/store'

export interface Thing<T> {
	ops: {
		[x: string]: (...args: any) => void;
	},
	store: Readable<T>;
}

export interface Handler<C extends Config, A, Condition> {
	actions?: A[],
	transitionTo?: keyof C['states'],
	condition?: Condition,
}

export interface Transitions<C extends Config = Config, A extends string = string, Condition extends string = string> {
	on?: {
		[k: string]: Handler<C, A, Condition>[],
	}
};

export type Config<C, A = string | number | symbol, Condition = string | number | symbol> = {
	states: Record<keyof C['states'], {
		on?: {
			[k: string]: Handler<C, A, Condition>[],
		}
		always?: Handler<C, A, Condition>[],
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
		[k: string]: Handler<C, A, Condition>[],
	},
};

export type UnionToIntersection<U> =
	(U extends any ? (k: U) => void : never) extends ((k: infer I) => void) ? I : never
