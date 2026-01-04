class AIPlayer {
    constructor(difficulty = 'medium') {
        this.difficulty = difficulty;
        this.symbol = 'o';
        this.opponentSymbol = 'x';
        this.style = this.rollStyle(); // 'balanced' | 'aggressive' | 'defensive' | 'corner'
        
        // Initialize Reinforcement Learning Agent
        if (typeof window.RLAgent !== 'undefined') {
            this.rlAgent = new window.RLAgent();
        } else {
            this.rlAgent = null;
        }
        
        // Track game state for RL learning
        this.gameHistory = [];
        this.currentGameMoves = [];
        
        // Track recent moves to prevent loops
        this.recentMoves = [];
        this.maxRecentMoves = 6;
    }

    rollStyle() {
        const styles = ['balanced', 'aggressive', 'defensive', 'corner'];
        return styles[Math.floor(Math.random() * styles.length)];
    }

    setSymbol(symbol) {
        this.symbol = symbol;
        this.opponentSymbol = symbol === 'x' ? 'o' : 'x';
    }

    setDifficulty(difficulty) {
        this.difficulty = difficulty;
    }

    getMove(game) {
        // CRITICAL: Always check for immediate win FIRST (highest priority)
        const winNow = this.getWinningMove(game, this.symbol);
        if (winNow) {
            this.trackMove(winNow);
            this.recordMoveForRL(game, winNow);
            return winNow;
        }
        
        // CRITICAL: Always block opponent's winning move (second priority)
        const block = this.getWinningMove(game, this.opponentSymbol);
        if (block) {
            this.trackMove(block);
            this.recordMoveForRL(game, block);
            return block;
        }

        // CRITICAL: Block opponent's immediate threat (2 in a row) - prevents next turn win
        const blockThreat = this.getBlockingThreatMove(game);
        if (blockThreat) {
            this.trackMove(blockThreat);
            this.recordMoveForRL(game, blockThreat);
            return blockThreat;
        }

        // Check for fork creation (create two winning opportunities)
        const forkMove = this.getForkMove(game);
        if (forkMove) {
            this.trackMove(forkMove);
            this.recordMoveForRL(game, forkMove);
            return forkMove;
        }

        // Block opponent's fork
        const blockFork = this.getBlockForkMove(game);
        if (blockFork) {
            this.trackMove(blockFork);
            this.recordMoveForRL(game, blockFork);
            return blockFork;
        }

        const availableMoves = this.getAvailableMoves(game);
        if (availableMoves.length === 0) return null;

        // Use perfect minimax for all difficulties to ensure optimal play
        // RL is used only for tie-breaking among equally good moves
        let move = null;

        switch (this.difficulty) {
            case 'easy':
                // Easy: Use improved strategic algorithm with minimax evaluation
                move = this.getImprovedEasyMove(game, availableMoves);
                break;
            case 'medium':
                // Medium: Mostly perfect moves with minimal variety
                move = this.getBestMoveWithVariety(game, availableMoves, 0.05);
                break;
            case 'hard':
                // Hard: 100% perfect minimax (unbeatable)
                move = this.getPerfectMove(game);
                this.trackMove(move);
                break;
            default:
                move = this.getPerfectMove(game);
                this.trackMove(move);
        }

        this.recordMoveForRL(game, move);
        return move;
    }

    // Improved Easy Mode Algorithm - Combines minimax with strategic evaluation
    getImprovedEasyMove(game, availableMoves) {
        // CRITICAL: Check if any move blocks an immediate threat first
        const threatBlockingMoves = [];
        for (const move of availableMoves) {
            const { row, col } = move;
            game.field[row][col] = this.symbol;
            // Check if this move blocks opponent from having 2 in a row
            const opponentThreatsAfter = this.countThreats(game, this.opponentSymbol);
            game.field[row][col] = null;
            const opponentThreatsBefore = this.countThreats(game, this.opponentSymbol);
            if (opponentThreatsBefore > opponentThreatsAfter) {
                threatBlockingMoves.push({ move, threatsBlocked: opponentThreatsBefore - opponentThreatsAfter });
            }
        }
        
        // If there are threat-blocking moves, prioritize them
        if (threatBlockingMoves.length > 0) {
            // Sort by number of threats blocked
            threatBlockingMoves.sort((a, b) => b.threatsBlocked - a.threatsBlocked);
            const bestBlock = threatBlockingMoves[0].move;
            // Still evaluate with minimax to ensure it's optimal
            game.field[bestBlock.row][bestBlock.col] = this.symbol;
            const blockScore = this.minimax(game, 0, false, -Infinity, Infinity);
            game.field[bestBlock.row][bestBlock.col] = null;
            
            // If blocking is clearly important (high threat count), prioritize it
            if (threatBlockingMoves[0].threatsBlocked >= 1) {
                this.trackMove(bestBlock);
                return bestBlock;
            }
        }
        
        // Use minimax with strategic evaluation for better decision making
        const scoredMoves = availableMoves.map(move => {
            const { row, col } = move;
            
            // Get minimax score (full depth for optimal play)
            game.field[row][col] = this.symbol;
            const minimaxScore = this.minimax(game, 0, false, -Infinity, Infinity);
            game.field[row][col] = null;
            
            // Get strategic evaluation score (threats, forks, etc.)
            const strategicScore = this.evaluateMoveStrategically(game, move);
            
            // Get position value (center > corner > edge)
            const positionScore = this.getPositionValue(move);
            
            // Check if this move blocks opponent threats (defensive bonus)
            const opponentThreatsBefore = this.countThreats(game, this.opponentSymbol);
            game.field[row][col] = this.opponentSymbol;
            const opponentThreatsAfter = this.countThreats(game, this.opponentSymbol);
            game.field[row][col] = null;
            const defensiveBonus = (opponentThreatsBefore - opponentThreatsAfter) * 10;
            
            // Normalize strategic score to work with minimax scale
            // Minimax is -100 to 100, strategic is 0-50, position is 1-3
            const normalizedStrategic = strategicScore * 2; // Scale to 0-100 range
            const normalizedPosition = positionScore * 5; // Scale to 5-15 range
            
            // Combine scores: 70% minimax (optimal), 20% strategic (heuristics), 5% position, 5% defensive
            // Add defensive bonus for blocking threats
            const combinedScore = (minimaxScore * 0.70) + (normalizedStrategic * 0.20) + (normalizedPosition * 0.05) + (defensiveBonus * 0.05);
            
            return { move, score: combinedScore, minimaxScore, strategicScore, positionScore, defensiveBonus };
        });
        
        // Sort by combined score (descending)
        scoredMoves.sort((a, b) => {
            // Primary: combined score
            if (Math.abs(a.score - b.score) > 0.1) {
                return b.score - a.score;
            }
            // Secondary: minimax score for tie-breaking
            return b.minimaxScore - a.minimaxScore;
        });
        
        // For easy mode: 90% chance to pick best, 10% chance to pick from top 3
        // This makes it challenging but not perfect
        const bestScore = scoredMoves[0].score;
        const nearBestMoves = scoredMoves.filter(m => Math.abs(m.score - bestScore) < 3);
        const topMoves = scoredMoves.slice(0, Math.min(3, scoredMoves.length));
        
        let selectedMove;
        if (Math.random() < 0.90) {
            // Pick from best moves (prioritize minimax optimal)
            const movesToChoose = nearBestMoves.length > 0 ? nearBestMoves : [scoredMoves[0]];
            const prioritized = this.prioritizeMoves(movesToChoose.map(m => m.move));
            selectedMove = prioritized[0];
        } else {
            // Occasionally pick from top moves for variety (makes it beatable)
            const prioritized = this.prioritizeMoves(topMoves.map(m => m.move));
            const randomIndex = Math.floor(Math.random() * Math.min(3, prioritized.length));
            selectedMove = prioritized[randomIndex];
        }
        
        this.trackMove(selectedMove);
        return selectedMove;
    }

    // Evaluate move strategically (threats, opportunities, etc.)
    evaluateMoveStrategically(game, move) {
        let score = 0;
        const { row, col } = move;
        
        // Simulate the move
        game.field[row][col] = this.symbol;
        
        // Check for threats created (two in a row - immediate win opportunity)
        const threatsCreated = this.countThreats(game, this.symbol);
        score += threatsCreated * 4; // High value for creating threats
        
        // Check for opponent threats blocked (defensive value)
        const opponentThreatsBefore = this.countThreats(game, this.opponentSymbol);
        game.field[row][col] = this.opponentSymbol;
        const opponentThreatsAfter = this.countThreats(game, this.opponentSymbol);
        game.field[row][col] = null;
        const threatsBlocked = opponentThreatsBefore - opponentThreatsAfter;
        score += threatsBlocked * 5; // High value for blocking opponent
        
        // Check for fork opportunities created (two threats at once)
        const forkOpportunities = this.countForkOpportunities(game, this.symbol);
        score += forkOpportunities * 6; // Very high value for forks
        
        // Check for center control (if center is taken, it's valuable)
        if (row === 1 && col === 1) {
            score += 2; // Bonus for center
        }
        
        // Restore board
        game.field[row][col] = null;
        
        return Math.min(score, 50); // Cap at 50 for normalization
    }

    // Count threats (two in a row with one empty)
    countThreats(game, symbol) {
        let count = 0;
        const lines = [
            // rows
            [[0,0],[0,1],[0,2]], [[1,0],[1,1],[1,2]], [[2,0],[2,1],[2,2]],
            // cols
            [[0,0],[1,0],[2,0]], [[0,1],[1,1],[2,1]], [[0,2],[1,2],[2,2]],
            // diags
            [[0,0],[1,1],[2,2]], [[0,2],[1,1],[2,0]]
        ];
        
        for (const line of lines) {
            const values = line.map(([r, c]) => game.field[r][c]);
            const symbolCount = values.filter(v => v === symbol).length;
            const emptyCount = values.filter(v => v === null).length;
            if (symbolCount === 2 && emptyCount === 1) {
                count++;
            }
        }
        return count;
    }

    // Count fork opportunities (moves that create multiple threats)
    countForkOpportunities(game, symbol) {
        let forkCount = 0;
        const availableMoves = this.getAvailableMoves(game);
        
        for (const move of availableMoves) {
            game.field[move.row][move.col] = symbol;
            const threats = this.countThreats(game, symbol);
            if (threats >= 2) {
                forkCount++;
            }
            game.field[move.row][move.col] = null;
        }
        
        return forkCount;
    }

    // Get position value (center is best, then corners, then edges)
    getPositionValue(move) {
        const center = { row: 1, col: 1 };
        const corners = [
            { row: 0, col: 0 }, { row: 0, col: 2 },
            { row: 2, col: 0 }, { row: 2, col: 2 }
        ];
        
        if (move.row === center.row && move.col === center.col) {
            return 3; // Center is most valuable
        }
        
        if (corners.some(c => c.row === move.row && c.col === move.col)) {
            return 2; // Corners are good
        }
        
        return 1; // Edges are least valuable
    }

    // Get best move with slight variety to avoid loops
    getBestMoveWithVariety(game, availableMoves, varietyRate) {
        // Always use minimax to find best moves
        let bestScore = -Infinity;
        const bestMoves = [];
        const goodMoves = [];

        for (const move of availableMoves) {
            const { row, col } = move;
            game.field[row][col] = this.symbol;
            const score = this.minimax(game, 0, false, -Infinity, Infinity);
            game.field[row][col] = null;

            if (score > bestScore) {
                bestScore = score;
                bestMoves.length = 0;
                bestMoves.push(move);
                goodMoves.length = 0;
                goodMoves.push(move);
            } else if (score === bestScore) {
                bestMoves.push(move);
                goodMoves.push(move);
            } else if (score >= bestScore - 3) {
                // Include moves that are almost as good (reduced threshold)
                goodMoves.push(move);
            }
        }

        // Filter out recently used moves to prevent loops
        const recentMoveKeys = this.recentMoves.map(m => `${m.row}_${m.col}`);
        const filteredBestMoves = bestMoves.filter(m => !recentMoveKeys.includes(`${m.row}_${m.col}`));
        const filteredGoodMoves = goodMoves.filter(m => !recentMoveKeys.includes(`${m.row}_${m.col}`));

        // Use filtered moves if available, otherwise use all moves
        const finalBestMoves = filteredBestMoves.length > 0 ? filteredBestMoves : bestMoves;
        const finalGoodMoves = filteredGoodMoves.length > 0 ? filteredGoodMoves : goodMoves;

        // Add variety: occasionally pick from good moves instead of only best
        if (Math.random() < varietyRate && finalGoodMoves.length > finalBestMoves.length) {
            const prioritized = this.prioritizeMoves(finalGoodMoves);
            const selected = prioritized[0];
            this.trackMove(selected);
            return selected;
        }

        // Otherwise, prioritize among best moves
        if (finalBestMoves.length > 1) {
            const prioritized = this.prioritizeMoves(finalBestMoves);
            const selected = prioritized[0];
            this.trackMove(selected);
            return selected;
        }

        const selected = finalBestMoves[0];
        this.trackMove(selected);
        return selected;
    }

    // Track move to prevent loops
    trackMove(move) {
        this.recentMoves.push({ row: move.row, col: move.col });
        if (this.recentMoves.length > this.maxRecentMoves) {
            this.recentMoves.shift(); // Remove oldest move
        }
    }

    // Get RL-enhanced move (combines learning with strategy)
    getRLEnhancedMove(game, availableMoves, useExploration) {
        if (!this.rlAgent) return this.getBestMove(game);
        
        // Use RL agent to choose best move
        const rlMove = this.rlAgent.getBestRLMove(game, availableMoves, true);
        return rlMove || this.getBestMove(game);
    }

    // Get RL-optimized perfect move
    getRLPerfectMove(game, availableMoves) {
        if (!this.rlAgent) return this.getPerfectMove(game);
        
        // Combine perfect minimax with RL-learned patterns
        let bestScore = -Infinity;
        const bestMoves = [];

        for (const move of availableMoves) {
            const { row, col } = move;
            game.field[row][col] = this.symbol;
            const minimaxScore = this.minimax(game, 0, false, -Infinity, Infinity);
            
            // Get RL Q-value for this state-action
            const state = this.rlAgent.getStateKey(game, true);
            const qValue = this.rlAgent.getQValue(state, move);
            
            // Normalize Q-value
            const normalizedQ = qValue * 0.3;
            
            // Combine: 90% minimax (optimal), 10% RL (learned patterns for tie-breaking)
            // This ensures perfect play while using RL for optimization
            const combinedScore = (minimaxScore * 0.9) + (normalizedQ * 0.1);
            
            game.field[row][col] = null;

            if (combinedScore > bestScore) {
                bestScore = combinedScore;
                bestMoves.length = 0;
                bestMoves.push(move);
            } else if (Math.abs(combinedScore - bestScore) < 0.5) {
                // Consider moves with very close scores
                bestMoves.push(move);
            }
        }

        // Prioritize among best moves
        if (bestMoves.length > 1) {
            const prioritized = this.prioritizeMoves(bestMoves);
            return prioritized[0];
        }

        return bestMoves[0] || this.getPerfectMove(game);
    }

    // Record move for RL learning
    recordMoveForRL(game, move) {
        if (!this.rlAgent || !move) return;
        
        const state = this.rlAgent.getStateKey(game, true);
        this.currentGameMoves.push({ state, move, gameState: JSON.parse(JSON.stringify(game.field)) });
    }

    // Learn from game result (call this after game ends)
    learnFromGame(result) {
        if (!this.rlAgent) return;
        
        // Determine result from AI's perspective
        let aiResult = 'draw';
        if (result === 'win') {
            aiResult = 'win';
        } else if (result === 'loss') {
            aiResult = 'loss';
        }
        
        // Record moves in RL agent
        for (const { state, move } of this.currentGameMoves) {
            this.rlAgent.recordMove(state, move);
        }
        
        // Learn from the game
        this.rlAgent.learnFromGame(aiResult, this.symbol);
        
        // Clear current game moves and recent moves for next game
        this.currentGameMoves = [];
        this.recentMoves = [];
    }

    getRandomMove(game) {
        const availableMoves = this.getAvailableMoves(game);
        if (availableMoves.length === 0) return null;
        return availableMoves[Math.floor(Math.random() * availableMoves.length)];
    }

    getMediumMove(game) {
        // Deprecated in favor of diversified logic in getMove
        return this.getBestMove(game);
    }

    // Choose varied openings by style
    getVariedOpening(game) {
        const availableMoves = this.getAvailableMoves(game);
        if (availableMoves.length === 0) return null;

        const center = { row: 1, col: 1 };
        const corners = [
            { row: 0, col: 0 }, { row: 0, col: 2 },
            { row: 2, col: 0 }, { row: 2, col: 2 }
        ].filter(m => !game.field[m.row][m.col]);
        const edges = [
            { row: 0, col: 1 }, { row: 1, col: 0 },
            { row: 1, col: 2 }, { row: 2, col: 1 }
        ].filter(m => !game.field[m.row][m.col]);

        if (this.style === 'corner' && corners.length) {
            return corners[Math.floor(Math.random() * corners.length)];
        }

        if (this.style === 'aggressive') {
            // Prefer center then corners
            if (!game.field[center.row][center.col]) return center;
            if (corners.length) return corners[Math.floor(Math.random() * corners.length)];
        }

        if (this.style === 'defensive') {
            // Prefer opposite of opponent's first move if present
            const opp = this.findOpponentFirstMove(game);
            if (opp) {
                const opposite = { row: 2 - opp.row, col: 2 - opp.col };
                if (!game.field[opposite.row][opposite.col]) return opposite;
            }
            if (!game.field[center.row][center.col]) return center;
            if (edges.length) return edges[Math.floor(Math.random() * edges.length)];
        }

        // Balanced: random among center > corners > edges
        if (!game.field[center.row][center.col] && Math.random() < 0.7) return center;
        if (corners.length && Math.random() < 0.7) return corners[Math.floor(Math.random() * corners.length)];
        if (edges.length) return edges[Math.floor(Math.random() * edges.length)];
        return this.getRandomMove(game);
    }

    findOpponentFirstMove(game) {
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                if (game.field[r][c] === this.opponentSymbol) return { row: r, col: c };
            }
        }
        return null;
    }

    getBestMove(game) {
        const availableMoves = this.getAvailableMoves(game);
        if (availableMoves.length === 0) return null;

        let bestScore = -Infinity;
        const bestMoves = [];

        for (const move of availableMoves) {
            const { row, col } = move;
            game.field[row][col] = this.symbol;
            const score = this.minimax(game, 0, false, -Infinity, Infinity);
            game.field[row][col] = null;

            if (score > bestScore) {
                bestScore = score;
                bestMoves.length = 0;
                bestMoves.push(move);
            } else if (score === bestScore) {
                bestMoves.push(move);
            }
        }

        // If multiple best moves, prefer strategic positions
        if (bestMoves.length > 1) {
            const strategicMoves = this.filterStrategicMoves(game, bestMoves);
            if (strategicMoves.length > 0) {
                return strategicMoves[Math.floor(Math.random() * strategicMoves.length)];
            }
        }

        return bestMoves[Math.floor(Math.random() * bestMoves.length)];
    }

    getPerfectMove(game) {
        // Perfect minimax - always chooses the optimal move
        const availableMoves = this.getAvailableMoves(game);
        if (availableMoves.length === 0) return null;

        let bestScore = -Infinity;
        const bestMoves = [];

        for (const move of availableMoves) {
            const { row, col } = move;
            game.field[row][col] = this.symbol;
            const score = this.minimax(game, 0, false, -Infinity, Infinity);
            game.field[row][col] = null;

            if (score > bestScore) {
                bestScore = score;
                bestMoves.length = 0;
                bestMoves.push(move);
            } else if (score === bestScore) {
                bestMoves.push(move);
            }
        }

        // Filter out recently used moves to prevent loops
        const recentMoveKeys = this.recentMoves.map(m => `${m.row}_${m.col}`);
        const filteredBestMoves = bestMoves.filter(m => !recentMoveKeys.includes(`${m.row}_${m.col}`));
        const movesToUse = filteredBestMoves.length > 0 ? filteredBestMoves : bestMoves;

        // Among equally optimal moves, prefer center, then corners, then edges
        const prioritized = this.prioritizeMoves(movesToUse);
        return prioritized[0];
    }

    prioritizeMoves(moves) {
        const center = { row: 1, col: 1 };
        const corners = [
            { row: 0, col: 0 }, { row: 0, col: 2 },
            { row: 2, col: 0 }, { row: 2, col: 2 }
        ];
        const edges = [
            { row: 0, col: 1 }, { row: 1, col: 0 },
            { row: 1, col: 2 }, { row: 2, col: 1 }
        ];

        const centerMove = moves.find(m => m.row === center.row && m.col === center.col);
        if (centerMove) return [centerMove, ...moves.filter(m => m !== centerMove)];

        const cornerMoves = moves.filter(m => 
            corners.some(c => c.row === m.row && c.col === m.col)
        );
        if (cornerMoves.length > 0) {
            return [...cornerMoves, ...moves.filter(m => !cornerMoves.includes(m))];
        }

        return moves;
    }

    filterStrategicMoves(game, moves) {
        const center = { row: 1, col: 1 };
        const corners = [
            { row: 0, col: 0 }, { row: 0, col: 2 },
            { row: 2, col: 0 }, { row: 2, col: 2 }
        ];

        // Prefer center
        const centerMove = moves.find(m => m.row === center.row && m.col === center.col);
        if (centerMove) return [centerMove];

        // Then prefer corners
        const cornerMoves = moves.filter(m => 
            corners.some(c => c.row === m.row && c.col === m.col)
        );
        if (cornerMoves.length > 0) return cornerMoves;

        return moves;
    }

    applyStyleBias(game, candidates) {
        if (!candidates.length) return candidates;
        if (this.style === 'corner') {
            const cornerCoords = new Set(['0,0','0,2','2,0','2,2']);
            const cornerFav = candidates.filter(c => cornerCoords.has(`${c.move.row},${c.move.col}`));
            if (cornerFav.length) return cornerFav;
        }
        if (this.style === 'aggressive') {
            // prefer moves that create two-in-a-row potential next turn
            const fav = candidates.filter(c => this.createsThreat(game, c.move, this.symbol));
            if (fav.length) return fav;
        }
        if (this.style === 'defensive') {
            // prefer moves that reduce opponent threats
            const fav = candidates.filter(c => this.blocksThreat(game, c.move, this.opponentSymbol));
            if (fav.length) return fav;
        }
        return candidates;
    }

    createsThreat(game, move, symbol) {
        game.field[move.row][move.col] = symbol;
        const threats = this.countTwoInRowThreats(game, symbol);
        game.field[move.row][move.col] = null;
        return threats >= 1;
    }

    blocksThreat(game, move, opp) {
        // simulate opponent potential without the move
        const before = this.countTwoInRowThreats(game, opp);
        game.field[move.row][move.col] = this.symbol;
        const after = this.countTwoInRowThreats(game, opp);
        game.field[move.row][move.col] = null;
        return after < before;
    }

    countTwoInRowThreats(game, symbol) {
        let count = 0;
        const lines = [
            // rows
            [{r:0,c:0},{r:0,c:1},{r:0,c:2}],
            [{r:1,c:0},{r:1,c:1},{r:1,c:2}],
            [{r:2,c:0},{r:2,c:1},{r:2,c:2}],
            // cols
            [{r:0,c:0},{r:1,c:0},{r:2,c:0}],
            [{r:0,c:1},{r:1,c:1},{r:2,c:1}],
            [{r:0,c:2},{r:1,c:2},{r:2,c:2}],
            // diags
            [{r:0,c:0},{r:1,c:1},{r:2,c:2}],
            [{r:0,c:2},{r:1,c:1},{r:2,c:0}],
        ];
        for (const line of lines) {
            const vals = line.map(p => game.field[p.r][p.c]);
            const numSym = vals.filter(v => v === symbol).length;
            const numEmpty = vals.filter(v => v === null).length;
            if (numSym === 2 && numEmpty === 1) count++;
        }
        return count;
    }

    minimax(game, depth, isMaximizing, alpha, beta) {
        // Check for terminal states
        const winner = game.getWinner();
        if (winner === this.symbol) {
            // AI wins - return positive score (prefer shorter paths)
            return 100 - depth;
        }
        if (winner === this.opponentSymbol) {
            // Opponent wins - return negative score
            return depth - 100;
        }
        if (game.isDraw()) {
            return 0;
        }

        if (isMaximizing) {
            // AI's turn - maximize score
            let maxScore = -Infinity;
            const availableMoves = this.getAvailableMoves(game);
            
            // Optimize: check for immediate wins first
            for (const move of availableMoves) {
                const { row, col } = move;
                game.field[row][col] = this.symbol;
                
                // Quick win check
                if (game.getWinner() === this.symbol) {
                    game.field[row][col] = null;
                    return 100 - depth;
                }
                
                const score = this.minimax(game, depth + 1, false, alpha, beta);
                game.field[row][col] = null;
                
                maxScore = Math.max(maxScore, score);
                alpha = Math.max(alpha, score);
                
                // Alpha-beta pruning
                if (beta <= alpha) break;
            }
            return maxScore;
        } else {
            // Opponent's turn - minimize score
            let minScore = Infinity;
            const availableMoves = this.getAvailableMoves(game);
            
            // Optimize: check for immediate blocks first
            for (const move of availableMoves) {
                const { row, col } = move;
                game.field[row][col] = this.opponentSymbol;
                
                // Quick loss check
                if (game.getWinner() === this.opponentSymbol) {
                    game.field[row][col] = null;
                    return depth - 100;
                }
                
                const score = this.minimax(game, depth + 1, true, alpha, beta);
                game.field[row][col] = null;
                
                minScore = Math.min(minScore, score);
                beta = Math.min(beta, score);
                
                // Alpha-beta pruning
                if (beta <= alpha) break;
            }
            return minScore;
        }
    }

    getAvailableMoves(game) {
        const moves = [];
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                if (!game.field[row][col]) {
                    moves.push({ row, col });
                }
            }
        }
        return moves;
    }

    // Check if there's a winning move available
    getWinningMove(game, symbol) {
        const availableMoves = this.getAvailableMoves(game);
        for (const move of availableMoves) {
            const { row, col } = move;
            game.field[row][col] = symbol;
            if (game.getWinner() === symbol) {
                game.field[row][col] = null;
                return move;
            }
            game.field[row][col] = null;
        }
        return null;
    }

    // Get blocking move (prevent opponent from winning)
    getBlockingMove(game) {
        return this.getWinningMove(game, this.opponentSymbol);
    }

    // Block opponent's immediate threat (2 in a row that would win next turn)
    getBlockingThreatMove(game) {
        const availableMoves = this.getAvailableMoves(game);
        const lines = [
            // rows
            [[0,0],[0,1],[0,2]], [[1,0],[1,1],[1,2]], [[2,0],[2,1],[2,2]],
            // cols
            [[0,0],[1,0],[2,0]], [[0,1],[1,1],[2,1]], [[0,2],[1,2],[2,2]],
            // diags
            [[0,0],[1,1],[2,2]], [[0,2],[1,1],[2,0]]
        ];

        // Check each line for opponent having 2 in a row with 1 empty
        for (const line of lines) {
            const values = line.map(([r, c]) => ({
                row: r,
                col: c,
                value: game.field[r][c]
            }));
            
            const opponentCount = values.filter(v => v.value === this.opponentSymbol).length;
            const emptyCount = values.filter(v => v.value === null).length;
            const aiCount = values.filter(v => v.value === this.symbol).length;
            
            // If opponent has 2 and there's 1 empty (and AI doesn't have any), block it!
            if (opponentCount === 2 && emptyCount === 1 && aiCount === 0) {
                // Find the empty cell in this line and block it
                const emptyCell = values.find(v => v.value === null);
                if (emptyCell) {
                    const blockingMove = { row: emptyCell.row, col: emptyCell.col };
                    // Verify this move is available
                    if (availableMoves.some(m => m.row === blockingMove.row && m.col === blockingMove.col)) {
                        return blockingMove;
                    }
                }
            }
        }
        
        return null;
    }

    // Get corner move (strategic)
    getCornerMove(game) {
        const corners = [{ row: 0, col: 0 }, { row: 0, col: 2 }, { row: 2, col: 0 }, { row: 2, col: 2 }];
        const availableCorners = corners.filter(corner => !game.field[corner.row][corner.col]);
        if (availableCorners.length > 0) {
            return availableCorners[Math.floor(Math.random() * availableCorners.length)];
        }
        return null;
    }

    // Get center move
    getCenterMove(game) {
        if (!game.field[1][1]) {
            return { row: 1, col: 1 };
        }
        return null;
    }

    // Enhanced move selection with strategic priorities
    getStrategicMove(game) {
        // 1. Check for winning move (already checked in getMove, but keep for safety)
        const winningMove = this.getWinningMove(game, this.symbol);
        if (winningMove) return winningMove;

        // 2. Check for blocking move (already checked in getMove, but keep for safety)
        const blockingMove = this.getBlockingMove(game);
        if (blockingMove) return blockingMove;

        // 3. Create a fork (two winning opportunities)
        const forkMove = this.getForkMove(game);
        if (forkMove) return forkMove;

        // 4. Block opponent's fork
        const blockForkMove = this.getBlockForkMove(game);
        if (blockForkMove) return blockForkMove;

        // 5. Try to take center (most strategic position)
        const centerMove = this.getCenterMove(game);
        if (centerMove) return centerMove;

        // 6. Take opposite corner if opponent has a corner
        const oppositeCornerMove = this.getOppositeCornerMove(game);
        if (oppositeCornerMove) return oppositeCornerMove;

        // 7. Try to take corners (strategic positions)
        const cornerMove = this.getCornerMove(game);
        if (cornerMove) return cornerMove;

        // 8. Take any available edge
        const edges = [{ row: 0, col: 1 }, { row: 1, col: 0 }, { row: 1, col: 2 }, { row: 2, col: 1 }];
        const availableEdges = edges.filter(edge => !game.field[edge.row][edge.col]);
        if (availableEdges.length > 0) {
            return availableEdges[Math.floor(Math.random() * availableEdges.length)];
        }

        // 9. Fallback to random move
        return this.getRandomMove(game);
    }

    // Check if a move creates a fork (two winning opportunities)
    getForkMove(game) {
        const availableMoves = this.getAvailableMoves(game);
        for (const move of availableMoves) {
            const { row, col } = move;
            game.field[row][col] = this.symbol;
            
            // Count how many winning moves this creates for next turn
            const winningMoves = this.countWinningOpportunities(game, this.symbol);
            game.field[row][col] = null;
            
            if (winningMoves >= 2) {
                return move;
            }
        }
        return null;
    }

    // Block opponent's fork
    getBlockForkMove(game) {
        const availableMoves = this.getAvailableMoves(game);
        for (const move of availableMoves) {
            const { row, col } = move;
            game.field[row][col] = this.opponentSymbol;
            
            // Check if opponent would have a fork
            const opponentWinningMoves = this.countWinningOpportunities(game, this.opponentSymbol);
            game.field[row][col] = null;
            
            if (opponentWinningMoves >= 2) {
                // Block by taking this position
                return move;
            }
        }
        return null;
    }

    // Count winning opportunities (moves that would create a win)
    countWinningOpportunities(game, symbol) {
        let count = 0;
        const availableMoves = this.getAvailableMoves(game);
        for (const move of availableMoves) {
            const { row, col } = move;
            game.field[row][col] = symbol;
            if (game.getWinner() === symbol) {
                count++;
            }
            game.field[row][col] = null;
        }
        return count;
    }

    // Get opposite corner move
    getOppositeCornerMove(game) {
        const corners = [
            { row: 0, col: 0, opposite: { row: 2, col: 2 } },
            { row: 0, col: 2, opposite: { row: 2, col: 0 } },
            { row: 2, col: 0, opposite: { row: 0, col: 2 } },
            { row: 2, col: 2, opposite: { row: 0, col: 0 } }
        ];

        for (const corner of corners) {
            // If opponent has this corner and opposite is empty
            if (game.field[corner.row][corner.col] === this.opponentSymbol &&
                !game.field[corner.opposite.row][corner.opposite.col]) {
                return corner.opposite;
            }
        }
        return null;
    }
}

// Export for use in other modules
window.AIPlayer = AIPlayer; 