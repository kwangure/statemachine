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
    return createMachine({
        actions: {
            commit() {
                this.sendParent('TODO.COMMIT');
            },
            delete() {
                this.sendParent('TODO.DELETE', this.data.id);
            },
        },
        conditions: {
            titleNotEmpty() {
                return this.data.title.trim().length > 0;
            },
        },
        data: {
            id: data.id,
            completed: data.completed,
            prevTitle: '',
            title: data.title,
        },
        ops: {
            id: {},
            completed: {
                falsify: () => false,
                toggle: (value) => !value,
                truthify: () => true,
            },
            prevTitle: {
                fromTitle() {
                    return this.data.title;
                },
            },
            title: {
                fromPrevTitle() {
                    return this.data.prevTitle;
                },
                set(_, newTitle) {
                    return newTitle;
                },
            },
        },
        machine: {
            on: {
                DELETE: [{
                    transitionTo: "deleted",
                    actions: ['commit'],
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
                    entry: [{
                        actions: ["delete"]
                    }],
                    on: {},
                },
                editing: {
                    entry: [{
                        actions: [
                            "$prevTitle.fromTitle",
                        ],
                    }],
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
        },
        initial: data.initial
    });
}
