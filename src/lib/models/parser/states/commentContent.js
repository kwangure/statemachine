export const commentContentState = [
	"commentContent",
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
					"transitionTo": "afterCommentContent",
					"condition": "isMinus",
					"actions": [
						"$stack.addData",
						"$index.increment"
					]
				},
				{
					"actions": [
						"$stack.addData",
						"$index.increment"
					]
				}
			]
		}
	}
];
