// Global game state
let gameState = {
    currentScreen: 'main-menu',
    gameMode: null,
    difficulty: 'easy',
    playerSymbol: 'x',
    firstTurn: 'player', // 'player' | 'ai'
    game: null,
    aiPlayer: null,
    onlineGame: null,
    scores: { x: 0, o: 0 },
    confettiFired: false,
    roomCode: null,
    roomName: ''
};

// DOM elements
const elements = {
    screens: {},
    board: null,
    status: null,
    statusText: null,
    resetBtn: null,
    newGameBtn: null,
    menuBtn: null,
    scoreX: null,
    scoreO: null,
    gameModeBadge: null,
    difficultyBadge: null,
    loadingModal: null,
    loadingText: null,
    createdRoomWrap: null,
    createdRoomCode: null,
    joinCodeInput: null,
    roomNameInput: null,
    roomNameBadge: null,
    roomNameText: null
};

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    initializeElements();
    setupEventListeners();
    showMainMenu();
});

function initializeElements() {
    // Initialize screen elements
    elements.screens = {
        'main-menu': document.getElementById('main-menu'),
        'computer-setup': document.getElementById('computer-setup'),
        'online-setup': document.getElementById('online-setup'),
        'game-screen': document.getElementById('game-screen')
    };

    // Initialize game elements
    elements.board = document.getElementById('board');
    elements.status = document.getElementById('status');
    elements.statusText = document.getElementById('status-text');
    elements.resetBtn = document.getElementById('reset-btn');
    elements.newGameBtn = document.getElementById('new-game-btn');
    elements.menuBtn = document.getElementById('menu-btn');
    elements.scoreX = document.getElementById('score-x');
    elements.scoreO = document.getElementById('score-o');
    elements.gameModeBadge = document.getElementById('game-mode-badge');
    elements.difficultyBadge = document.getElementById('difficulty-badge');
    elements.loadingModal = new bootstrap.Modal(document.getElementById('loadingModal'));
    elements.loadingText = document.getElementById('loading-text');

    // Online UI elements
    elements.createdRoomWrap = document.getElementById('created-room');
    elements.createdRoomCode = document.getElementById('created-room-code');
    elements.joinCodeInput = document.getElementById('join-code');
    elements.roomNameInput = document.getElementById('room-name');
    elements.roomNameBadge = document.getElementById('room-name-badge');
    elements.roomNameText = document.getElementById('room-name-text');

    // Rematch modal
    const rematchModalEl = document.getElementById('rematchModal');
    elements.rematchModal = rematchModalEl ? new bootstrap.Modal(rematchModalEl) : null;
    elements.rematchYes = document.getElementById('rematch-yes');
    elements.rematchNo = document.getElementById('rematch-no');
}

function setupEventListeners() {
    // Button event listeners
    elements.resetBtn.addEventListener('click', resetGame);
    elements.newGameBtn.addEventListener('click', newGame);
    elements.menuBtn.addEventListener('click', showMainMenu);

    // Difficulty and player selection
    document.querySelectorAll('.difficulty-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.difficulty-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            gameState.difficulty = e.currentTarget.dataset.difficulty;
        });
    });

    document.querySelectorAll('.player-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.player-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            gameState.playerSymbol = e.currentTarget.dataset.player;
        });
    });

    // First turn selection
    document.querySelectorAll('.first-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.first-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            gameState.firstTurn = e.currentTarget.dataset.first; // 'player' or 'ai'
        });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);

    // Rematch buttons
    if (elements.rematchYes) {
        elements.rematchYes.addEventListener('click', handleRematchYes);
    }
    if (elements.rematchNo) {
        elements.rematchNo.addEventListener('click', handleRematchNo);
    }
}

// Screen management
function showScreen(screenName) {
    Object.values(elements.screens).forEach(screen => {
        screen.classList.remove('active');
    });
    elements.screens[screenName].classList.add('active');
    gameState.currentScreen = screenName;
}

function showMainMenu() {
    showScreen('main-menu');
    if (gameState.onlineGame) {
        gameState.onlineGame.disconnect();
        gameState.onlineGame = null;
    }
    // Clear created/join UI
    if (elements.createdRoomWrap) elements.createdRoomWrap.classList.add('d-none');
    if (elements.createdRoomCode) elements.createdRoomCode.textContent = '';
    if (elements.joinCodeInput) elements.joinCodeInput.value = '';
    gameState.roomName = '';
    if (elements.roomNameInput) elements.roomNameInput.value = '';
    if (elements.roomNameBadge) elements.roomNameBadge.classList.add('d-none');
    if (elements.roomNameText) elements.roomNameText.textContent = '';
}

