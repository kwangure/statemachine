import { writable } from "svelte/store";

interface Ops<T> {
	[x: string]: (value: T, ...args: any) => T
}

export function thing<T, S extends Ops<T>>(value: T, ops?: S) {
	const store = writable(value);
	const { subscribe, update } = store;

	const storeOps: {
		[K in keyof S]: () => void;
	} = Object.create(null);

	for (const name in ops) {
		storeOps[name] = (...args) => {
			update((value) => ops[name](value, ...args))
		};
	}

	return {
		ops: storeOps,
		store: { subscribe },
	};
}