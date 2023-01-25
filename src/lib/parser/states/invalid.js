export const invalidState = [
	"invalid",
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
					"transitionTo": "tagOpen",
					"condition": "isTagOpen",
					"actions": [
						"$stack.pushTag",
						"$index.increment"
					]
				},
				{
					"actions": [
						"$index.increment"
					]
				}
			]
		},
		"exit": [
			{
				"actions": [
					"$stack.popInvalid"
				]
			}
		]
	}
];