// Game mode selection
function showGameMode(mode) {
    gameState.gameMode = mode;

    switch (mode) {
        case 'computer':
            showScreen('computer-setup');
            break;
        case 'friend':
            startFriendGame();
            break;
        case 'online':
            showScreen('online-setup');
            break;
        case 'tournament':
            showTournamentMode();
            break;
    }
}

// Helper to compute starting symbol for a new local game
function getStartingSymbolForLocalGame() {
    if (gameState.gameMode !== 'computer') {
        return 'x';
    }
    const aiSymbol = gameState.playerSymbol === 'x' ? 'o' : 'x';
    return gameState.firstTurn === 'player' ? gameState.playerSymbol : aiSymbol;
}

// Computer game functions
function startComputerGame() {
    showLoadingModal('Setting up AI opponent...');

    setTimeout(() => {
        elements.loadingModal.hide();

        gameState.gameMode = 'computer';

        // Initialize AI player (new style each start)
        gameState.aiPlayer = new window.AIPlayer(gameState.difficulty);
        const aiSymbol = gameState.playerSymbol === 'x' ? 'o' : 'x';
        gameState.aiPlayer.setSymbol(aiSymbol);

        // Initialize game honoring first-turn choice
        const startingSymbol = getStartingSymbolForLocalGame();
        gameState.game = new window.TicTacToe(startingSymbol);

        // Update UI
        updateGameModeDisplay();
        showScreen('game-screen');
        renderBoard();
        updateStatus();

        // If AI goes first
        if (startingSymbol === aiSymbol) {
            setTimeout(() => {
                makeAIMove();
            }, 500);
        }
    }, 600);
}

function makeAIMove() {
    if (!gameState.aiPlayer || !gameState.game || gameState.game.isFinished()) return;

    const move = gameState.aiPlayer.getMove(gameState.game);
    if (move) {
        gameState.game.nextTurn(move.row, move.col);
        renderBoard();
        updateStatus();
    }
}

// Friend game functions
function startFriendGame() {
    gameState.game = new window.TicTacToe('x');
    gameState.gameMode = 'friend';
    updateGameModeDisplay();
    showScreen('game-screen');
    renderBoard();
    updateStatus();
}

// Online game functions
function createRoom() {
    const roomNameInputVal = (elements.roomNameInput?.value || '').trim();
    gameState.roomName = roomNameInputVal || 'Friend Game';

    showLoadingModal('Connecting to global server...');

    gameState.onlineGame = new window.OnlineGame();
    // Connect as Host (true) to generate 6-digit ID
    gameState.onlineGame.connect(gameState.roomName, true).then((id) => {
        elements.loadingText.textContent = 'Creating room...';
        return gameState.onlineGame.createRoom(gameState.roomName);
    }).then((room) => {
        elements.loadingModal.hide();
        // Store code and name for reference
        gameState.roomCode = room.code;
        gameState.gameMode = 'online';

        // Show the code to the user
        if (elements.createdRoomWrap) elements.createdRoomWrap.classList.remove('d-none');
        if (elements.createdRoomCode) {
            elements.createdRoomCode.textContent = room.code;
            // Add click-to-copy
            elements.createdRoomCode.onclick = () => {
                navigator.clipboard.writeText(room.code).then(() => {
                    alert('Room Code copied to clipboard!');
                });
            };
        }

        updateGameModeDisplay();
        setupOnlineGameCallbacks();

        // Move straight to the game screen and show waiting state
        showScreen('game-screen');
        gameState.game = room.game;
        renderBoard();

        // Show room name badge
        if (elements.roomNameBadge && elements.roomNameText) {
            elements.roomNameBadge.classList.remove('d-none');
            elements.roomNameText.textContent = gameState.roomName;
        }

        // Show waiting message with code
        if (elements.status && elements.statusText) {
            elements.status.className = 'alert alert-info text-center mb-4 shadow-sm border-0';
            const icon = elements.status.querySelector('i');
            if (icon) icon.className = 'fas fa-hourglass-half me-2';
            elements.statusText.innerHTML = `Waiting for opponent...<br><small>Share Code: <strong>${room.code}</strong></small>`;
        }
    }).catch((error) => {
        elements.loadingModal.hide();
        alert('Error creating room: ' + error.message);
    });
}

