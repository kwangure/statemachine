export const tagOpenState = [
	"tagOpen",
	{
		"always": [
			{
				"transitionTo": "done",
				"condition": "isDone"
			}
		],
		"on": {
			"CHARACTER": [
				{
					"transitionTo": "afterCommentBang",
					"condition": "isExclamation",
					"actions": [
						"$stack.pushComment",
						"$index.increment"
					]
				},
				{
					"transitionTo": "endTagOpen",
					"condition": "isForwardSlash",
					"actions": [
						"$index.increment"
					]
				},
				{
					"transitionTo": "tagName",
					"condition": "isAlphaCharacter",
					"actions": [
						"$maybeStack.pop",
						"$stack.addName",
						"$index.increment"
					]
				},
				{
					"transitionTo": "text",
					"actions": [
						"$stack.pop",
						"$stack.fromMaybeStack",
						"$maybeStack.pop",
						"$stack.addRaw",
						"$index.increment"
					]
				}
			]
		}
	}
];
