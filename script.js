import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
    getDatabase,
    ref,
    set,
    get,
    onValue,
    onDisconnect,
    runTransaction
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";


// ==========================
// FIREBASE
// ==========================

const firebaseConfig = {
    apiKey: "AIzaSyBsBp_9B5BmQmkfNB4rfkMEWnqmDjcqXaY",
    authDomain: "tictactoeonline-2841a.firebaseapp.com",
    databaseURL: "https://tictactoeonline-2841a-default-rtdb.firebaseio.com",
    projectId: "tictactoeonline-2841a",
    storageBucket: "tictactoeonline-2841a.firebasestorage.app",
    messagingSenderId: "753364590333",
    appId: "1:753364590333:web:e08866323a660bb34d6894",
    measurementId: "G-12XRF2ZTBT"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const gameRef = ref(db, "game");
const rematchRef = ref(db, "rematch");
const playersRef = ref(db, "players");
const devicesRef = ref(db, "devices");


// ==========================
// CONSTANTS
// ==========================

const GAME_TYPE = "ultimate-tic-tac-toe";
const SCHEMA_VERSION = 3;
const BOARD_COUNT = 9;
const CELL_COUNT = 9;
const PLAYER_X = "X";
const PLAYER_O = "O";
const SPECTATOR = "Zuschauer";
const EMPTY = "";
const DRAW = "draw";
const FREE_BOARD = -1;
const MAX_NAME_LENGTH = 40;

const WIN_PATTERNS = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6]
];


// ==========================
// PLAYER / DEVICE IDENTITY
// ==========================

let playerId = localStorage.getItem("playerId");

if (!playerId) {
    playerId = crypto.randomUUID();
    localStorage.setItem("playerId", playerId);
}

let mySymbol = null;
let myName = null;


// ==========================
// DOM
// ==========================

const boardElement = document.getElementById("board");
const statusText = document.getElementById("status");
const activeBoardInfo = document.getElementById("activeBoardInfo");
const playerInfo = document.getElementById("playerInfo");
const connectionInfo = document.getElementById("connectionInfo");

const cardX = document.getElementById("cardX");
const cardO = document.getElementById("cardO");
const nameXEl = document.getElementById("nameX");
const nameOEl = document.getElementById("nameO");
const winsXEl = document.getElementById("winsX");
const lossesXEl = document.getElementById("lossesX");
const drawsXEl = document.getElementById("drawsX");
const winsOEl = document.getElementById("winsO");
const lossesOEl = document.getElementById("lossesO");
const drawsOEl = document.getElementById("drawsO");

const nameScreen = document.getElementById("nameScreen");
const nameForm = document.getElementById("nameForm");
const nameInput = document.getElementById("nameInput");
const nameError = document.getElementById("nameError");

const endgameScreen = document.getElementById("endgameScreen");
const endgameTitle = document.getElementById("endgameTitle");
const endgameTrophy = document.getElementById("endgameTrophy");
const endgameResult = document.getElementById("endgameResult");
const readyXText = document.getElementById("readyXText");
const readyOText = document.getElementById("readyOText");
const readyCheckX = document.getElementById("readyCheckX");
const readyCheckO = document.getElementById("readyCheckO");
const readySummaryText = document.getElementById("readySummaryText");
const readyBtn = document.getElementById("readyBtn");
const endgameNote = document.getElementById("endgameNote");

const themeToggle = document.getElementById("themeToggle");
const soundToggle = document.getElementById("soundToggle");
const surrenderBtn = document.getElementById("surrenderBtn");

const cellButtons = [];
const miniBoards = [];
const miniBoardResults = [];


// ==========================
// GAME STATE (synced)
// ==========================

let boards = emptyBoards();
let boardWinners = emptyBoardResults();
let activeBoard = FREE_BOARD;
let currentPlayer = PLAYER_X;
let starter = PLAYER_X;
let gameStatus = "playing";
let gameWinner = EMPTY;
let gameId = null;
let moveNumber = 0;
let forfeitedBy = EMPTY;

let rematchState = null;
let playersMap = {};
let devicesMap = {};

let restartInProgress = false;
let repairInProgress = false;
let lastSeenStatus = null;
let wasMyTurn = false;
let lastMoveTimeout = null;
let audioCtx = null;
let soundEnabled = true;


// ==========================
// STATE HELPERS
// ==========================

function emptyBoard() {
    return Array(CELL_COUNT).fill(EMPTY);
}

function emptyBoards() {
    return Array.from({ length: BOARD_COUNT }, () => emptyBoard());
}

function emptyBoardResults() {
    return Array(BOARD_COUNT).fill(EMPTY);
}

function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isPlayer(value) {
    return value === PLAYER_X || value === PLAYER_O;
}

function isValidIndex(value) {
    return Number.isInteger(value) && value >= 0 && value < BOARD_COUNT;
}

function normalizeCell(value) {
    return isPlayer(value) ? value : EMPTY;
}

function normalizeBoard(rawBoard) {
    if (!Array.isArray(rawBoard) || rawBoard.length !== CELL_COUNT) {
        return emptyBoard();
    }

    return rawBoard.map(normalizeCell);
}

function normalizeBoards(rawBoards) {
    if (!Array.isArray(rawBoards) || rawBoards.length !== BOARD_COUNT) {
        return emptyBoards();
    }

    return rawBoards.map(normalizeBoard);
}

function checkWinner(cellsToCheck) {
    for (const pattern of WIN_PATTERNS) {
        const [a, b, c] = pattern;

        if (
            cellsToCheck[a] &&
            cellsToCheck[a] === cellsToCheck[b] &&
            cellsToCheck[a] === cellsToCheck[c]
        ) {
            return cellsToCheck[a];
        }
    }

    return null;
}

