import { writable } from 'svelte/store';

/**
 * @param {string} key
 * @param {any} fallback
 */
function getLocalStorageItem(key, fallback) {
	try {
		return localStorage.getItem(key) ?? fallback
	} catch (error) {
		return fallback;
	}
}

/**
 * @param {string} key
 * @param {any} fallback
 */
export function localStorageWritable(key, fallback) {
	const value = getLocalStorageItem(key, fallback);
	const store = writable(value);
	const { set, subscribe } = store;

	return {
		/**
		 * @param {string} value
		 */
		set(value) {
			localStorage.setItem(key, value);
			set(value);
		},
		subscribe,
	}
}
