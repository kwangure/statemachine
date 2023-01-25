import { Machine } from '$lib/machine/create.js';

/**
    @param {{
        completed: boolean;
        id: string;
        title: string;
    }} data
 */
export function todo(data) {
    let id = data.id;
    let completed = data.completed;
    let prevTitle = '';
    let title = data.title;
    return new Machine({
        data() {
            return {
                id,
                completed,
                prevTitle,
                title,
            }
        },
        actions: {
            commit() {
                /** @type {ReturnType<import('./todos.js').todos>} */(this.parent)
                    .emit['TODO.COMMIT']();
            },
            delete() {
                /** @type {ReturnType<import('./todos.js').todos>} */(this.parent)
                    .emit['TODO.DELETE'](this);
            },
        },
        conditions: {
            titleNotEmpty() {
                return title.trim().length > 0;
            },
        },
        ops: {
            ['$completed.falsify']: () => {
                completed = false;
            },
            ['$completed.toggle']() {
                completed = !completed;
            },
            ['$completed.truthify']: () => {
                completed = true;
            },
            ['$prevTitle.fromTitle']() {
                prevTitle = title;
            },
            ['$title.fromPrevTitle']() {
                title = prevTitle;
            },
            /** @param {string} newTitle */
            ['$title.set'](newTitle) {
                title = newTitle;
            },
        },
        config: {
            on: {
                DELETE: [{
                    transitionTo: "deleted",
                    actions: ['commit'],
                }],
            },
            states: [
                ['reading', {
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
                }],
                ['deleted', {
                    entry: [{
                        actions: ["delete"]
                    }],
                    on: {},
                }],
                ['editing', {
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
                }],
            ],
        },
    });
}