function isBoardFull(boardToCheck) {
    return boardToCheck.every(cell => cell !== EMPTY);
}

function deriveSingleBoardResult(boardToCheck) {
    const winner = checkWinner(boardToCheck);

    if (winner) {
        return winner;
    }

    return isBoardFull(boardToCheck) ? DRAW : EMPTY;
}

function deriveBoardResults(boardsToCheck) {
    return boardsToCheck.map(deriveSingleBoardResult);
}

function deriveOverallWinner(boardResultsToCheck) {
    const winBoard = boardResultsToCheck.map(result => isPlayer(result) ? result : EMPTY);
    const winner = checkWinner(winBoard);

    if (winner) {
        return winner;
    }

    return boardResultsToCheck.every(result => result !== EMPTY) ? DRAW : EMPTY;
}

function countPlayedCells(boardsToCount) {
    return boardsToCount.reduce((total, boardToCount) => {
        return total + boardToCount.filter(cell => cell !== EMPTY).length;
    }, 0);
}

function normalizeActiveBoard(rawActiveBoard, boardResults, status) {
    if (status !== "playing") {
        return FREE_BOARD;
    }

    if (!isValidIndex(rawActiveBoard)) {
        return FREE_BOARD;
    }

    return boardResults[rawActiveBoard] === EMPTY ? rawActiveBoard : FREE_BOARD;
}

function createGameState(overrides = {}) {
    const nextBoards = overrides.boards ? normalizeBoards(overrides.boards) : emptyBoards();
    const nextBoardWinners = deriveBoardResults(nextBoards);
    const nextWinner = deriveOverallWinner(nextBoardWinners);
    const nextStatus = nextWinner !== EMPTY ? "ended" : "playing";
    const nextStarter = overrides.starter === PLAYER_O ? PLAYER_O : PLAYER_X;

    return {
        gameType: GAME_TYPE,
        schemaVersion: SCHEMA_VERSION,
        gameId: overrides.gameId || crypto.randomUUID(),
        boards: nextBoards,
        boardWinners: nextBoardWinners,
        activeBoard: normalizeActiveBoard(overrides.activeBoard, nextBoardWinners, nextStatus),
        currentPlayer: isPlayer(overrides.currentPlayer) ? overrides.currentPlayer : nextStarter,
        starter: nextStarter,
        status: nextStatus,
        winner: nextWinner,
        forfeitedBy: EMPTY,
        moveNumber: Number.isInteger(overrides.moveNumber)
            ? Math.max(0, overrides.moveNumber)
            : countPlayedCells(nextBoards)
    };
}

function arraysEqual(left, right) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
        return false;
    }

    return left.every((value, index) => value === right[index]);
}

function boardsEqual(left, right) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
        return false;
    }

    return left.every((boardToCheck, index) => arraysEqual(boardToCheck, right[index]));
}

function isSameNormalizedGame(raw, normalized) {
    return isRecord(raw) &&
        raw.gameType === normalized.gameType &&
        raw.schemaVersion === normalized.schemaVersion &&
        raw.gameId === normalized.gameId &&
        boardsEqual(raw.boards, normalized.boards) &&
        arraysEqual(raw.boardWinners, normalized.boardWinners) &&
        raw.activeBoard === normalized.activeBoard &&
        raw.currentPlayer === normalized.currentPlayer &&
        raw.starter === normalized.starter &&
        raw.status === normalized.status &&
        raw.winner === normalized.winner &&
        ((raw.forfeitedBy === PLAYER_X || raw.forfeitedBy === PLAYER_O) ? raw.forfeitedBy : EMPTY) === normalized.forfeitedBy &&
        raw.moveNumber === normalized.moveNumber;
}

function normalizeGameData(raw) {
    if (!isRecord(raw) || raw.gameType !== GAME_TYPE || raw.schemaVersion !== SCHEMA_VERSION) {
        return {
            normalized: createGameState(),
            needsWrite: true
        };
    }

    const normalizedBoards = normalizeBoards(raw.boards);
    const normalizedBoardWinners = deriveBoardResults(normalizedBoards);
    const boardWinner = deriveOverallWinner(normalizedBoardWinners);
    const normalizedForfeit = (raw.forfeitedBy === PLAYER_X || raw.forfeitedBy === PLAYER_O) ? raw.forfeitedBy : EMPTY;
    const normalizedWinner = normalizedForfeit ? getOtherPlayer(normalizedForfeit) : boardWinner;
    const normalizedStatus = (normalizedForfeit !== EMPTY || boardWinner !== EMPTY) ? "ended" : "playing";
    const normalizedMoveNumber = countPlayedCells(normalizedBoards);

    const normalized = {
        gameType: GAME_TYPE,
        schemaVersion: SCHEMA_VERSION,
        gameId: typeof raw.gameId === "string" && raw.gameId.trim() !== ""
            ? raw.gameId
            : crypto.randomUUID(),
        boards: normalizedBoards,
        boardWinners: normalizedBoardWinners,
        activeBoard: normalizeActiveBoard(raw.activeBoard, normalizedBoardWinners, normalizedStatus),
        currentPlayer: raw.currentPlayer === PLAYER_O ? PLAYER_O : PLAYER_X,
        starter: raw.starter === PLAYER_O ? PLAYER_O : PLAYER_X,
        status: normalizedStatus,
        winner: normalizedWinner,
        forfeitedBy: normalizedForfeit,
        moveNumber: normalizedMoveNumber
    };

    return {
        normalized,
        needsWrite: !isSameNormalizedGame(raw, normalized)
    };
}

