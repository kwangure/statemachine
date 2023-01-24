export const endTagVoidState = [
	"endTagVoid",
	{
		"on": {
			"CHARACTER": [
				{
					"transitionTo": "endTagName",
					"condition": "isAlphaCharacter",
					"actions": [
						"$stack.addName",
						"$index.increment"
					]
				},
				{
					"transitionTo": "invalid",
					"condition": "isTagClose",
					"actions": [
						"$error.invalidVoidContent",
						"$stack.pushInvalid",
						"$index.increment"
					]
				},
				{
					"transitionTo": "invalid",
					"actions": [
						"$error.invalidTagName",
						"$stack.pushInvalid",
						"$index.increment"
					]
				}
			]
		}
	}
];
