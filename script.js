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

const cells = document.querySelectorAll(".cell");
const statusText = document.getElementById("status");
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


// ==========================
// GAME STATE
// ==========================

let board = emptyBoard();
let currentPlayer = "X";
let gameStatus = "playing";
let gameWinner = null;
let gameId = null;

let rematchState = null;
let restartInProgress = false;


// ==========================
// HELPERS
// ==========================

function emptyBoard() {
    return ["", "", "", "", "", "", "", "", ""];
}

function checkWinner(boardToCheck) {
    const patterns = [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],
        [0, 4, 8],
        [2, 4, 6]
    ];

    for (const pattern of patterns) {
        const [a, b, c] = pattern;
        if (
            boardToCheck[a] &&
            boardToCheck[a] === boardToCheck[b] &&
            boardToCheck[a] === boardToCheck[c]
        ) {
            return boardToCheck[a];
        }
    }

    return null;
}

function isBoardFull(boardToCheck) {
    return boardToCheck.every(cell => cell !== "");
}

function createGameState(overrides = {}) {
    return {
        board: emptyBoard(),
        currentPlayer: "X",
        status: "playing",
        winner: null,
        gameId: crypto.randomUUID(),
        ...overrides
    };
}

function normalizeGameData(raw) {
    const hasOwn = Object.prototype.hasOwnProperty;

    const normalizedBoard = Array.isArray(raw.board) && raw.board.length === 9
        ? raw.board.map(cell => (cell === "X" || cell === "O") ? cell : "")
        : emptyBoard();

    const normalizedCurrentPlayer = raw.currentPlayer === "O" ? "O" : "X";

    let normalizedStatus = raw.status === "ended" ? "ended" : "playing";
    let normalizedWinner = raw.winner === "X" || raw.winner === "O" || raw.winner === "draw"
        ? raw.winner
        : null;

    const computedWinner = checkWinner(normalizedBoard);

    if (computedWinner) {
        normalizedStatus = "ended";
        normalizedWinner = computedWinner;
    } else if (isBoardFull(normalizedBoard)) {
        normalizedStatus = "ended";
        normalizedWinner = "draw";
    }

    const normalizedGameId =
        typeof raw.gameId === "string" && raw.gameId.trim() !== ""
            ? raw.gameId
            : crypto.randomUUID();

    const normalized = {
        board: normalizedBoard,
        currentPlayer: normalizedCurrentPlayer,
        status: normalizedStatus,
        winner: normalizedWinner,
        gameId: normalizedGameId
    };

    const needsWrite =
        !raw ||
        !hasOwn.call(raw, "status") ||
        !hasOwn.call(raw, "winner") ||
        !hasOwn.call(raw, "gameId") ||
        !Array.isArray(raw.board) ||
        raw.board.length !== 9 ||
        raw.currentPlayer !== normalizedCurrentPlayer ||
        raw.status !== normalizedStatus ||
        raw.winner !== normalizedWinner;

    return { normalized, needsWrite };
}

function getResultText() {
    if (gameWinner === "draw") {
        return "Unentschieden!";
    }

    if (gameWinner === "X" || gameWinner === "O") {
        return `Spieler ${gameWinner} gewinnt!`;
    }

    return "";
}

function updateBoardCells() {
    cells.forEach((cell, index) => {
        cell.textContent = board[index];
    });
}

function updateMainStatus() {
    if (gameStatus === "ended") {
        statusText.textContent = getResultText();
        return;
    }

    statusText.textContent = `Spieler ${currentPlayer} ist dran`;
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
        return;
    }

    showEndgameScreen();

    endgameTitle.textContent =
        gameWinner === "draw"
            ? "Unentschieden!"
            : `Spieler ${gameWinner} gewinnt!`;

    endgameResult.textContent =
        "Bereit für ein neues Spiel?";

    const readyX = !!rematchState?.readyX;
    const readyO = !!rematchState?.readyO;

    readyXText.textContent = `Spieler X: ${readyX ? "bereit" : "nicht bereit"}`;
    readyOText.textContent = `Spieler O: ${readyO ? "bereit" : "nicht bereit"}`;

    if (readyX && readyO) {
        readySummaryText.textContent = "Beide Spieler sind bereit. Neues Spiel startet...";
    } else if (mySymbol === "X" && readyX) {
        readySummaryText.textContent = "Du bist bereit. Warte auf Spieler O.";
    } else if (mySymbol === "O" && readyO) {
        readySummaryText.textContent = "Du bist bereit. Warte auf Spieler X.";
    } else if (readyX || readyO) {
        readySummaryText.textContent = "Ein Spieler ist bereit. Warte auf den Gegner.";
    } else {
        readySummaryText.textContent = "Warte auf Bereitschaft beider Spieler.";
    }

    const myReady =
        mySymbol === "X"
            ? readyX
            : mySymbol === "O"
                ? readyO
                : false;

    readyBtn.textContent = myReady
        ? "Bereit ✅"
        : "Bereit für neues Spiel";

    readyBtn.disabled = restartInProgress;
}

