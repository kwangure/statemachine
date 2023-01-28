/**
 * @param {string} key
 * @param {string} defaultValue
 */
export function getLocalStorageItem(key, defaultValue) {
	if (typeof window === 'undefined')
		return defaultValue;
	return localStorage.getItem(key) ?? defaultValue;
}
