export const afterAttributeValueQuoted = [
	"afterAttributeValueQuoted",
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
					"transitionTo": "selfClosingTag",
					"condition": "isForwardSlash",
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
					"transitionTo": "attributeName",
					"condition": "isAlphaCharacter",
					"actions": [
						"$stack.pushAttribute",
						"$stack.addName",
						"$index.increment"
					]
				},
				{
					"transitionTo": "invalid",
					"actions": [
						"$error.invalidAttributeName",
						"$stack.pushInvalid",
						"$index.increment"
					]
				}
			]
		}
	}
];
