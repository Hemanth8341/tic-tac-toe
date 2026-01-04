class TicTacToe {
    constructor(startingPlayer = 'x') {
        this.currentPlayer = startingPlayer === 'o' ? 'o' : 'x';
        this.field = Array.from({ length: 3 }, () => Array(3).fill(null));
        this.winner = null;
        this.turns = 0;
    }
    getCurrentPlayerSymbol() { return this.currentPlayer; }
    nextTurn(row, col) {
        if (this.field[row][col] || this.isFinished()) return;
        this.field[row][col] = this.currentPlayer;
        this.turns++;
        if (this._checkWinner(row, col)) this.winner = this.currentPlayer;
        this.currentPlayer = this.currentPlayer === 'x' ? 'o' : 'x';
    }
    isFinished() { return this.getWinner() !== null || this.noMoreTurns(); }
    getWinner() { return this.winner; }
    noMoreTurns() { return this.turns >= 9; }
    isDraw() { return this.noMoreTurns() && !this.getWinner(); }
    getFieldValue(row, col) { return this.field[row][col]; }
    _checkWinner(row, col) {
        const s = this.currentPlayer;
        return (
            this.field[row].every(cell => cell === s) ||
            this.field.every(r => r[col] === s) ||
            (row === col && this.field.every((r, i) => r[i] === s)) ||
            (row + col === 2 && this.field.every((r, i) => r[2 - i] === s))
        );
    }
}
window.TicTacToe = TicTacToe;
