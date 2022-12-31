import { derived, get, writable } from "svelte/store";
import { createMachine } from "$lib/machine/create";

export function ticTacToe() {
	/** @type {import('svelte/store').Writable<('X' | 'O' | null)[]>} */
	const board = writable(Array(9).fill(null));

	/** @type {import('svelte/store').Writable<'playing' | 'winner' | 'draw'>} */
	const state = writable('playing');
	const moves = writable(0);
	/** @type {import('svelte/store').Writable<'X' | 'O'>} */
	const player = writable('X');
	const winner = writable();
	const merged = derived(
		[board, moves, player, state, winner],
		([$board, $moves, $player, $state, $winner]) => {
			return {
				state: $state,
				data: {
					board: $board,
					moves: $moves,
					player: $player,
					winner: $winner,
				},
			};
		});

	const { subscribe } = merged;

	const store = {
		subscribe,
		destroy() { },
	}

	const conditions = {
		checkWin: () => {
			const $board = get(board);
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
					return $board[index] === 'X';
				});

				if (xWon) return true;

				const oWon = line.every(index => {
					return $board[index] === 'O';
				});

				if (oWon) return true;
			}

			return false;
		},
		checkDraw: () => get(moves) === 9,
		/** @param {number} tile */
		isValidMove: (tile) => {
			return get(board)[tile] === null
		}
	};
	const machine = {
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
							actions: ["updateBoard"],
						},
					],
				},
			},
			winner: {
				entry: {
					actions: ["setWinner"],
				},
			},
			draw: {},
		},
		on: {
			RESET: [{
				transitionTo: "playing",
				actions: ["resetGame"],
			}],
		},
	};
	const actions = {
		/**
		 * @param {number} tile
		 */
		updateBoard: (tile) => {
			board.update(($board) => {
				const updatedBoard = [...$board];
				updatedBoard[tile] = get(player);
				return updatedBoard;
			});
			moves.update(($moves) => $moves + 1);
			player.update(($player) => $player === 'X' ? 'O' : 'X');
		},
		resetGame: () => {
			board.set(Array(9).fill(null));
			state.set('playing');
			moves.set(0);
			player.set('X');
			winner.set(undefined);
		},
		setWinner: () => winner.update(() => get(player) === 'X' ? 'O' : 'X')
	}

	return createMachine({ actions, conditions, config: machine, state, store })
}
