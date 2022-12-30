<script>
	import './tic-tac-toe.css';
	import { TicTacToe } from '$lib/components/tic-tac-toe';
    import { ticTacToe } from '$lib/models/tic-tac-toe';
</script>

<TicTacToe ticTacToe={ticTacToe()}/>
