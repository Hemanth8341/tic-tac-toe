class OnlineGame {
    constructor() {
        this.peer = null;
        this.conn = null;
        this.currentPlayer = null;
        this.currentRoom = null;
        this.gameCallbacks = {};
        this.pendingRematch = false;
        this.isHost = false;
    }

    // Initialize PeerJS connection
    // isHost: boolean - if true, tries to generate a 6-digit numeric ID
    async connect(playerName, isHost = false) {
        return new Promise((resolve, reject) => {
            const tryConnect = () => {
                let peerOptions = {};
                // If host, try to secure a 6-digit ID
                if (isHost) {
                    const id = Math.floor(100000 + Math.random() * 900000).toString();
                    peerOptions = {
                        debug: 2 // Print errors to console
                    };
                    // We try to pass the ID to the constructor
                    // Note: PeerJS checks this ID against the server
                    this.peer = new Peer(id, peerOptions);
                } else {
                    // Guest gets a random UUID
                    this.peer = new Peer();
                }

                this.peer.on('open', (id) => {
                    console.log('My peer ID is: ' + id);
                    this.currentPlayer = {
                        id: id,
                        name: playerName,
                        symbol: null
                    };
                    resolve(id);
                });

                this.peer.on('connection', (conn) => {
                    this.handleIncomingConnection(conn);
                });

                this.peer.on('error', (err) => {
                    if (isHost && err.type === 'unavailable-id') {
                        console.log('ID taken, retrying...');
                        this.peer.destroy();
                        tryConnect(); // Retry with new random ID
                    } else {
                        console.error('PeerJS error:', err);
                        // Only reject if it's a fatal error or we aren't retrying
                        if (!isHost || err.type !== 'unavailable-id') {
                            this.triggerCallback('error', err);
                            reject(err);
                        }
                    }
                });
            };

            tryConnect();
        });
    }

    handleIncomingConnection(conn) {
        // If we already have a connection, maybe reject or handle it?
        // For now, accept the first one.
        if (this.conn && this.conn.open) {
            conn.close();
            return;
        }

        this.conn = conn;
        this.setupConnectionHandlers();
    }

    setupConnectionHandlers() {
        this.conn.on('data', (data) => {
            this.handleData(data);
        });

        this.conn.on('open', () => {
            console.log('Connected to peer');
            // If I am the host, I should probably send the game start signal if ready
            if (this.isHost) {
                this.startGameAsHost();
            }
        });

        this.conn.on('close', () => {
            console.log('Connection closed');
            this.triggerCallback('peerDisconnected');
            this.leaveRoom();
        });

        this.conn.on('error', (err) => {
            console.error('Connection error:', err);
        });
    }

    handleData(data) {
        console.log('Received data:', data);
        switch (data.type) {
            case 'JOIN_REQUEST':
                // Remote player wants to join
                // In this simple P2P model, just connecting is "joining"
                // We can send back a welcome or game start
                this.triggerCallback('playerJoined', { name: data.playerName });
                break;
            case 'GAME_START':
                // Hydrate the game object
                this.currentRoom = data.room;
                this.currentRoom.game = this.hydrateGame(data.room.game);

                // If I am guest, I need to know my symbol
                this.currentPlayer.symbol = 'o';
                this.triggerCallback('gameStart', this.currentRoom);
                break;
            case 'MOVE':
                // Hydrate the fields or just update the game if exists
                if (this.currentRoom) {
                    // Start from fresh board or update existing
                    if (!this.currentRoom.game) {
                        this.currentRoom.game = new window.TicTacToe();
                    }
                    this.currentRoom.game.field = data.field;
                    this.currentRoom.game.currentPlayer = data.currentPlayer;
                    this.currentRoom.game.winner = data.winner;
                    this.currentRoom.game.finished = data.finished;
                    this.currentRoom.game.turns = data.turns;

                    this.triggerCallback('moveMade', { room: this.currentRoom });
                }
                break;
            case 'REMATCH_REQUEST':
                this.triggerCallback('rematchRequested');
                break;
            case 'REMATCH_ACCEPTED':
                // Reset game
                this.currentRoom.game = new window.TicTacToe('x');
                this.triggerCallback('rematchStarted', { room: this.currentRoom });
                break;
            case 'CHAT':
                this.triggerCallback('messageReceived', data.message);
                break;
        }
    }

    // Host creates a room (essentially waits for connection)
    hydrateGame(data) {
        if (!data) return new window.TicTacToe();
        const game = new window.TicTacToe();
        game.field = data.field;
        game.currentPlayer = data.currentPlayer;
        game.winner = data.winner;
        game.finished = data.finished;
        game.turns = data.turns;
        return game;
    }

    async createRoom(roomName) {
        this.isHost = true;
        this.currentPlayer.symbol = 'x';
        // Room ID is just my Peer ID
        const roomId = this.currentPlayer.id;

        this.currentRoom = {
            id: roomId,
            code: roomId, // The code is the Peer ID
            name: roomName,
            host: this.currentPlayer.id,
            game: new window.TicTacToe('x'),
            status: 'waiting'
        };

        this.triggerCallback('roomCreated', { code: roomId, room: this.currentRoom });
        return this.currentRoom;
    }

    // Guest joins a room
    async joinRoomByCode(code) {
        this.isHost = false;
        // Connect to the host
        const conn = this.peer.connect(code);

        return new Promise((resolve, reject) => {
            conn.on('open', () => {
                this.conn = conn;
                this.setupConnectionHandlers();
                // Send join request
                this.send({
                    type: 'JOIN_REQUEST',
                    playerName: this.currentPlayer.name
                });
                resolve({ name: 'Connecting...' }); // Real room info comes later
            });

            conn.on('error', (err) => {
                reject(err);
            });

            // Timeout if not connected
            setTimeout(() => {
                if (!this.conn || !this.conn.open) {
                    reject(new Error('Connection timeout'));
                }
            }, 5000);
        });
    }

    startGameAsHost() {
        if (!this.isHost || !this.conn) return;

        // Initialize game
        this.currentRoom.game = new window.TicTacToe('x');
        this.currentRoom.status = 'playing';

        // Send initial state to guest
        this.send({
            type: 'GAME_START',
            room: {
                ...this.currentRoom,
                game: this.serializeGame(this.currentRoom.game)
            }
        });

        this.triggerCallback('gameStart', this.currentRoom);
    }

    // Helper to serialize TicTacToe object because methods don't transfer
    serializeGame(game) {
        // We only send the data properties
        return {
            field: game.field,
            currentPlayer: game.currentPlayer,
            winner: game.winner,
            finished: game.finished,
            turns: game.turns
        };
    }

    async makeMove(row, col) {
        if (!this.currentRoom || !this.currentRoom.game) return;

        const game = this.currentRoom.game;

        // Apply move locally first
        // Note: The UI calls this, so it expects validation there? 
        // Or we re-validate here.
        game.nextTurn(row, col);

        // Send new state to peer
        this.send({
            type: 'MOVE',
            field: game.field,
            currentPlayer: game.currentPlayer,
            winner: game.winner,
            finished: game.finished,
            turns: game.turns
        });

        return true;
    }

    async requestRematch() {
        this.send({ type: 'REMATCH_REQUEST' });
        return true;
    }

    async acceptRematch() {
        // Reset locally
        if (this.currentRoom) {
            this.currentRoom.game = new window.TicTacToe('x');
        }

        this.send({ type: 'REMATCH_ACCEPTED' });
        this.triggerCallback('rematchStarted', { room: this.currentRoom });

        // If host, resend game start? No, accept signal is enough to reset
        return true;
    }

    send(data) {
        if (this.conn && this.conn.open) {
            this.conn.send(data);
        }
    }

    isMyTurn() {
        if (!this.currentRoom || !this.currentRoom.game) return false;
        // currentRoom.game might be a plain object if received from peer, 
        // need to handle that carefully or re-hydrate it.
        // For simple checking:
        return this.currentRoom.game.currentPlayer === this.currentPlayer.symbol;
    }

    getCurrentRoom() {
        return this.currentRoom;
    }

    disconnect() {
        if (this.peer) this.peer.destroy();
        this.conn = null;
        this.peer = null;
        this.isConnected = false;
    }

    on(event, callback) {
        if (!this.gameCallbacks[event]) {
            this.gameCallbacks[event] = [];
        }
        this.gameCallbacks[event].push(callback);
    }

    triggerCallback(event, data) {
        const callbacks = this.gameCallbacks[event];
        if (callbacks) {
            callbacks.forEach(callback => callback(data));
        }
    }
}

window.OnlineGame = OnlineGame;