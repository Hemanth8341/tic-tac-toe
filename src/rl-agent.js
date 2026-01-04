// Reinforcement Learning Agent using Q-Learning for Tic-Tac-Toe
class RLAgent {
    constructor() {
        // Q-table: state -> action -> Q-value
        this.qTable = new Map();
        this.learningRate = 0.3; // Alpha - how much new info overrides old
        this.discountFactor = 0.9; // Gamma - importance of future rewards
        this.explorationRate = 0.1; // Epsilon - exploration vs exploitation
        this.minExplorationRate = 0.05;
        
        // Game history for learning
        this.currentEpisode = [];
        this.gamesPlayed = 0;
        
        // Load learned data from localStorage
        this.loadFromStorage();
    }

    // Convert board state to normalized string key
    getStateKey(game, isMaximizing) {
        const board = game.field;
        let key = '';
        
        // Count pieces to normalize state (X and O are symmetric)
        let xCount = 0;
        let oCount = 0;
        let emptyCount = 0;
        
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                const val = board[row][col];
                if (val === null) {
                    key += '0';
                    emptyCount++;
                } else if (val === 'x') {
                    key += '1';
                    xCount++;
                } else {
                    key += '2';
                    oCount++;
                }
            }
        }
        
        // Include turn information and piece counts for better state distinction
        key += `_${isMaximizing ? '1' : '0'}_${xCount}_${oCount}`;
        return key;
    }

    // Get Q-value for state-action pair
    getQValue(state, action) {
        if (!action) return 0;
        const stateKey = this.getStateKeyFromAction(state, action);
        return this.qTable.get(stateKey) || 0;
    }

    // Create state-action key
    getStateKeyFromAction(state, action) {
        if (!action) return state;
        return `${state}_${action.row}_${action.col}`;
    }

    // Update Q-value using Q-learning formula
    updateQValue(state, action, reward, nextState, nextBestAction) {
        const stateActionKey = this.getStateKeyFromAction(state, action);
        const currentQ = this.qTable.get(stateActionKey) || 0;
        
        // Q-learning update: Q(s,a) = Q(s,a) + α[r + γ*max(Q(s',a')) - Q(s,a)]
        let nextMaxQ = 0;
        if (nextState && nextBestAction) {
            nextMaxQ = this.getQValue(nextState, nextBestAction);
        }
        
        const newQ = currentQ + this.learningRate * (reward + this.discountFactor * nextMaxQ - currentQ);
        this.qTable.set(stateActionKey, newQ);
    }

    // Choose action using epsilon-greedy policy
    chooseAction(game, availableMoves, isMaximizing, useExploration = true) {
        if (availableMoves.length === 0) return null;
        
        const state = this.getStateKey(game, isMaximizing);
        
        // Exploration: random move
        if (useExploration && Math.random() < this.explorationRate) {
            return availableMoves[Math.floor(Math.random() * availableMoves.length)];
        }
        
        // Exploitation: choose best Q-value action
        let bestMove = null;
        let bestQ = -Infinity;
        
        for (const move of availableMoves) {
            const qValue = this.getQValue(state, move);
            if (qValue > bestQ) {
                bestQ = qValue;
                bestMove = move;
            }
        }
        
        // If no learned value, use strategic move
        if (bestQ === 0 || bestMove === null) {
            return this.getStrategicBestMove(game, availableMoves);
        }
        
        return bestMove;
    }

    // Get strategic best move when Q-values are equal or unknown
    getStrategicBestMove(game, availableMoves) {
        // Prioritize: win > block > center > corner > edge
        const center = { row: 1, col: 1 };
        const corners = [
            { row: 0, col: 0 }, { row: 0, col: 2 },
            { row: 2, col: 0 }, { row: 2, col: 2 }
        ];
        
        // Check for center
        const centerMove = availableMoves.find(m => m.row === center.row && m.col === center.col);
        if (centerMove) return centerMove;
        
        // Check for corners
        const cornerMoves = availableMoves.filter(m => 
            corners.some(c => c.row === m.row && c.col === m.col)
        );
        if (cornerMoves.length > 0) {
            return cornerMoves[Math.floor(Math.random() * cornerMoves.length)];
        }
        
        // Random from remaining
        return availableMoves[Math.floor(Math.random() * availableMoves.length)];
    }

    // Record move in current episode
    recordMove(state, action, reward = 0) {
        this.currentEpisode.push({ state, action, reward });
    }

    // Learn from completed game
    learnFromGame(result, aiSymbol) {
        this.gamesPlayed++;
        
        // Calculate rewards based on game outcome
        let finalReward = 0;
        if (result === 'win') {
            finalReward = 100; // Win reward
        } else if (result === 'loss') {
            finalReward = -100; // Loss penalty
        } else {
            finalReward = 10; // Draw reward (small positive)
        }
        
        // Update Q-values using temporal difference learning
        for (let i = this.currentEpisode.length - 1; i >= 0; i--) {
            const { state, action } = this.currentEpisode[i];
            let reward = 0;
            
            if (i === this.currentEpisode.length - 1) {
                // Last move gets final reward
                reward = finalReward;
            } else {
                // Intermediate moves get small rewards based on position quality
                reward = this.evaluatePositionReward(this.currentEpisode[i]);
            }
            
            // Get next state and action for Q-learning update
            const nextState = i < this.currentEpisode.length - 1 ? this.currentEpisode[i + 1].state : null;
            const nextAction = i < this.currentEpisode.length - 1 ? this.currentEpisode[i + 1].action : null;
            
            this.updateQValue(state, action, reward, nextState, nextAction);
        }
        
        // Decay exploration rate (less exploration as it learns)
        this.explorationRate = Math.max(
            this.minExplorationRate,
            this.explorationRate * 0.995
        );
        
        // Clear episode
        this.currentEpisode = [];
        
        // Save learned data periodically
        if (this.gamesPlayed % 10 === 0) {
            this.saveToStorage();
        }
    }

    // Evaluate position and give intermediate reward
    evaluatePositionReward(moveData) {
        // Small positive reward for making moves (encourages exploration)
        // Negative reward for bad positions will come from final outcome
        return 0.1;
    }

    // Get best move using learned Q-values combined with minimax
    getBestRLMove(game, availableMoves, isMaximizing) {
        const state = this.getStateKey(game, isMaximizing);
        
        // Prioritize minimax - RL is only for tie-breaking
        const scoredMoves = availableMoves.map(move => {
            const qValue = this.getQValue(state, move);
            
            // Simulate move to get minimax score
            const symbol = isMaximizing ? 'o' : 'x';
            game.field[move.row][move.col] = symbol;
            const minimaxScore = this.quickMinimax(game, 0, !isMaximizing, -Infinity, Infinity, symbol);
            game.field[move.row][move.col] = null;
            
            // Normalize Q-value to similar scale as minimax (minimax is -100 to 100)
            const normalizedQ = qValue * 0.2; // Small weight for RL
            
            // Combine: 95% minimax (optimal), 5% Q-learning (only for tie-breaking)
            // This ensures optimal play while using RL for fine-tuning
            const combinedScore = (minimaxScore * 0.95) + (normalizedQ * 0.05);
            
            return { move, score: combinedScore, qValue, minimaxScore };
        });
        
        // Sort by combined score (descending)
        scoredMoves.sort((a, b) => {
            // Primary sort by minimax score
            if (Math.abs(a.minimaxScore - b.minimaxScore) > 1) {
                return b.minimaxScore - a.minimaxScore;
            }
            // Secondary sort by combined score for tie-breaking
            return b.score - a.score;
        });
        
        // Return best move (prioritize minimax optimal moves)
        const bestMinimax = scoredMoves[0].minimaxScore;
        const optimalMoves = scoredMoves.filter(m => Math.abs(m.minimaxScore - bestMinimax) < 0.1);
        
        // Among optimal moves, use RL for selection
        if (optimalMoves.length > 1) {
            optimalMoves.sort((a, b) => b.score - a.score);
            return optimalMoves[0].move;
        }
        
        return scoredMoves[0].move;
    }

    // Quick minimax for evaluation
    quickMinimax(game, depth, isMaximizing, alpha, beta, symbol) {
        const winner = game.getWinner();
        if (winner === symbol) return 100 - depth;
        if (winner === (symbol === 'x' ? 'o' : 'x')) return depth - 100;
        if (game.isDraw()) return 0;
        
        const availableMoves = [];
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                if (!game.field[row][col]) {
                    availableMoves.push({ row, col });
                }
            }
        }
        
        if (isMaximizing) {
            let maxScore = -Infinity;
            for (const move of availableMoves) {
                game.field[move.row][move.col] = symbol;
                const score = this.quickMinimax(game, depth + 1, false, alpha, beta, symbol);
                game.field[move.row][move.col] = null;
                maxScore = Math.max(maxScore, score);
                alpha = Math.max(alpha, score);
                if (beta <= alpha) break;
            }
            return maxScore;
        } else {
            let minScore = Infinity;
            const oppSymbol = symbol === 'x' ? 'o' : 'x';
            for (const move of availableMoves) {
                game.field[move.row][move.col] = oppSymbol;
                const score = this.quickMinimax(game, depth + 1, true, alpha, beta, symbol);
                game.field[move.row][move.col] = null;
                minScore = Math.min(minScore, score);
                beta = Math.min(beta, score);
                if (beta <= alpha) break;
            }
            return minScore;
        }
    }

    // Save Q-table to localStorage
    saveToStorage() {
        try {
            const data = {
                qTable: Array.from(this.qTable.entries()),
                gamesPlayed: this.gamesPlayed,
                explorationRate: this.explorationRate
            };
            localStorage.setItem('ticTacToeRL', JSON.stringify(data));
        } catch (e) {
            console.warn('Could not save RL data:', e);
        }
    }

    // Load Q-table from localStorage
    loadFromStorage() {
        try {
            const data = localStorage.getItem('ticTacToeRL');
            if (data) {
                const parsed = JSON.parse(data);
                this.qTable = new Map(parsed.qTable);
                this.gamesPlayed = parsed.gamesPlayed || 0;
                // Gradually reduce exploration based on games played
                this.explorationRate = Math.max(
                    this.minExplorationRate,
                    0.1 * Math.pow(0.99, Math.min(this.gamesPlayed, 1000))
                );
            }
        } catch (e) {
            console.warn('Could not load RL data:', e);
        }
    }

    // Reset learning (for testing)
    reset() {
        this.qTable.clear();
        this.gamesPlayed = 0;
        this.explorationRate = 0.1;
        this.currentEpisode = [];
        localStorage.removeItem('ticTacToeRL');
    }
}

// Export for use in other modules
window.RLAgent = RLAgent;