function getLocalGameState() {
    return {
        gameType: GAME_TYPE,
        schemaVersion: SCHEMA_VERSION,
        gameId,
        boards,
        boardWinners,
        activeBoard,
        currentPlayer,
        starter,
        status: gameStatus,
        winner: gameWinner,
        forfeitedBy,
        moveNumber
    };
}

function getOtherPlayer(player) {
    return player === PLAYER_X ? PLAYER_O : PLAYER_X;
}

function isBoardPlayable(boardIndex, state) {
    return isValidIndex(boardIndex) && state.boardWinners[boardIndex] === EMPTY;
}

function isMoveAllowed(state, boardIndex, cellIndex, player) {
    if (state.status !== "playing") return false;
    if (!isPlayer(player)) return false;
    if (state.currentPlayer !== player) return false;
    if (!isValidIndex(boardIndex) || !isValidIndex(cellIndex)) return false;
    if (!isBoardPlayable(boardIndex, state)) return false;
    if (state.activeBoard !== FREE_BOARD && state.activeBoard !== boardIndex) return false;

    return state.boards[boardIndex][cellIndex] === EMPTY;
}

function getNextActiveBoard(cellIndex, nextBoardWinners) {
    return nextBoardWinners[cellIndex] === EMPTY ? cellIndex : FREE_BOARD;
}

function applyMoveToState(state, boardIndex, cellIndex, player) {
    const nextBoards = state.boards.map(boardToClone => [...boardToClone]);
    nextBoards[boardIndex][cellIndex] = player;

    const nextBoardWinners = deriveBoardResults(nextBoards);
    const nextWinner = deriveOverallWinner(nextBoardWinners);
    const nextStatus = nextWinner !== EMPTY ? "ended" : "playing";

    return {
        ...state,
        boards: nextBoards,
        boardWinners: nextBoardWinners,
        activeBoard: nextStatus === "playing"
            ? getNextActiveBoard(cellIndex, nextBoardWinners)
            : FREE_BOARD,
        currentPlayer: nextStatus === "playing"
            ? getOtherPlayer(player)
            : player,
        status: nextStatus,
        winner: nextWinner,
        moveNumber: state.moveNumber + 1
    };
}


// ==========================
// NAME / LABEL HELPERS
// ==========================

function symbolLabel(symbol) {
    return symbol === PLAYER_X ? "Dino" : "Ente";
}

function normalizeName(value) {
    if (typeof value !== "string") return EMPTY;
    return value.trim().slice(0, MAX_NAME_LENGTH);
}

function deviceName(deviceId) {
    const entry = deviceId ? devicesMap[deviceId] : null;
    return entry && typeof entry.name === "string" ? entry.name : EMPTY;
}

function playerDisplay(symbol) {
    const id = symbol === PLAYER_X ? playersMap.X : playersMap.O;
    const name = deviceName(id);
    return name ? `${name} (${symbolLabel(symbol)})` : symbolLabel(symbol);
}

function getResultText() {
    if (gameWinner === DRAW) {
        return "Unentschieden!";
    }

    if (isPlayer(gameWinner)) {
        return `${playerDisplay(gameWinner)} gewinnt!`;
    }

    return "";
}


// ==========================
// UI: BOARD
// ==========================

function createBoardUI() {
    boardElement.textContent = "";
    cellButtons.length = 0;
    miniBoards.length = 0;
    miniBoardResults.length = 0;

    for (let boardIndex = 0; boardIndex < BOARD_COUNT; boardIndex += 1) {
        const miniBoard = document.createElement("div");
        miniBoard.className = "mini-board";
        miniBoard.dataset.boardIndex = String(boardIndex);

        for (let cellIndex = 0; cellIndex < CELL_COUNT; cellIndex += 1) {
            const cellButton = document.createElement("button");
            cellButton.type = "button";
            cellButton.className = "cell";
            cellButton.dataset.boardIndex = String(boardIndex);
            cellButton.dataset.cellIndex = String(cellIndex);
            cellButton.setAttribute("aria-label", `Brett ${boardIndex + 1}, Feld ${cellIndex + 1}`);
            cellButton.addEventListener("click", handleCellClick);

            cellButtons.push(cellButton);
            miniBoard.appendChild(cellButton);
        }

        const resultOverlay = document.createElement("div");
        resultOverlay.className = "mini-board-result";
        resultOverlay.setAttribute("aria-hidden", "true");

        miniBoardResults.push(resultOverlay);
        miniBoard.appendChild(resultOverlay);

        miniBoards.push(miniBoard);
        boardElement.appendChild(miniBoard);
    }
}

function updateBoardCells() {
    const state = getLocalGameState();

    cellButtons.forEach(cellButton => {
        const boardIndex = Number(cellButton.dataset.boardIndex);
        const cellIndex = Number(cellButton.dataset.cellIndex);
        const value = boards[boardIndex][cellIndex];
        const playable = isMoveAllowed(state, boardIndex, cellIndex, mySymbol);

        cellButton.disabled = !playable;
        cellButton.classList.toggle("filled-x", value === PLAYER_X);
        cellButton.classList.toggle("filled-o", value === PLAYER_O);
        cellButton.classList.toggle("playable", playable);

        const label = value === PLAYER_X
            ? `Brett ${boardIndex + 1}, Feld ${cellIndex + 1}: Dino`
            : value === PLAYER_O
                ? `Brett ${boardIndex + 1}, Feld ${cellIndex + 1}: Ente`
                : `Brett ${boardIndex + 1}, Feld ${cellIndex + 1}: leer`;
        cellButton.setAttribute("aria-label", label);
    });
}

