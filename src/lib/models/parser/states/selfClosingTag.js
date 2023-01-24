export const selfClosingTagState = [
	"selfClosingTag",
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
					"transitionTo": "fragment",
					"condition": "isTagClose",
					"actions": [
						"$index.increment",
						"$stack.popElement"
					]
				}
			]
		}
	}
];
