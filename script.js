// Representación de las piezas
const UNICODE_PIECES = {
    'wK': '♔', 'wQ': '♕', 'wR': '♖', 'wB': '♗', 'wN': '♘', 'wP': '♙',
    'bK': '♚', 'bQ': '♛', 'bR': '♜', 'bB': '♝', 'bN': '♞', 'bP': '♟'
};

// Estado inicial del tablero (8x8)
const INITIAL_BOARD = [
    ['bR', 'bN', 'bB', 'bQ', 'bK', 'bB', 'bN', 'bR'],
    ['bP', 'bP', 'bP', 'bP', 'bP', 'bP', 'bP', 'bP'],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    ['wP', 'wP', 'wP', 'wP', 'wP', 'wP', 'wP', 'wP'],
    ['wR', 'wN', 'wB', 'wQ', 'wK', 'wB', 'wN', 'wR']
];

// Variables globales de estado
let board = [];
let currentTurn = 'w'; // 'w' para blancas, 'b' para negras
let selectedSquare = null;
let validMoves = [];
let history = [];
let capturedPieces = { w: [], b: [] };
let isFlipped = false;
let pendingPromotion = null;

// Tiempos (en segundos)
let timerWhite = 600;
let timerBlack = 600;
let timerInterval = null;

// Elementos DOM
const boardEl = document.getElementById('board');
const turnDisplayEl = document.getElementById('turn-display');
const gameStatusEl = document.getElementById('game-status');
const movesHistoryEl = document.getElementById('moves-history');
const capturedWhiteEl = document.getElementById('captured-white-list');
const capturedBlackEl = document.getElementById('captured-black-list');
const timerWhiteEl = document.getElementById('timer-white');
const timerBlackEl = document.getElementById('timer-black');
const playerWhiteBox = document.getElementById('player-white-box');
const playerBlackBox = document.getElementById('player-black-box');

// Inicialización de la partida
function initGame() {
    board = JSON.parse(JSON.stringify(INITIAL_BOARD));
    currentTurn = 'w';
    selectedSquare = null;
    validMoves = [];
    history = [];
    capturedPieces = { w: [], b: [] };
    timerWhite = 600;
    timerBlack = 600;

    startTimer();
    renderBoard();
    updateUI();
}

// Renderizado del tablero
function renderBoard() {
    boardEl.innerHTML = '';
    
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const row = isFlipped ? 7 - r : r;
            const col = isFlipped ? 7 - c : c;
            
            const squareEl = document.createElement('div');
            const isWhiteSquare = (row + col) % 2 === 0;
            squareEl.className = `square ${isWhiteSquare ? 'white' : 'black'}`;
            squareEl.dataset.row = row;
            squareEl.dataset.col = col;

            // Resaltados
            if (selectedSquare && selectedSquare.r === row && selectedSquare.c === col) {
                squareEl.classList.add('selected');
            }

            const move = validMoves.find(m => m.r === row && m.c === col);
            if (move) {
                if (board[row][col]) {
                    squareEl.classList.add('possible-capture');
                } else {
                    squareEl.classList.add('possible-move');
                }
            }

            // Pieza
            const piece = board[row][col];
            if (piece) {
                const pieceEl = document.createElement('span');
                const pieceColor = piece[0];
                pieceEl.className = `piece ${pieceColor}`;
                pieceEl.textContent = UNICODE_PIECES[piece];
                squareEl.appendChild(pieceEl);

                // Jaque al rey
                if (piece[1] === 'K' && pieceColor === currentTurn && isInCheck(currentTurn, board)) {
                    squareEl.classList.add('in-check');
                }
            }

            squareEl.addEventListener('click', () => handleSquareClick(row, col));
            boardEl.appendChild(squareEl);
        }
    }
}

// Manejador de clics en las casillas
function handleSquareClick(row, col) {
    const piece = board[row][col];

    // Si hace clic en una casilla destino válida
    if (selectedSquare) {
        const move = validMoves.find(m => m.r === row && m.c === col);
        if (move) {
            executeMove(selectedSquare.r, selectedSquare.c, row, col);
            selectedSquare = null;
            validMoves = [];
            renderBoard();
            return;
        }
    }

    // Selección de pieza propia
    if (piece && piece[0] === currentTurn) {
        selectedSquare = { r: row, c: col };
        validMoves = getValidMovesForPiece(row, col);
    } else {
        selectedSquare = null;
        validMoves = [];
    }

    renderBoard();
}