function updateMiniBoards() {
    miniBoards.forEach((miniBoard, boardIndex) => {
        const result = boardWinners[boardIndex];
        const isActive = gameStatus === "playing" &&
            (activeBoard === FREE_BOARD || activeBoard === boardIndex) &&
            result === EMPTY;

        miniBoard.classList.toggle("active-board", isActive);
        miniBoard.classList.toggle("closed-board", result !== EMPTY);
        miniBoard.classList.toggle("won-x", result === PLAYER_X);
        miniBoard.classList.toggle("won-o", result === PLAYER_O);
        miniBoard.classList.toggle("draw-board", result === DRAW);
        miniBoard.setAttribute("aria-label", getMiniBoardLabel(boardIndex, result, isActive));

        const overlay = miniBoardResults[boardIndex];
        overlay.textContent = "";

        if (result === DRAW) {
            const drawMark = document.createElement("span");
            drawMark.className = "draw-mark";
            drawMark.textContent = "=";
            overlay.appendChild(drawMark);
        }
    });
}

function getMiniBoardLabel(boardIndex, result, isActive) {
    if (result === PLAYER_X || result === PLAYER_O) {
        return `Brett ${boardIndex + 1}, gewonnen von ${symbolLabel(result)}`;
    }

    if (result === DRAW) {
        return `Brett ${boardIndex + 1}, unentschieden`;
    }

    return isActive
        ? `Brett ${boardIndex + 1}, spielbar`
        : `Brett ${boardIndex + 1}, aktuell gesperrt`;
}


// ==========================
// UI: SCOREBOARD / STATUS
// ==========================

function renderPlayers() {
    const xId = playersMap.X;
    const oId = playersMap.O;

    nameXEl.textContent = xId ? (deviceName(xId) || "Spieler") : "wartet...";
    nameOEl.textContent = oId ? (deviceName(oId) || "Spieler") : "wartet...";

    winsXEl.textContent = String(deviceStat(xId, "wins"));
    lossesXEl.textContent = String(deviceStat(xId, "losses"));
    drawsXEl.textContent = String(deviceStat(xId, "draws"));
    winsOEl.textContent = String(deviceStat(oId, "wins"));
    lossesOEl.textContent = String(deviceStat(oId, "losses"));
    drawsOEl.textContent = String(deviceStat(oId, "draws"));

    cardX.classList.toggle("is-you", mySymbol === PLAYER_X);
    cardO.classList.toggle("is-you", mySymbol === PLAYER_O);

    const turnX = gameStatus === "playing" && currentPlayer === PLAYER_X && !!xId;
    const turnO = gameStatus === "playing" && currentPlayer === PLAYER_O && !!oId;
    cardX.classList.toggle("is-turn", turnX);
    cardO.classList.toggle("is-turn", turnO);

    document.body.classList.toggle("player-is-x", mySymbol === PLAYER_X);
    document.body.classList.toggle("player-is-o", mySymbol === PLAYER_O);
}

function updatePlayerInfo() {
    if (!mySymbol) {
        playerInfo.textContent = "Spielerzuweisung laeuft...";
        return;
    }

    if (mySymbol === SPECTATOR) {
        playerInfo.textContent = `${myName || "Du"} schaut als Zuschauer zu.`;
        return;
    }

    playerInfo.textContent = `Du spielst als ${myName || "?"} - ${symbolLabel(mySymbol)} (${mySymbol}).`;
}

function updateMainStatus() {
    if (gameStatus === "ended") {
        statusText.textContent = getResultText();
        activeBoardInfo.textContent = "Partie beendet.";
        return;
    }

    if (mySymbol === SPECTATOR) {
        statusText.textContent = `Zuschauer-Modus - ${playerDisplay(currentPlayer)} ist am Zug.`;
    } else if (mySymbol === currentPlayer) {
        statusText.textContent = `Du bist am Zug! (${symbolLabel(mySymbol)})`;
    } else if (isPlayer(mySymbol)) {
        statusText.textContent = `Warte auf ${playerDisplay(currentPlayer)}...`;
    } else {
        statusText.textContent = `${playerDisplay(currentPlayer)} ist am Zug.`;
    }

    activeBoardInfo.textContent = activeBoard === FREE_BOARD
        ? "Freie Brettwahl: Spiele in ein offenes Teilbrett."
        : `Aktives Teilbrett: ${activeBoard + 1}`;
}


// ==========================
// UI: ENDGAME
// ==========================

function showEndgameScreen() {
    endgameScreen.classList.remove("hidden");
}

function hideEndgameScreen() {
    endgameScreen.classList.add("hidden");
}