function renderAll() {
    updateBoardCells();
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

onValue(ref(db, "connections"), (snap) => {
    const data = snap.val() || {};
    connectionInfo.textContent = `Verbunden: ${Object.keys(data).length}`;
});


// ==========================
// PLAYER SYSTEM
// ==========================

async function registerPlayer() {
    const snap = await get(ref(db, "players"));
    const players = snap.val() || {};

    if (players.X === playerId) {
        mySymbol = "X";
    } else if (players.O === playerId) {
        mySymbol = "O";
    } else if (!players.X) {
        await set(ref(db, "players/X"), playerId);
        mySymbol = "X";
    } else if (!players.O) {
        await set(ref(db, "players/O"), playerId);
        mySymbol = "O";
    } else {
        mySymbol = "Zuschauer";
    }

    playerInfo.textContent = `Du bist: ${mySymbol}`;
    updateEndgameUI();
}


// ==========================
// GAME SYNC
// ==========================

async function initializeGameIfNeeded() {
    const initialGame = createGameState();
    await set(gameRef, initialGame);
}

onValue(gameRef, async (snap) => {
    const data = snap.val();

    if (!data) {
        await initializeGameIfNeeded();
        return;
    }

    const { normalized, needsWrite } = normalizeGameData(data);

    board = normalized.board;
    currentPlayer = normalized.currentPlayer;
    gameStatus = normalized.status;
    gameWinner = normalized.winner;
    gameId = normalized.gameId;

    renderAll();

    if (needsWrite) {
        await set(gameRef, normalized);
    }

    if (gameStatus === "ended") {
        if (!rematchState || rematchState.gameId !== gameId) {
            await set(rematchRef, {
                gameId,
                readyX: false,
                readyO: false,
                claimedBy: null
            });
        }
    }
});


// ==========================
// CLICK GAME
// ==========================

cells.forEach(cell => cell.addEventListener("click", handleClick));

function handleClick() {
    if (gameStatus !== "playing") return;
    if (mySymbol === "Zuschauer") return;
    if (mySymbol !== currentPlayer) return;

    const index = Number(this.dataset.index);

    if (board[index] !== "") return;

    board[index] = currentPlayer;

    const winner = checkWinner(board);
    const full = isBoardFull(board);

    if (winner) {
        gameStatus = "ended";
        gameWinner = winner;
        persistGameState();
        return;
    }

    if (full) {
        gameStatus = "ended";
        gameWinner = "draw";
        persistGameState();
        return;
    }

    currentPlayer = currentPlayer === "X" ? "O" : "X";
    persistGameState();
}

function persistGameState() {
    if (!gameId) {
        gameId = crypto.randomUUID();
    }

    set(gameRef, {
        board,
        currentPlayer,
        status: gameStatus,
        winner: gameWinner,
        gameId
    });
}


// ==========================
// REMATCH / READY
// ==========================

function ensureRematchInitializedForCurrentGame() {
    if (gameStatus !== "ended") return;
    if (!gameId) return;

    if (rematchState && rematchState.gameId === gameId) return;

    set(rematchRef, {
        gameId,
        readyX: false,
        readyO: false,
        claimedBy: null
    });
}

readyBtn.addEventListener("click", async () => {
    if (gameStatus !== "ended") return;

    if (mySymbol !== "X" && mySymbol !== "O") {
        endgameNote.textContent = "Als Zuschauer kannst du das Ergebnis sehen. Den Neustart entscheiden nur X und O.";
        return;
    }

    if (!gameId) return;

    await set(ref(db, `rematch/ready${mySymbol}`), true);
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

    try {
        const claimRef = ref(db, "rematch/claimedBy");

        const tx = await runTransaction(claimRef, current => {
            if (current === null || current === undefined || current === "") {
                return playerId;
            }
            return current;
        });

        if (!tx.committed) return;
        if (tx.snapshot.val() !== playerId) return;

        const newGame = createGameState({
            board: emptyBoard(),
            currentPlayer: "X",
            status: "playing",
            winner: null
        });

        await set(gameRef, newGame);

        await set(rematchRef, {
            gameId: newGame.gameId,
            readyX: false,
            readyO: false,
            claimedBy: null
        });
    } finally {
        restartInProgress = false;
        readyBtn.disabled = false;
    }
}

onValue(rematchRef, async (snap) => {
    rematchState = snap.val();

    if (gameStatus !== "ended") {
        return;
    }

    if (!rematchState || rematchState.gameId !== gameId) {
        ensureRematchInitializedForCurrentGame();
        return;
    }

    updateEndgameUI();
    await attemptRestartIfReady();
});


// ==========================
// START
// ==========================

setupConnection();
registerPlayer();