// Cálculo de movimientos válidos
function getValidMovesForPiece(r, c) {
    const rawMoves = getPseudoMoves(r, c, board);
    // Filtrar movimientos que dejan o mantienen al rey en jaque
    return rawMoves.filter(m => {
        const tempBoard = JSON.parse(JSON.stringify(board));
        tempBoard[m.r][m.c] = tempBoard[r][c];
        tempBoard[r][c] = null;
        return !isInCheck(currentTurn, tempBoard);
    });
}

// Movimientos seudoválidos (según las reglas geométricas)
function getPseudoMoves(r, c, b) {
    const piece = b[r][c];
    if (!piece) return [];
    
    const color = piece[0];
    const type = piece[1];
    const moves = [];

    const directions = {
        'R': [[1,0], [-1,0], [0,1], [0,-1]],
        'B': [[1,1], [1,-1], [-1,1], [-1,-1]],
        'Q': [[1,0], [-1,0], [0,1], [0,-1], [1,1], [1,-1], [-1,1], [-1,-1]],
        'N': [[2,1], [2,-1], [-2,1], [-2,-1], [1,2], [1,-2], [-1,2], [-1,-2]],
        'K': [[1,0], [-1,0], [0,1], [0,-1], [1,1], [1,-1], [-1,1], [-1,-1]]
    };

    if (type === 'P') {
        const dir = color === 'w' ? -1 : 1;
        // Avanzar 1 casilla
        if (r + dir >= 0 && r + dir < 8 && !b[r + dir][c]) {
            moves.push({ r: r + dir, c: c });
            // Avanzar 2 casillas desde inicio
            const startRow = color === 'w' ? 6 : 1;
            if (r === startRow && !b[r + 2 * dir][c]) {
                moves.push({ r: r + 2 * dir, c: c });
            }
        }
        // Capturas diagonales
        for (let dc of [-1, 1]) {
            let nr = r + dir, nc = c + dc;
            if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                if (b[nr][nc] && b[nr][nc][0] !== color) {
                    moves.push({ r: nr, c: nc });
                }
            }
        }
    } else if (type === 'N' || type === 'K') {
        for (let [dr, dc] of directions[type]) {
            let nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                if (!b[nr][nc] || b[nr][nc][0] !== color) {
                    moves.push({ r: nr, c: nc });
                }
            }
        }
    } else { // R, B, Q
        for (let [dr, dc] of directions[type]) {
            let nr = r + dr, nc = c + dc;
            while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                if (!b[nr][nc]) {
                    moves.push({ r: nr, c: nc });
                } else {
                    if (b[nr][nc][0] !== color) moves.push({ r: nr, c: nc });
                    break;
                }
                nr += dr;
                nc += dc;
            }
        }
    }

    return moves;
}

// Verificación de Jaque
function isInCheck(color, b) {
    let kingPos = null;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (b[r][c] === color + 'K') {
                kingPos = { r, c };
                break;
            }
        }
    }
    if (!kingPos) return false;

    const opponentColor = color === 'w' ? 'b' : 'w';
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (b[r][c] && b[r][c][0] === opponentColor) {
                const moves = getPseudoMoves(r, c, b);
                if (moves.some(m => m.r === kingPos.r && m.c === kingPos.c)) {
                    return true;
                }
            }
        }
    }
    return false;
}

// Ejecutar movimiento
function executeMove(fromR, fromC, toR, toC) {
    const piece = board[fromR][fromC];
    const captured = board[toR][toC];

    // Registrar historial
    history.push({
        from: { r: fromR, c: fromC },
        to: { r: toR, c: toC },
        piece: piece,
        captured: captured,
        boardState: JSON.parse(JSON.stringify(board))
    });

    if (captured) {
        capturedPieces[captured[0] === 'w' ? 'b' : 'w'].push(captured);
    }

    board[toR][toC] = piece;
    board[fromR][fromC] = null;

    // Promoción de Peón
    if (piece[1] === 'P' && (toR === 0 || toR === 7)) {
        pendingPromotion = { r: toR, c: toC, color: piece[0] };
        document.getElementById('promotion-modal').classList.remove('hidden');
        return;
    }

    finishTurn();
}

function finishTurn() {
    currentTurn = currentTurn === 'w' ? 'b' : 'w';
    updateUI();
    checkGameEnd();
}

