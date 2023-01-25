export const tagNameState = [
	"tagName",
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
					"transitionTo": "beforeAttributeName",
					"condition": "isWhitespace",
					"actions": [
						"$index.increment"
					]
				},
				{
					"transitionTo": "fragment",
					"condition": "isTagClose",
					"actions": [
						"$index.increment"
					]
				},
				{
					"transitionTo": "selfClosingTag",
					"condition": "isForwardSlash",
					"actions": [
						"$index.increment"
					]
				},
				{
					"transitionTo": "invalid",
					"condition": "isNonAlphaCharacter",
					"actions": [
						"$error.invalidTagName",
						"$stack.pushInvalid",
						"$index.increment"
					]
				},
				{
					"actions": [
						"$stack.addName",
						"$index.increment"
					]
				}
			]
		}
	}
];