function joinRoomByCode() {
    const code = (elements.joinCodeInput?.value || '').trim();
    if (code.length < 1) {
        alert('Please enter a valid Room Code');
        return;
    }

    // Ask for a display name for joining
    const displayName = prompt('Enter your display name:')?.trim() || 'Guest';

    showLoadingModal('Connecting to room...');

    gameState.onlineGame = new window.OnlineGame();
    gameState.onlineGame.connect(displayName).then(() => {
        return gameState.onlineGame.joinRoomByCode(code);
    }).then((room) => {
        // Room info might be sparse until handshake completes, handled in callbacks
        elements.loadingModal.hide();
        showScreen('game-screen');
        gameState.gameMode = 'online';
        updateGameModeDisplay();
        setupOnlineGameCallbacks();

        // Initial state
        renderBoard();
        updateStatus();
    }).catch((error) => {
        elements.loadingModal.hide();
        alert('Error joining room: ' + error.message);
    });
}

function findRandom() {
    alert('Random matchmaking is coming soon!');
}

function startOnlineGame() {
    if (!gameState.onlineGame || !gameState.onlineGame.getCurrentRoom()) {
        alert('Create a room first, share the code, and wait for your friend to join.');
        return;
    }
    alert('Waiting for opponent to join...');
}

function setupOnlineGameCallbacks() {
    if (!gameState.onlineGame) return;

    gameState.onlineGame.on('roomCreated', (data) => {
        // Already shown code in UI
        console.log('Room created with code:', data.code);
    });

    gameState.onlineGame.on('playerJoined', (player) => {
        // Transition to game when second player arrives
        showScreen('game-screen');
        gameState.gameMode = 'online';
        updateGameModeDisplay();
        // Ensure room name badge remains visible
        if (elements.roomNameBadge && elements.roomNameText && gameState.roomName) {
            elements.roomNameBadge.classList.remove('d-none');
            elements.roomNameText.textContent = gameState.roomName;
        }
    });

    gameState.onlineGame.on('gameStart', (room) => {
        gameState.game = room.game;
        // Capture room name from room object as truth source
        gameState.roomName = room.name || gameState.roomName;
        if (elements.roomNameBadge && elements.roomNameText && gameState.roomName) {
            elements.roomNameBadge.classList.remove('d-none');
            elements.roomNameText.textContent = gameState.roomName;
        }
        renderBoard();
        updateStatus();
    });

    gameState.onlineGame.on('moveMade', (data) => {
        gameState.game = data.room.game;
        renderBoard();
        updateStatus();
    });

    gameState.onlineGame.on('gameEnd', (data) => {
        gameState.game = data.room.game;
        renderBoard();
        updateStatus();
    });

    gameState.onlineGame.on('messageReceived', (message) => {
        console.log(`${message.playerName}: ${message.message}`);
    });

    // When rematch starts remotely
    gameState.onlineGame.on('rematchStarted', ({ room }) => {
        gameState.game = room.game;
        renderBoard();
        updateStatus();
        if (elements.rematchModal) elements.rematchModal.hide();
    });
}

// Tournament mode (placeholder)
function showTournamentMode() {
    alert('Tournament mode coming soon!');
}

// Game logic
function renderBoard() {
    if (!gameState.game) return;

    elements.board.innerHTML = '';
    const win = getWinningLine();

    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
            const cell = document.createElement('div');
            cell.className = 'cell shadow';
            const value = gameState.game.getFieldValue(row, col);

            if (value) {
                cell.textContent = value.toUpperCase();
                cell.classList.add(value, 'disabled');
            }

            cell.dataset.row = row;
            cell.dataset.col = col;

            if (!value && !gameState.game.isFinished()) {
                cell.onclick = onCellClick;
            } else {
                cell.classList.add('disabled');
            }

            if (win && (
                (win[0] === 'row' && row === win[1]) ||
                (win[0] === 'col' && col === win[1]) ||
                (win[0] === 'diag' && win[1] === 'main' && row === col) ||
                (win[0] === 'diag' && win[1] === 'anti' && row + col === 2)
            )) {
                cell.classList.add('winner');
            }

            elements.board.appendChild(cell);
        }
    }
}

