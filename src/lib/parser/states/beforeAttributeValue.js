export const beforeAttributeValueState = [
	"beforeAttributeValue",
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
					"transitionTo": "beforeAttributeValue",
					"condition": "isWhitespace",
					"actions": [
						"$index.increment"
					]
				},
				{
					"transitionTo": "attributeValueQuoted",
					"condition": "isQuote",
					"actions": [
						"$openQuote.set",
						"$index.increment",
						"$stack.pushText"
					]
				},
				{
					"transitionTo": "attributeValueMustache",
					"condition": "isSvelteMustacheOpen",
					"actions": [
						"$stack.pushMustache",
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
					"transitionTo": "attributeValueUnquoted",
					"actions": [
						"$stack.pushText",
						"$stack.addRaw",
						"$index.increment"
					]
				}
			]
		}
	}
];
