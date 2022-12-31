import { derived, get } from 'svelte/store';
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
        fromPrevTitle() { return this.data.prevTitle },
        set: (_, newTitle) => newTitle,
    });
    const prevTitle = thing('', {
        fromTitle() { return this.data.title },
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
        commit() {
            this.sendParent('TODO.COMMIT')
        },
        delete() {
            this.sendParent('TODO.DELETE', get(id.store))
        },
    };

    const conditions = {
        titleNotEmpty() {
            return this.data.title.trim().length > 0;
        },
    };

    const store = {
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
