export const attributeValueUnquotedState = [
	"attributeValueUnquoted",
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
						"$stack.popText",
						"$stack.popAttribute",
						"$index.increment"
					]
				},
				{
					"transitionTo": "fragment",
					"condition": "isTagClose",
					"actions": [
						"$stack.popText",
						"$stack.popAttribute",
						"$index.increment"
					]
				},
				{
					"transitionTo": "selfClosingTag",
					"condition": "isForwardSlash",
					"actions": [
						"$stack.popText",
						"$stack.popAttribute",
						"$index.increment"
					]
				},
				{
					"transitionTo": "invalid",
					"condition": "isInvalidUnquotedValue",
					"actions": [
						"$error.invalidUnquotedValue",
						"$stack.pushInvalid",
						"$index.increment"
					]
				},
				{
					"actions": [
						"$stack.addRaw",
						"$index.increment"
					]
				}
			]
		}
	}
];