function getWinningLine() {
    if (!gameState.game) return null;

    const b = gameState.game.field, w = gameState.game.getWinner();
    if (!w) return null;

    for (let i = 0; i < 3; i++) {
        if (b[i][0] === w && b[i][1] === w && b[i][2] === w) return ['row', i];
        if (b[0][i] === w && b[1][i] === w && b[2][i] === w) return ['col', i];
    }

    if (b[0][0] === w && b[1][1] === w && b[2][2] === w) return ['diag', 'main'];
    if (b[0][2] === w && b[1][1] === w && b[2][0] === w) return ['diag', 'anti'];

    return null;
}

function updateStatus() {
    if (!gameState.game) return;

    const statusIcon = elements.status.querySelector('i');

    if (gameState.game.getWinner()) {
        const winner = gameState.game.getWinner().toUpperCase();
        elements.statusText.textContent = `🎉 Player ${winner} wins!`;
        elements.status.className = 'alert alert-success text-center mb-4 shadow-sm border-0';
        statusIcon.className = 'fas fa-trophy me-2';

        // Update score
        gameState.scores[gameState.game.getWinner()]++;
        updateScoreDisplay();

        // Reinforcement Learning: Learn from game result
        if (gameState.gameMode === 'computer' && gameState.aiPlayer) {
            const aiSymbol = gameState.playerSymbol === 'x' ? 'o' : 'x';
            const result = gameState.game.getWinner() === aiSymbol ? 'win' : 'loss';
            gameState.aiPlayer.learnFromGame(result);
        }

        if (!gameState.confettiFired && window.confetti) {
            window.confetti({
                particleCount: 200,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57']
            });
            gameState.confettiFired = true;
        }
        maybeOfferRematch();
    } else if (gameState.game.isDraw()) {
        elements.statusText.textContent = "🤝 It's a draw!";
        elements.status.className = 'alert alert-warning text-center mb-4 shadow-sm border-0';
        statusIcon.className = 'fas fa-handshake me-2';
        gameState.confettiFired = false;

        // Reinforcement Learning: Learn from draw
        if (gameState.gameMode === 'computer' && gameState.aiPlayer) {
            gameState.aiPlayer.learnFromGame('draw');
        }

        maybeOfferRematch();
    } else {
        const currentPlayer = gameState.game.getCurrentPlayerSymbol().toUpperCase();
        elements.statusText.textContent = `Player ${currentPlayer}'s turn`;
        elements.status.className = 'alert alert-primary text-center mb-4 shadow-sm border-0';
        statusIcon.className = 'fas fa-play-circle me-2';
        gameState.confettiFired = false;
    }
}

function updateScoreDisplay() {
    elements.scoreX.textContent = gameState.scores.x;
    elements.scoreO.textContent = gameState.scores.o;

    // Add animation to score update
    elements.scoreX.style.transform = 'scale(1.2)';
    elements.scoreO.style.transform = 'scale(1.2)';
    setTimeout(() => {
        elements.scoreX.style.transform = 'scale(1)';
        elements.scoreO.style.transform = 'scale(1)';
    }, 200);
}

function onCellClick(e) {
    const row = +e.target.dataset.row, col = +e.target.dataset.col;

    if (gameState.gameMode === 'online') {
        // Online game
        if (gameState.onlineGame && gameState.onlineGame.isMyTurn()) {
            gameState.onlineGame.makeMove(row, col).then(() => {
                renderBoard();
                updateStatus();
            }).catch((error) => {
                console.log('Move error:', error.message);
            });
        }
    } else {
        // Local game (computer or friend)
        if (gameState.game && !gameState.game.isFinished()) {
            gameState.game.nextTurn(row, col);
            renderBoard();
            updateStatus();

            // If playing against AI and it's AI's turn
            if (gameState.gameMode === 'computer' && gameState.aiPlayer &&
                !gameState.game.isFinished()) {
                const aiSymbol = gameState.playerSymbol === 'x' ? 'o' : 'x';
                if (gameState.game.getCurrentPlayerSymbol() === aiSymbol) {
                    setTimeout(() => {
                        makeAIMove();
                    }, 500);
                }
            }
        }
    }
}

