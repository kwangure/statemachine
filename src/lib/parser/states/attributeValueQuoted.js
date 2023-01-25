export const attributeValueQuotedState = [
	"attributeValueQuoted",
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
					"transitionTo": "afterAttributeValueQuoted",
					"condition": "isQuoteClosed",
					"actions": [
						"$stack.popText",
						"$index.increment",
						"$stack.popAttribute"
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
