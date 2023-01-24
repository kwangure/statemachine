export const doneState = [
	"done",
	{
		"always": [
			{
				"transitionTo": "invalid",
				"actions": [
					"$error.unclosedBlock",
					"$stack.pushInvalid"
				],
				"condition": "stackNotEmpty"
			}
		]
	}
];
