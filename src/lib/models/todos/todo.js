import { get, derived, writable } from 'svelte/store';
import { createMachine } from '$lib/machine/create';

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

    return createMachine({ actions, conditions, machine, state, store });
}
