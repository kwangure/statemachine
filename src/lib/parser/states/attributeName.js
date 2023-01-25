export const attributeNameState = [
	"attributeName",
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
					"transitionTo": "fragment",
					"condition": "isTagClose",
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
					"actions": [
						"$stack.addName",
						"$index.increment"
					]
				}
			]
		}
	}
];
