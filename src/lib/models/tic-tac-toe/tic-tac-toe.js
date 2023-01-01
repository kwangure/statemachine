import { createMachine } from "$lib/machine/create";

export function ticTacToe() {
	return createMachine({
		initial: 'playing',
		data: {
			board: /** @type {('X' | 'O' | null)[]} */(Array(9).fill(null)),
			move: 0,
			player: /** @type {('X' | 'O')} */('X'),
			winner: /** @type {('X' | 'O' | undefined)} */(undefined),
		},
		conditions: {
			checkWin() {
				const winningLines = [
					[0, 1, 2],
					[3, 4, 5],
					[6, 7, 8],
					[0, 3, 6],
					[1, 4, 7],
					[2, 5, 8],
					[0, 4, 8],
					[2, 4, 6]
				];

				for (let line of winningLines) {
					const xWon = line.every(index => {
						return this.data.board[index] === 'X';
					});

					if (xWon) return true;

					const oWon = line.every(index => {
						return this.data.board[index] === 'O';
					});

					if (oWon) return true;
				}

				return false;
			},
			checkDraw() {
				console.log('check draw');
				return this.data.move === 9;
			},
			isValidMove(tile) {
				return this.data.board[tile] === null;
			}
		},
		ops: {
			board: {
				update(tile) {
					const updatedBoard = [...this.data.board];
					updatedBoard[tile] = this.data.player;
					return updatedBoard;
				},
				reset() {
					return Array(9).fill(null);
				},
			},
			move: {
				increment() {
					return this.data.move + 1;
				},
				reset() {
					return 0;
				},
			},
			player: {
				update() {
					return this.data.player === 'X' ? 'O' : 'X';
				},
				reset() {
					return 'X';
				}
			},
			winner: {
				update() {
					return this.data.player === 'X' ? 'O' : 'X';
				},
				reset() {
					return undefined;
				}
			},
		},
		config: {
			states: {
				playing: {
					always: [
						{ transitionTo: "winner", condition: "checkWin" },
						{ transitionTo: "draw", condition: "checkDraw" },
					],
					on: {
						PLAY: [
							{
								transitionTo: "playing",
								condition: "isValidMove",
								actions: [
									"$board.update",
									"$move.increment",
									"$player.update",
								],
							},
						],
					},
				},
				winner: {
					entry: [{
						actions: ["$winner.update"],
					}],
				},
				draw: {},
			},
			on: {
				RESET: [{
					transitionTo: "playing",
					actions: [
						"$board.reset",
						"$move.reset",
						"$player.reset",
						"$winner.reset",
					],
				}],
			},
		},
	});
}