function updateEndgameUI() {
    if (gameStatus !== "ended") {
        hideEndgameScreen();
        endgameNote.textContent = "";
        return;
    }

    showEndgameScreen();

    endgameTitle.textContent =
        gameWinner === DRAW
            ? "Unentschieden!"
            : `${playerDisplay(gameWinner)} gewinnt!`;

    endgameTrophy.textContent = gameWinner === DRAW ? "🤝" : "🏆";

    const nextStarter = getOtherPlayer(starter);
    endgameResult.textContent = forfeitedBy
        ? `${playerDisplay(forfeitedBy)} hat aufgegeben. Naechstes Spiel beginnt ${symbolLabel(nextStarter)}.`
        : `Naechstes Spiel beginnt ${symbolLabel(nextStarter)}.`;

    const activeRematch = rematchState && rematchState.gameId === gameId
        ? rematchState
        : { readyX: false, readyO: false };

    const readyX = !!activeRematch.readyX;
    const readyO = !!activeRematch.readyO;

    readyXText.textContent = `${playerDisplay(PLAYER_X)}: ${readyX ? "bereit" : "nicht bereit"}`;
    readyOText.textContent = `${playerDisplay(PLAYER_O)}: ${readyO ? "bereit" : "nicht bereit"}`;
    readyCheckX.textContent = readyX ? "✅" : "⏳";
    readyCheckO.textContent = readyO ? "✅" : "⏳";
    readyCheckX.closest(".ready-row").classList.toggle("is-ready", readyX);
    readyCheckO.closest(".ready-row").classList.toggle("is-ready", readyO);

    if (readyX && readyO) {
        readySummaryText.textContent = "Beide sind bereit. Neues Spiel startet...";
    } else if (mySymbol === PLAYER_X && readyX) {
        readySummaryText.textContent = "Du bist bereit. Warte auf die Ente.";
    } else if (mySymbol === PLAYER_O && readyO) {
        readySummaryText.textContent = "Du bist bereit. Warte auf den Dino.";
    } else if (readyX || readyO) {
        readySummaryText.textContent = "Ein Spieler ist bereit. Warte auf den Gegner.";
    } else {
        readySummaryText.textContent = "Warte auf Bereitschaft beider Spieler.";
    }

    const myReady =
        mySymbol === PLAYER_X
            ? readyX
            : mySymbol === PLAYER_O
                ? readyO
                : false;

    readyBtn.textContent = myReady ? "Bereit gemeldet ✓" : "Bereit fuer neues Spiel";
    readyBtn.disabled = restartInProgress || (mySymbol !== PLAYER_X && mySymbol !== PLAYER_O);

    if (mySymbol === SPECTATOR) {
        endgameNote.textContent = "Zuschauer koennen den Neustart nicht ausloesen.";
    } else if (!restartInProgress) {
        endgameNote.textContent = "";
    }
}


// ==========================
// CONFETTI (game-end celebration)
// ==========================

const CONFETTI_COLORS = ["#2fbf71", "#e0a312", "#3b82f6", "#ec4899", "#f97316", "#8b5cf6"];

function launchConfetti() {
    const pieces = 70;

    for (let i = 0; i < pieces; i += 1) {
        const piece = document.createElement("div");
        piece.className = "confetti-piece";
        piece.style.left = `${Math.random() * 100}vw`;
        piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
        piece.style.animationDuration = `${2.2 + Math.random() * 1.8}s`;
        piece.style.animationDelay = `${Math.random() * 0.5}s`;
        piece.style.transform = `rotate(${Math.random() * 360}deg)`;
        document.body.appendChild(piece);

        setTimeout(() => piece.remove(), 4800);
    }
}


// ==========================
// EFFECTS / FEEDBACK
// ==========================

function vibrate(pattern) {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
        try {
            navigator.vibrate(pattern);
        } catch (error) {
            // Vibration nicht verfuegbar - ignorieren.
        }
    }
}

function ensureAudio() {
    try {
        if (!audioCtx) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (Ctx) audioCtx = new Ctx();
        }
        if (audioCtx && audioCtx.state === "suspended") {
            audioCtx.resume();
        }
    } catch (error) {
        // Audio nicht verfuegbar - ignorieren.
    }
}

function playTone(freq, startOffset, duration, type, peak) {
    if (!audioCtx) return;

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    const startTime = audioCtx.currentTime + startOffset;

    oscillator.type = type || "sine";
    oscillator.frequency.value = freq;

    gainNode.gain.setValueAtTime(0.0001, startTime);
    gainNode.gain.exponentialRampToValueAtTime(peak || 0.16, startTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    oscillator.connect(gainNode).connect(audioCtx.destination);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.03);
}

function playSound(name) {
    if (!soundEnabled) return;
    ensureAudio();
    if (!audioCtx) return;

    if (name === "move") {
        playTone(330, 0, 0.12, "triangle", 0.16);
    } else if (name === "opponent") {
        playTone(247, 0, 0.12, "triangle", 0.14);
    } else if (name === "win") {
        playTone(523, 0, 0.16, "sine", 0.2);
        playTone(659, 0.14, 0.16, "sine", 0.2);
        playTone(784, 0.28, 0.3, "sine", 0.2);
    } else if (name === "lose") {
        playTone(392, 0, 0.18, "sine", 0.18);
        playTone(311, 0.16, 0.2, "sine", 0.18);
        playTone(233, 0.34, 0.34, "sine", 0.18);
    } else if (name === "draw") {
        playTone(440, 0, 0.16, "sine", 0.15);
        playTone(440, 0.2, 0.24, "sine", 0.15);
    }
}

function getWinningLine(cells) {
    for (const pattern of WIN_PATTERNS) {
        const [a, b, c] = pattern;
        if (cells[a] && cells[a] === cells[b] && cells[a] === cells[c]) {
            return pattern;
        }
    }
    return null;
}

function updateWinHighlights() {
    const winBoardIndices = new Set();

    if (gameWinner === PLAYER_X || gameWinner === PLAYER_O) {
        const bigLine = getWinningLine(boardWinners.map(result => isPlayer(result) ? result : EMPTY));
        if (bigLine) {
            bigLine.forEach(boardIndex => winBoardIndices.add(boardIndex));
        }
    }

    // toggle (statt remove + add) haelt die Animationen synchron und startet sie nicht neu.
    miniBoards.forEach((miniBoard, index) => {
        miniBoard.classList.toggle("win-board", winBoardIndices.has(index));
    });
}

