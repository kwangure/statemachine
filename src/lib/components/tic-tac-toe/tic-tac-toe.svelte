<script>
	/** @type {ReturnType<import('$lib/models/tic-tac-toe').ticTacToe>} */
	export let ticTacToe;
</script>

<section>
	<h2>
		{#if $ticTacToe.state === 'playing'}
			Player {$ticTacToe.data.player}
		{:else if $ticTacToe.state === 'winner'}
			Player {$ticTacToe.data.winner} wins!
		{:else if $ticTacToe.state === 'draw'}
			Draw
		{/if}
		{#if $ticTacToe.state === 'winner' || $ticTacToe.state === 'draw'}
			<button on:click={ticTacToe.RESET}>Reset</button>
		{/if}
	</h2>
	<div class="grid">
		{#each $ticTacToe.data.board as tile, i}
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<div class="tile player-{tile?.toLowerCase()}" on:click={() => ticTacToe.PLAY(i)}
				data-testid={`square-${i}`}></div>
		{/each}
	</div>
</section>

<style>
	h2 {
		font-family: Proxima Nova, sans-serif;
		font-weight: bold;
		font-size: 2rem;
	}
	.grid {
		height: 50vmin;
		width: 50vmin;
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		grid-template-rows: repeat(3, 1fr);
		grid-gap: 1rem;
	}
	.tile {
		border-radius: 0.5rem;
		background: white;
		box-shadow: 0 0.25rem 1rem rgba(0, 0, 0, 0.05);
	}
    .player-x:before,
    .player-x:after {
		content: "";
		position: absolute;
		height: 100%;
		width: 0.2rem;
		background: red;
		left: calc(50% - 0.1rem);
		top: 0;
    }
    .player-x:before {
      	transform: rotate(-45deg);
    }
    .player-x:after {
      	transform: rotate(45deg);
    }
	.player-o:before {
		content: "";
		height: 80%;
		width: 80%;
		left: 10%;
		top: 10%;
		position: absolute;
		border-radius: 50%;
		border: 0.2rem solid blue;
    }
</style>