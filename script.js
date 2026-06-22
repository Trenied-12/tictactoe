import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
    getDatabase,
    ref,
    set,
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


// ==========================
// CONSTANTS
// ==========================

const GAME_TYPE = "ultimate-tic-tac-toe";
const SCHEMA_VERSION = 2;
const BOARD_COUNT = 9;
const CELL_COUNT = 9;
const PLAYER_X = "X";
const PLAYER_O = "O";
const SPECTATOR = "Zuschauer";
const EMPTY = "";
const DRAW = "draw";
const FREE_BOARD = -1;
const PLAYERS = [PLAYER_X, PLAYER_O];

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
// PLAYER
// ==========================

let playerId = localStorage.getItem("playerId");

if (!playerId) {
    playerId = crypto.randomUUID();
    localStorage.setItem("playerId", playerId);
}

let mySymbol = null;


// ==========================
// DOM
// ==========================

const boardElement = document.getElementById("board");
const statusText = document.getElementById("status");
const activeBoardInfo = document.getElementById("activeBoardInfo");
const playerInfo = document.getElementById("playerInfo");
const connectionInfo = document.getElementById("connectionInfo");

const endgameScreen = document.getElementById("endgameScreen");
const endgameTitle = document.getElementById("endgameTitle");
const endgameResult = document.getElementById("endgameResult");
const readyXText = document.getElementById("readyXText");
const readyOText = document.getElementById("readyOText");
const readySummaryText = document.getElementById("readySummaryText");
const readyBtn = document.getElementById("readyBtn");
const endgameNote = document.getElementById("endgameNote");

const cellButtons = [];
const miniBoards = [];
const miniBoardResults = [];


// ==========================
// GAME STATE
// ==========================

let boards = emptyBoards();
let boardWinners = emptyBoardResults();
let activeBoard = FREE_BOARD;
let currentPlayer = PLAYER_X;
let gameStatus = "playing";
let gameWinner = EMPTY;
let gameId = null;
let moveNumber = 0;

let rematchState = null;
let restartInProgress = false;
let repairInProgress = false;


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

    return {
        gameType: GAME_TYPE,
        schemaVersion: SCHEMA_VERSION,
        gameId: overrides.gameId || crypto.randomUUID(),
        boards: nextBoards,
        boardWinners: nextBoardWinners,
        activeBoard: normalizeActiveBoard(overrides.activeBoard, nextBoardWinners, nextStatus),
        currentPlayer: overrides.currentPlayer === PLAYER_O ? PLAYER_O : PLAYER_X,
        status: nextStatus,
        winner: nextWinner,
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
        raw.status === normalized.status &&
        raw.winner === normalized.winner &&
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
    const normalizedWinner = deriveOverallWinner(normalizedBoardWinners);
    const normalizedStatus = normalizedWinner !== EMPTY ? "ended" : "playing";
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
        status: normalizedStatus,
        winner: normalizedWinner,
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
        status: gameStatus,
        winner: gameWinner,
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

function getResultText() {
    if (gameWinner === DRAW) {
        return "Unentschieden!";
    }

    if (isPlayer(gameWinner)) {
        return `Spieler ${gameWinner} gewinnt!`;
    }

    return "";
}


// ==========================
// UI
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

        cellButton.textContent = value;
        cellButton.disabled = !playable;
        cellButton.classList.toggle("filled-x", value === PLAYER_X);
        cellButton.classList.toggle("filled-o", value === PLAYER_O);
        cellButton.classList.toggle("playable", playable);
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

        miniBoardResults[boardIndex].textContent =
            result === DRAW ? "=" : result;
    });
}

function getMiniBoardLabel(boardIndex, result, isActive) {
    if (result === PLAYER_X || result === PLAYER_O) {
        return `Brett ${boardIndex + 1}, gewonnen von ${result}`;
    }

    if (result === DRAW) {
        return `Brett ${boardIndex + 1}, unentschieden`;
    }

    return isActive
        ? `Brett ${boardIndex + 1}, spielbar`
        : `Brett ${boardIndex + 1}, aktuell gesperrt`;
}

