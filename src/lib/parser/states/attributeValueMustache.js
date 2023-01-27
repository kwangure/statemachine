export const attributeValueMustacheState = [
	"attributeValueMustache",
	{
		"always": [
			{
				"transitionTo": "done",
				"condition": "isDone",
				"actions": [
					"$stack.popMustache"
				]
			}
		],
		"on": {
			"CHARACTER": [
				{
					"transitionTo": "afterAttributeValueQuoted",
					"condition": "isSveltemustacheDepthDone",
					"actions": [
						"$index.increment",
						"$stack.popMustache",
						"$stack.popAttribute"
					]
				},
				{
					"condition": "isSvelteMustacheOpen",
					"actions": [
						"$mustacheDepth.increment"
					]
				},
				{
					"condition": "isSvelteMustacheClosed",
					"actions": [
						"$mustacheDepth.decrement"
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