function updateTurnFeedback() {
    const myTurn = gameStatus === "playing" && isPlayer(mySymbol) && currentPlayer === mySymbol;

    if (myTurn && !wasMyTurn) {
        vibrate([120, 60, 120]);
    }

    wasMyTurn = myTurn;
}

function updateControls() {
    const canSurrender = gameStatus === "playing" && (mySymbol === PLAYER_X || mySymbol === PLAYER_O);
    surrenderBtn.classList.toggle("hidden", !canSurrender);
}

function findLastMove(oldBoards, newBoards) {
    if (!Array.isArray(oldBoards) || !Array.isArray(newBoards)) return null;

    let found = null;
    let changes = 0;

    for (let boardIndex = 0; boardIndex < BOARD_COUNT; boardIndex += 1) {
        for (let cellIndex = 0; cellIndex < CELL_COUNT; cellIndex += 1) {
            const before = oldBoards[boardIndex] ? oldBoards[boardIndex][cellIndex] : EMPTY;
            const after = newBoards[boardIndex] ? newBoards[boardIndex][cellIndex] : EMPTY;

            if (before === EMPTY && (after === PLAYER_X || after === PLAYER_O)) {
                found = { board: boardIndex, cell: cellIndex };
                changes += 1;
            }
        }
    }

    return changes === 1 ? found : null;
}

function highlightLastMove(boardIndex, cellIndex) {
    cellButtons.forEach(button => button.classList.remove("last-move"));

    const button = cellButtons[boardIndex * CELL_COUNT + cellIndex];
    if (!button) return;

    button.classList.add("last-move");

    if (lastMoveTimeout) clearTimeout(lastMoveTimeout);
    lastMoveTimeout = setTimeout(() => button.classList.remove("last-move"), 1600);
}


function renderAll() {
    updateBoardCells();
    updateMiniBoards();
    updateWinHighlights();
    renderPlayers();
    updateMainStatus();
    updateEndgameUI();
    updateControls();
    updateTurnFeedback();
}


// ==========================
// CONNECTION
// ==========================

function setupConnection() {
    const connRef = ref(db, `connections/${playerId}`);
    set(connRef, true);
    onDisconnect(connRef).remove();
}

function attachConnectionListener() {
    onValue(ref(db, "connections"), snap => {
        const data = snap.val() || {};
        connectionInfo.textContent = `Verbunden: ${Object.keys(data).length}`;
    });
}


// ==========================
// DEVICE REGISTRY / NAMES
// ==========================

function attachDevicesListener() {
    onValue(devicesRef, snap => {
        devicesMap = isRecord(snap.val()) ? snap.val() : {};
        renderPlayers();
        if (gameStatus === "ended") {
            updateEndgameUI();
        }
    });
}

async function writeDevice(name) {
    await set(ref(db, `devices/${playerId}`), {
        name,
        joinedAt: Date.now()
    });
}

function promptForName() {
    return new Promise(resolve => {
        nameScreen.classList.remove("hidden");
        nameError.classList.add("hidden");
        nameInput.focus();

        nameForm.addEventListener("submit", function handler(event) {
            event.preventDefault();
            const value = normalizeName(nameInput.value);

            if (!value) {
                nameError.classList.remove("hidden");
                return;
            }

            nameForm.removeEventListener("submit", handler);
            nameScreen.classList.add("hidden");
            resolve(value);
        });
    });
}

async function ensureNameRegistered() {
    let existing = EMPTY;

    try {
        const snap = await get(ref(db, `devices/${playerId}`));
        if (snap.exists()) {
            existing = normalizeName(snap.val().name);
        }
    } catch (error) {
        console.error("Geraete-Lookup fehlgeschlagen:", error);
    }

    if (existing) {
        myName = existing;
        return;
    }

    myName = await promptForName();

    try {
        await writeDevice(myName);
    } catch (error) {
        console.error("Name konnte nicht gespeichert werden:", error);
    }
}


// ==========================
// PLAYER SYSTEM
// ==========================

function normalizePlayers(rawPlayers) {
    const nextPlayers = {};

    if (isRecord(rawPlayers)) {
        if (typeof rawPlayers.X === "string" && rawPlayers.X.trim() !== "") {
            nextPlayers.X = rawPlayers.X;
        }

        if (typeof rawPlayers.O === "string" && rawPlayers.O.trim() !== "") {
            nextPlayers.O = rawPlayers.O;
        }
    }

    if (nextPlayers.X === playerId && nextPlayers.O === playerId) {
        delete nextPlayers.O;
    }

    return nextPlayers;
}

function deriveMySymbol(players) {
    if (players.X === playerId) return PLAYER_X;
    if (players.O === playerId) return PLAYER_O;
    return SPECTATOR;
}

function attachPlayersListener() {
    onValue(playersRef, snap => {
        playersMap = normalizePlayers(snap.val());
        mySymbol = deriveMySymbol(playersMap);
        updatePlayerInfo();
        renderAll();
    });
}

async function registerPlayer() {
    try {
        const tx = await runTransaction(playersRef, currentPlayers => {
            const nextPlayers = normalizePlayers(currentPlayers);

            if (nextPlayers.X === playerId || nextPlayers.O === playerId) {
                return nextPlayers;
            }

            if (!nextPlayers.X) {
                nextPlayers.X = playerId;
            } else if (!nextPlayers.O) {
                nextPlayers.O = playerId;
            }

            return nextPlayers;
        });

        playersMap = normalizePlayers(tx.snapshot.val());
        mySymbol = deriveMySymbol(playersMap);
    } catch (error) {
        console.error("Spielerzuweisung fehlgeschlagen:", error);
        mySymbol = SPECTATOR;
    }

    updatePlayerInfo();
    renderAll();
}