function updateMainStatus() {
    if (gameStatus === "ended") {
        statusText.textContent = getResultText();
        activeBoardInfo.textContent = "Partie beendet.";
        return;
    }

    if (mySymbol === SPECTATOR) {
        statusText.textContent = `Du schaust zu. Spieler ${currentPlayer} ist dran.`;
    } else if (mySymbol === currentPlayer) {
        statusText.textContent = `Du bist dran (${mySymbol}).`;
    } else if (isPlayer(mySymbol)) {
        statusText.textContent = `Warte auf Spieler ${currentPlayer}.`;
    } else {
        statusText.textContent = `Spieler ${currentPlayer} ist dran.`;
    }

    activeBoardInfo.textContent = activeBoard === FREE_BOARD
        ? "Freie Brettwahl: Spiele in ein offenes Teilbrett."
        : `Aktives Teilbrett: ${activeBoard + 1}`;
}

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
            : `Spieler ${gameWinner} gewinnt!`;

    endgameResult.textContent = "Bereit fuer ein neues Spiel?";

    const activeRematch = rematchState && rematchState.gameId === gameId
        ? rematchState
        : { readyX: false, readyO: false };

    const readyX = !!activeRematch.readyX;
    const readyO = !!activeRematch.readyO;

    readyXText.textContent = `Spieler X: ${readyX ? "bereit" : "nicht bereit"}`;
    readyOText.textContent = `Spieler O: ${readyO ? "bereit" : "nicht bereit"}`;

    if (readyX && readyO) {
        readySummaryText.textContent = "Beide Spieler sind bereit. Neues Spiel startet...";
    } else if (mySymbol === PLAYER_X && readyX) {
        readySummaryText.textContent = "Du bist bereit. Warte auf Spieler O.";
    } else if (mySymbol === PLAYER_O && readyO) {
        readySummaryText.textContent = "Du bist bereit. Warte auf Spieler X.";
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

    readyBtn.textContent = myReady
        ? "Bereit gemeldet"
        : "Bereit fuer neues Spiel";

    readyBtn.disabled = restartInProgress || (mySymbol !== PLAYER_X && mySymbol !== PLAYER_O);

    if (mySymbol === SPECTATOR) {
        endgameNote.textContent = "Zuschauer koennen den Neustart nicht ausloesen.";
    } else if (!restartInProgress) {
        endgameNote.textContent = "";
    }
}

function renderAll() {
    updateBoardCells();
    updateMiniBoards();
    updateMainStatus();
    updateEndgameUI();
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

function updatePlayerInfo() {
    playerInfo.textContent = mySymbol
        ? `Du bist: ${mySymbol}`
        : "Spielerzuweisung laeuft...";
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

        mySymbol = deriveMySymbol(normalizePlayers(tx.snapshot.val()));
    } catch (error) {
        console.error("Spielerzuweisung fehlgeschlagen:", error);
        mySymbol = SPECTATOR;
    }

    updatePlayerInfo();
    renderAll();
}


// ==========================
// GAME SYNC
// ==========================

function applyNormalizedState(normalized) {
    boards = normalized.boards;
    boardWinners = normalized.boardWinners;
    activeBoard = normalized.activeBoard;
    currentPlayer = normalized.currentPlayer;
    gameStatus = normalized.status;
    gameWinner = normalized.winner;
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
        const { normalized, needsWrite } = normalizeGameData(snap.val());

        applyNormalizedState(normalized);
        renderAll();

        if (needsWrite) {
            await repairGameStateIfNeeded();
        }

        if (gameStatus === "ended") {
            await ensureRematchInitializedForCurrentGame();
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

async function ensureRematchInitializedForCurrentGame() {
    if (gameStatus !== "ended" || !gameId) return;

    await runTransaction(rematchRef, currentRematch => {
        const normalized = normalizeRematchData(currentRematch);

        if (normalized && normalized.gameId === gameId) {
            return normalized;
        }

        return createRematchState(gameId);
    });
}

readyBtn.addEventListener("click", async () => {
    if (gameStatus !== "ended") return;

    if (mySymbol !== PLAYER_X && mySymbol !== PLAYER_O) {
        endgameNote.textContent = "Als Zuschauer kannst du das Ergebnis sehen. Den Neustart entscheiden nur X und O.";
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
        const newGame = createGameState();

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

        if (gameStatus !== "ended") {
            updateEndgameUI();
            return;
        }

        if (!rematchState || rematchState.gameId !== gameId) {
            await ensureRematchInitializedForCurrentGame();
            return;
        }

        updateEndgameUI();
        await attemptRestartIfReady();
    });
}


// ==========================
// START
// ==========================

createBoardUI();
updatePlayerInfo();
renderAll();
attachConnectionListener();
attachGameListener();
attachRematchListener();
setupConnection();
registerPlayer();
initializeGameIfNeeded();
