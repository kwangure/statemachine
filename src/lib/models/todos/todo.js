import { get, derived, writable } from 'svelte/store';

/**
    @param {{
        completed: boolean;
        id: string;
        initial?: 'deleted' | 'editing' | 'reading';
        title: string;
    }} data
 */
export function todo(data) {
    const state = writable(data.initial || "reading");
    const id = writable(data.id);
    const title = writable(data.title);
    const prevTitle = writable('');
    const completed = writable(false);
    const merged = derived(
        [completed, id, prevTitle, title, state],
        ([$completed, $id, $prevTitle, $title, $state]) => {
            return {
                state: $state,
                data: {
                    completed: $completed,
                    id: $id,
                    prevTitle: $prevTitle,
                    title: $title,
                },
            };
        });
    const { subscribe } = merged;

    /** @type {(event: string, value?: any) => void} */
    let sendParent = () => {};

    /**
        @typedef {{
            on: {
                [k: string]: {
                    actions?: string[],
                    transitionTo?: string,
                    condition?: string,
                }[],
            }
        }} Transitions
        @type {Transitions & {
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
        }}
     */
    const machine = {
        on: {
            DELETE: [{
                transitionTo: "deleted",
            }],
        },
        states: {
            reading: {
                on: {
                    EDIT: [{
                        transitionTo: "editing",
                    }],
                    SET_ACTIVE: [{
                        actions: [
                            "completedFalse",
                            "commit",
                        ],
                    }],
                    SET_COMPLETED: [{
                        actions: [
                            "completedTrue",
                            "commit",
                        ],
                    }],
                    TOGGLE_COMPLETE: [{
                        actions: [
                            "completedToggle",
                            "commit",
                        ],
                    }],
                }
            },
            deleted: {
                entry: {
                    actions: ["delete"]
                },
                on: {},
            },
            editing: {
                entry: {
                    actions: [
                        "prevTitleFromTitle",
                    ],
                },
                on: {
                    BLUR: [
                        {
                            transitionTo: "reading",
                            actions: ["commit"],
                        },
                    ],
                    CANCEL: [
                        {
                            transitionTo: "reading",
                            actions: [
                                "titleFromPrevTitle",
                            ],
                        },
                    ],
                    CHANGE: [{
                        actions: [
                            "setTitle",
                        ],
                    }],
                    COMMIT: [
                        {
                            transitionTo: "reading",
                            actions: ["commit"],
                            condition: "titleNotEmpty",
                        },
                        {
                            transitionTo: "deleted",
                        },
                    ],
                }
            },
        },
    };

    /** @type {Record<string, (...args: any) => any>} */
    const actions = {
        commit: () => sendParent('TODO.COMMIT'),
        completedFalse: () => completed.set(false),
        completedTrue: () => completed.set(true),
        completedToggle: () => completed.update((value) => !value),
        delete: () => sendParent('TODO.DELETE', get(id)),
        prevTitleFromTitle: () => prevTitle.set(get(title)),
        /** @param {string} value */
        setTitle: (value) => title.set(value),
        titleFromPrevTitle: () => title.set(get(prevTitle)),
    };

    const conditions = {
        titleNotEmpty: () => get(title).trim().length > 0,
    };


    const store = {
        /**
         * @param {(event: string, value?: any) => void} fn
         */
        createParentSender(fn) {
            if (typeof fn === 'function') sendParent = fn;
        },
        subscribe,
        destroy() { },
    };

    /**
        @typedef {keyof import('./types').UnionToIntersection<
            (typeof machine)['on'] |
            (typeof machine.states)[keyof typeof machine.states]['on']
        >} EventType
        @typedef {{ [key in EventType] : (...args: any) => any}} Action
    */
    return /** @type {typeof store & Action} */(new Proxy(store, {
        get(target, prop, receiver) {
            if (Object.hasOwn(target, prop)) {
                return Reflect.get(target, prop, receiver);
            }
            const isEventListener = typeof prop === 'string'
                && prop.toUpperCase() === prop;

            if (!isEventListener) return;

            return function (/** @type {any} */ ...args) {
                const $state = get(state);
                const transitions = Object.hasOwn(machine.states[$state].on, prop)
                    ? machine.states[$state].on[prop]
                    : machine.on[prop] || [];

                for (const { actions: transitionActions, condition, transitionTo } of transitions) {
                    if (condition) {
                        const isSatisfied = conditions[/** @type {keyof conditions} */(condition)]();
                        if (!isSatisfied) break;
                    }
                    /** @type {string[]} */
                    const actionQueue = [];

                    if (transitionTo) {
                        const currentState = get(state);
                        actionQueue.push(...machine.states[currentState].exit?.actions || []);
                        actionQueue.push(...transitionActions || []);
                        actionQueue.push(...machine.states[transitionTo].entry?.actions || []);
                        state.set(/** @type {"deleted" | "editing" | "reading"} */(transitionTo));
                    } else {
                        actionQueue.push(...transitionActions || []);
                    }

                    console.log({ actionQueue });

                    for (const action of actionQueue) {
                        actions[action](...args);
                    }
                }

            }
        },
    }));
}