// Promoción de peón
document.querySelectorAll('.promotion-options button').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const choice = e.target.getAttribute('data-piece');
        if (pendingPromotion) {
            board[pendingPromotion.r][pendingPromotion.c] = pendingPromotion.color + choice.toUpperCase();
            pendingPromotion = null;
            document.getElementById('promotion-modal').classList.add('hidden');
            renderBoard();
            finishTurn();
        }
    });
});

// Comprobar fin de partida (Jaque Mate / Tablas)
function checkGameEnd() {
    let hasValidMoves = false;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (board[r][c] && board[r][c][0] === currentTurn) {
                if (getValidMovesForPiece(r, c).length > 0) {
                    hasValidMoves = true;
                    break;
                }
            }
        }
    }

    if (!hasValidMoves) {
        clearInterval(timerInterval);
        if (isInCheck(currentTurn, board)) {
            const winner = currentTurn === 'w' ? 'Negras' : 'Blancas';
            showGameOver(`¡Jaque Mate! Ganador: ${winner}`);
        } else {
            showGameOver('¡Tablas por Ahogado!');
        }
    }
}

// Actualizar Interfaz
function updateUI() {
    turnDisplayEl.textContent = currentTurn === 'w' ? 'Blancas' : 'Negras';
    
    if (currentTurn === 'w') {
        playerWhiteBox.classList.add('active');
        playerBlackBox.classList.remove('active');
    } else {
        playerBlackBox.classList.add('active');
        playerWhiteBox.classList.remove('active');
    }

    // Piezas capturadas
    capturedWhiteEl.innerHTML = capturedPieces.w.map(p => UNICODE_PIECES[p]).join(' ');
    capturedBlackEl.innerHTML = capturedPieces.b.map(p => UNICODE_PIECES[p]).join(' ');

    // Historial
    movesHistoryEl.innerHTML = '';
    for (let i = 0; i < history.length; i += 2) {
        const row = document.createElement('div');
        row.className = 'history-row';
        const moveNum = Math.floor(i / 2) + 1;
        const wMove = formatMove(history[i]);
        const bMove = history[i + 1] ? formatMove(history[i + 1]) : '';
        
        row.innerHTML = `<span class="history-num">${moveNum}.</span><span class="history-move">${wMove}</span><span class="history-move">${bMove}</span>`;
        movesHistoryEl.appendChild(row);
    }
    movesHistoryEl.scrollTop = movesHistoryEl.scrollHeight;
}

function formatMove(move) {
    const cols = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const p = move.piece[1] === 'P' ? '' : move.piece[1];
    const cap = move.captured ? 'x' : '';
    const dest = `${cols[move.to.c]}${8 - move.to.r}`;
    return `${p}${cap}${dest}`;
}

// Reloj / Temporizador
function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (currentTurn === 'w') {
            timerWhite--;
            if (timerWhite <= 0) handleTimeout('Blancas');
        } else {
            timerBlack--;
            if (timerBlack <= 0) handleTimeout('Negras');
        }
        updateTimerDisplay();
    }, 1000);
}

function updateTimerDisplay() {
    const formatTime = (s) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m}:${sec < 10 ? '0' : ''}${sec}`;
    };
    timerWhiteEl.textContent = formatTime(timerWhite);
    timerBlackEl.textContent = formatTime(timerBlack);
}

function handleTimeout(loser) {
    clearInterval(timerInterval);
    const winner = loser === 'Blancas' ? 'Negras' : 'Blancas';
    showGameOver(`¡Tiempo agotado para ${loser}! Ganador: ${winner}`);
}

function showGameOver(msg) {
    document.getElementById('gameover-message').textContent = msg;
    document.getElementById('gameover-modal').classList.remove('hidden');
}

// Controles de Botones
document.getElementById('btn-restart').addEventListener('click', initGame);
document.getElementById('btn-modal-restart').addEventListener('click', () => {
    document.getElementById('gameover-modal').classList.add('hidden');
    initGame();
});

document.getElementById('btn-undo').addEventListener('click', () => {
    if (history.length === 0) return;
    const lastMove = history.pop();
    board = lastMove.boardState;
    currentTurn = currentTurn === 'w' ? 'b' : 'w';
    
    // Recalcular piezas capturadas
    capturedPieces = { w: [], b: [] };
    history.forEach(m => {
        if (m.captured) {
            capturedPieces[m.captured[0] === 'w' ? 'b' : 'w'].push(m.captured);
        }
    });

    renderBoard();
    updateUI();
});

document.getElementById('btn-flip').addEventListener('click', () => {
    isFlipped = !isFlipped;
    renderBoard();
});

// Arrancar el juego por primera vez
initGame();