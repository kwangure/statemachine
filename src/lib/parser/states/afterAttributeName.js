export const afterAttributeNameState = [
	"afterAttributeName",
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
					"transitionTo": "afterAttributeName",
					"condition": "isWhitespace",
					"actions": [
						"$index.increment"
					]
				},
				{
					"transitionTo": "selfClosingTag",
					"condition": "isForwardSlash",
					"actions": [
						"$stack.popAttribute",
						"$index.increment"
					]
				},
				{
					"transitionTo": "beforeAttributeValue",
					"condition": "isEquals",
					"actions": [
						"$index.increment"
					]
				},
				{
					"transitionTo": "fragment",
					"condition": "isTagClose",
					"actions": [
						"$stack.popAttribute",
						"$index.increment"
					]
				},
				{
					"transitionTo": "attributeName",
					"condition": "isAlphaCharacter",
					"actions": [
						"$stack.popAttribute",
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