// ==========================
// STATS (pro Geraet in devices)
// ==========================

function deviceStat(deviceId, field) {
    const entry = deviceId ? devicesMap[deviceId] : null;
    return entry && Number.isInteger(entry[field]) ? entry[field] : 0;
}

async function bumpDeviceStat(deviceId, field) {
    if (!deviceId) return;

    await runTransaction(ref(db, `devices/${deviceId}/${field}`), current =>
        (Number.isInteger(current) ? current : 0) + 1
    );
}

async function countGameResultIfNeeded() {
    if (gameStatus !== "ended" || !gameId) return;
    if (!isPlayer(gameWinner) && gameWinner !== DRAW) return;

    const xId = playersMap.X;
    const oId = playersMap.O;
    if (!xId || !oId) return;

    const endedGameId = gameId;
    const result = gameWinner;

    try {
        // Idempotenz: nur der erste Client, der den Game beansprucht, zaehlt ihn.
        const claim = await runTransaction(ref(db, `countedGames/${endedGameId}`), current => {
            if (current) return;
            return true;
        });

        if (!claim.committed) return;

        if (result === DRAW) {
            await bumpDeviceStat(xId, "draws");
            await bumpDeviceStat(oId, "draws");
        } else {
            const winnerId = result === PLAYER_X ? xId : oId;
            const loserId = result === PLAYER_X ? oId : xId;
            await bumpDeviceStat(winnerId, "wins");
            await bumpDeviceStat(loserId, "losses");
        }
    } catch (error) {
        console.error("Statistik konnte nicht aktualisiert werden:", error);
    }
}


// ==========================
// GAME SYNC
// ==========================

function applyNormalizedState(normalized) {
    boards = normalized.boards;
    boardWinners = normalized.boardWinners;
    activeBoard = normalized.activeBoard;
    currentPlayer = normalized.currentPlayer;
    starter = normalized.starter;
    gameStatus = normalized.status;
    gameWinner = normalized.winner;
    forfeitedBy = normalized.forfeitedBy;
    gameId = normalized.gameId;
    moveNumber = normalized.moveNumber;
}

async function repairGameStateIfNeeded() {
    if (repairInProgress) return;

    repairInProgress = true;

    try {
        await runTransaction(gameRef, currentGame => {
            const { normalized, needsWrite } = normalizeGameData(currentGame);
            return needsWrite ? normalized : currentGame;
        });
    } finally {
        repairInProgress = false;
    }
}

async function initializeGameIfNeeded() {
    await runTransaction(gameRef, currentGame => {
        if (currentGame !== null && currentGame !== undefined) {
            return currentGame;
        }

        return createGameState();
    });
}

function attachGameListener() {
    onValue(gameRef, async snap => {
        const previousBoards = boards;
        const { normalized, needsWrite } = normalizeGameData(snap.val());
        const lastMove = findLastMove(previousBoards, normalized.boards);

        applyNormalizedState(normalized);
        renderAll();

        if (lastMove) {
            highlightLastMove(lastMove.board, lastMove.cell);

            // Sound nur fuer den gegnerischen Zug (der eigene klingt schon beim Klick).
            const mover = normalized.boards[lastMove.board][lastMove.cell];
            if (gameStatus === "playing" && mover !== mySymbol) {
                playSound("opponent");
            }
        }

        if (gameStatus === "ended" && lastSeenStatus !== "ended") {
            launchConfetti();

            if (gameWinner === DRAW) {
                playSound("draw");
            } else if (isPlayer(mySymbol) && gameWinner === mySymbol) {
                playSound("win");
            } else if (isPlayer(mySymbol)) {
                playSound("lose");
            } else {
                playSound("win");
            }
        }
        lastSeenStatus = gameStatus;

        if (needsWrite) {
            await repairGameStateIfNeeded();
        }

        if (gameStatus === "ended") {
            await countGameResultIfNeeded();
        }
    });
}


// ==========================
// CLICK GAME
// ==========================

async function handleCellClick(event) {
    const boardIndex = Number(event.currentTarget.dataset.boardIndex);
    const cellIndex = Number(event.currentTarget.dataset.cellIndex);
    const localState = getLocalGameState();

    if (!isMoveAllowed(localState, boardIndex, cellIndex, mySymbol)) {
        return;
    }

    vibrate(40);
    playSound("move");
    statusText.textContent = "Zug wird synchronisiert...";

    try {
        const tx = await runTransaction(gameRef, currentGame => {
            const { normalized } = normalizeGameData(currentGame);

            if (!isMoveAllowed(normalized, boardIndex, cellIndex, mySymbol)) {
                return;
            }

            return applyMoveToState(normalized, boardIndex, cellIndex, mySymbol);
        });

        if (!tx.committed) {
            statusText.textContent = "Zug wurde abgelehnt. Spielstand wurde aktualisiert.";
        }
    } catch (error) {
        console.error("Zug konnte nicht gespeichert werden:", error);
        statusText.textContent = "Zug konnte nicht gespeichert werden.";
    }
}


// ==========================
// REMATCH / READY
// ==========================

function createRematchState(rematchGameId) {
    return {
        gameId: rematchGameId,
        readyX: false,
        readyO: false,
        claimedBy: EMPTY
    };
}

function normalizeRematchData(rawRematch) {
    if (!isRecord(rawRematch)) {
        return null;
    }

    return {
        gameId: typeof rawRematch.gameId === "string" ? rawRematch.gameId : EMPTY,
        readyX: rawRematch.readyX === true,
        readyO: rawRematch.readyO === true,
        claimedBy: typeof rawRematch.claimedBy === "string" ? rawRematch.claimedBy : EMPTY
    };
}