function resetGame() {
    if (gameState.gameMode === 'online') {
        // For online games, reset the current room's game
        if (gameState.onlineGame && gameState.onlineGame.getCurrentRoom()) {
            gameState.onlineGame.getCurrentRoom().game = new window.TicTacToe('x');
            gameState.game = gameState.onlineGame.getCurrentRoom().game;
        }
    } else if (gameState.gameMode === 'computer') {
        // Recreate AI to roll a fresh style each game
        gameState.aiPlayer = new window.AIPlayer(gameState.difficulty);
        const aiSymbol = gameState.playerSymbol === 'x' ? 'o' : 'x';
        gameState.aiPlayer.setSymbol(aiSymbol);

        // Honor first-turn choice and trigger AI if needed
        const startingSymbol = getStartingSymbolForLocalGame();
        gameState.game = new window.TicTacToe(startingSymbol);
        renderBoard();
        updateStatus();
        gameState.confettiFired = false;
        if (startingSymbol === aiSymbol) {
            setTimeout(() => {
                makeAIMove();
            }, 500);
        }
        return;
    } else {
        // For local friend games, start with X
        gameState.game = new window.TicTacToe('x');
    }

    renderBoard();
    updateStatus();
    gameState.confettiFired = false;
}

function newGame() {
    // Reset scores
    gameState.scores = { x: 0, o: 0 };
    updateScoreDisplay();
    resetGame();

    // Show success message
    elements.statusText.textContent = '🎮 New game started!';
    elements.status.className = 'alert alert-info text-center mb-4 shadow-sm border-0';
    elements.status.querySelector('i').className = 'fas fa-gamepad me-2';

    setTimeout(() => {
        updateStatus();
    }, 1200);
}

function updateGameModeDisplay() {
    const modeIcons = {
        'computer': 'fas fa-robot',
        'friend': 'fas fa-user-friends',
        'online': 'fas fa-globe'
    };

    const modeTexts = {
        'computer': 'vs Computer',
        'friend': 'vs Friend',
        'online': 'Online'
    };

    if (elements.gameModeBadge) {
        elements.gameModeBadge.innerHTML = `<i class="${modeIcons[gameState.gameMode]} me-1"></i>${modeTexts[gameState.gameMode]}`;
    }

    if (elements.difficultyBadge) {
        if (gameState.gameMode === 'computer') {
            elements.difficultyBadge.textContent = gameState.difficulty.charAt(0).toUpperCase() + gameState.difficulty.slice(1);
            elements.difficultyBadge.style.display = '';
        } else {
            elements.difficultyBadge.style.display = 'none';
        }
    }
}

function showLoadingModal(text) {
    elements.loadingText.textContent = text;
    elements.loadingModal.show();
}

function handleKeyboardShortcuts(e) {
    if (e.key === 'r' || e.key === 'R') {
        resetGame();
    } else if (e.key === 'n' || e.key === 'N') {
        newGame();
    } else if (e.key === 'Escape') {
        showMainMenu();
    }
}

function maybeOfferRematch() {
    // Only prompt for rematch in online multiplayer mode
    if (gameState.gameMode !== 'online') return;
    if (!elements.rematchModal) return;
    if (gameState.game && (gameState.game.getWinner() || gameState.game.isDraw())) {
        elements.rematchModal.show();
    }
}

function handleRematchYes() {
    if (gameState.gameMode === 'online') {
        if (gameState.onlineGame) {
            // Host accepts starts immediately; guest requests and waits
            gameState.onlineGame.acceptRematch().catch(() => { });
        }
    } else if (gameState.gameMode === 'computer') {
        // Preserve settings and restart; AI first if chosen
        resetGame();
    } else if (gameState.gameMode === 'friend') {
        // Restart local two-player game
        gameState.game = new window.TicTacToe('x');
        renderBoard();
        updateStatus();
    }
    if (elements.rematchModal) elements.rematchModal.hide();
}

function handleRematchNo() {
    if (elements.rematchModal) elements.rematchModal.hide();
}

// Global functions for HTML onclick handlers
window.showGameMode = showGameMode;
window.startComputerGame = startComputerGame;
window.startOnlineGame = startOnlineGame;
window.createRoom = createRoom;
window.joinRoomByCode = joinRoomByCode;
window.findRandom = findRandom;
window.showMainMenu = showMainMenu;
