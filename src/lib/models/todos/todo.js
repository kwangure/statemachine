import { get, derived, writable } from 'svelte/store';
import { createMachine } from '$lib/machine/create';
import { thing } from '$lib/thing/thing';

/**
    @param {{
        completed: boolean;
        id: string;
        initial?: 'deleted' | 'editing' | 'reading';
        title: string;
    }} data
 */
export function todo(data) {
    const state = thing(data.initial || "reading", {
        deleted: () => 'deleted',
        editing: () => 'editing',
        reading: () => 'reading',
    });
    const id = thing(data.id);
    const title = thing(data.title, {
        /** @returns {string} */
        fromPrevTitle: () => get(prevTitle.store),
        set: (_currentTitle, newTitle) => newTitle,
    });
    const prevTitle = thing('', {
        fromTitle: () => get(title.store),
    });
    const completed = thing(false, {
        falsify: () => false,
        toggle: (value) => !value,
        truthify: () => true,
    });

    const merged = derived(
        [completed.store, id.store, prevTitle.store, title.store, state.store],
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
                            "$completed.falsify",
                            "commit",
                        ],
                    }],
                    SET_COMPLETED: [{
                        actions: [
                            "$completed.truthify",
                            "commit",
                        ],
                    }],
                    TOGGLE_COMPLETE: [{
                        actions: [
                            "$completed.toggle",
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
                        "$prevTitle.fromTitle",
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
                                "$title.fromPrevTitle",
                            ],
                        },
                    ],
                    CHANGE: [{
                        actions: [
                            "$title.set",
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
        delete: () => sendParent('TODO.DELETE', get(id.store)),
    };

    const conditions = {
        titleNotEmpty: () => get(title.store).trim().length > 0,
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

    const data2 = {
        completed,
        prevTitle,
        title,
    }

    return createMachine({ actions, conditions, data: data2, machine, state, store });
}