readyBtn.addEventListener("click", async () => {
    if (gameStatus !== "ended") return;

    if (mySymbol !== PLAYER_X && mySymbol !== PLAYER_O) {
        endgameNote.textContent = "Als Zuschauer kannst du das Ergebnis sehen. Den Neustart entscheiden nur Dino und Ente.";
        return;
    }

    if (!gameId) return;

    await runTransaction(rematchRef, currentRematch => {
        const normalized = normalizeRematchData(currentRematch);
        const nextRematch = normalized && normalized.gameId === gameId
            ? normalized
            : createRematchState(gameId);

        if (mySymbol === PLAYER_X) {
            nextRematch.readyX = true;
        } else if (mySymbol === PLAYER_O) {
            nextRematch.readyO = true;
        }

        return nextRematch;
    });
});

async function attemptRestartIfReady() {
    if (restartInProgress) return;
    if (gameStatus !== "ended") return;
    if (!rematchState) return;
    if (rematchState.gameId !== gameId) return;
    if (!rematchState.readyX || !rematchState.readyO) return;
    if (rematchState.claimedBy) return;

    restartInProgress = true;
    readyBtn.disabled = true;
    endgameNote.textContent = "Neues Spiel wird gestartet...";

    try {
        const claimTx = await runTransaction(rematchRef, currentRematch => {
            const normalized = normalizeRematchData(currentRematch);

            if (
                !normalized ||
                normalized.gameId !== gameId ||
                !normalized.readyX ||
                !normalized.readyO ||
                normalized.claimedBy
            ) {
                return;
            }

            return {
                ...normalized,
                claimedBy: playerId
            };
        });

        const claimedRematch = normalizeRematchData(claimTx.snapshot.val());

        if (!claimTx.committed || !claimedRematch || claimedRematch.claimedBy !== playerId) {
            return;
        }

        const previousGameId = gameId;
        const previousStarter = starter;
        const newGame = createGameState({ starter: getOtherPlayer(previousStarter) });

        const gameTx = await runTransaction(gameRef, currentGame => {
            const { normalized } = normalizeGameData(currentGame);

            if (normalized.gameId !== previousGameId || normalized.status !== "ended") {
                return currentGame;
            }

            return newGame;
        });

        const finalGame = normalizeGameData(gameTx.snapshot.val()).normalized;

        if (finalGame.gameId === newGame.gameId) {
            await set(rematchRef, createRematchState(newGame.gameId));
        }
    } catch (error) {
        console.error("Neustart fehlgeschlagen:", error);
        endgameNote.textContent = "Neustart konnte nicht gespeichert werden.";
    } finally {
        restartInProgress = false;
        readyBtn.disabled = false;
        updateEndgameUI();
    }
}

function attachRematchListener() {
    onValue(rematchRef, async snap => {
        rematchState = normalizeRematchData(snap.val());
        updateEndgameUI();

        if (gameStatus === "ended") {
            await attemptRestartIfReady();
        }
    });
}


// ==========================
// SURRENDER
// ==========================

async function surrender() {
    if (mySymbol !== PLAYER_X && mySymbol !== PLAYER_O) return;
    if (gameStatus !== "playing") return;

    const confirmed = window.confirm("Wirklich aufgeben? Der Gegner gewinnt sofort.");
    if (!confirmed) return;

    try {
        await runTransaction(gameRef, currentGame => {
            const { normalized } = normalizeGameData(currentGame);

            if (normalized.status !== "playing") {
                return;
            }

            return {
                ...normalized,
                forfeitedBy: mySymbol,
                winner: getOtherPlayer(mySymbol),
                status: "ended",
                activeBoard: FREE_BOARD
            };
        });
    } catch (error) {
        console.error("Aufgeben fehlgeschlagen:", error);
    }
}

surrenderBtn.addEventListener("click", surrender);


// ==========================
// THEME (Dark Mode)
// ==========================

function currentTheme() {
    return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function applyTheme(theme) {
    if (theme === "dark") {
        document.documentElement.setAttribute("data-theme", "dark");
    } else {
        document.documentElement.removeAttribute("data-theme");
    }

    themeToggle.textContent = theme === "dark" ? "☀️" : "🌙";

    try {
        localStorage.setItem("theme", theme);
    } catch (error) {
        // localStorage nicht verfuegbar - ignorieren.
    }
}

themeToggle.textContent = currentTheme() === "dark" ? "☀️" : "🌙";
themeToggle.addEventListener("click", () => {
    applyTheme(currentTheme() === "dark" ? "light" : "dark");
});


// ==========================
// SOUND
// ==========================

try {
    soundEnabled = localStorage.getItem("sound") !== "off";
} catch (error) {
    soundEnabled = true;
}

function updateSoundToggle() {
    soundToggle.textContent = soundEnabled ? "🔊" : "🔇";
}

soundToggle.addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    try {
        localStorage.setItem("sound", soundEnabled ? "on" : "off");
    } catch (error) {
        // localStorage nicht verfuegbar - ignorieren.
    }
    updateSoundToggle();
    if (soundEnabled) {
        ensureAudio();
        playSound("move");
    }
});

updateSoundToggle();


// ==========================
// START
// ==========================

async function start() {
    createBoardUI();
    renderAll();

    attachConnectionListener();
    attachDevicesListener();
    setupConnection();

    await ensureNameRegistered();

    attachPlayersListener();
    attachGameListener();
    attachRematchListener();

    await registerPlayer();
    await initializeGameIfNeeded();
}

start();
