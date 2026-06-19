import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";

import {
    getDatabase,
    ref,
    set,
    get,
    onValue
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


// ==========================
// SPIELER ID
// ==========================

let playerId = localStorage.getItem("playerId");

if (!playerId) {

    playerId =
        crypto.randomUUID();

    localStorage.setItem(
        "playerId",
        playerId
    );
}

let mySymbol = null;


// ==========================
// SPIELER REGISTRIEREN
// ==========================

async function registerPlayer() {

    const snapshot =
        await get(ref(db, "players"));

    const players =
        snapshot.val() || {};

    if (players.X === playerId) {

        mySymbol = "X";

    } else if (players.O === playerId) {

        mySymbol = "O";

    } else if (!players.X) {

        await set(
            ref(db, "players/X"),
            playerId
        );

        mySymbol = "X";

    } else if (!players.O) {

        await set(
            ref(db, "players/O"),
            playerId
        );

        mySymbol = "O";

    } else {

        mySymbol = "Zuschauer";

    }

    playerInfo.textContent =
        `Du bist: ${mySymbol}`;
}


// ==========================
// DOM
// ==========================

const cells =
    document.querySelectorAll(".cell");

const statusText =
    document.getElementById("status");

const resetBtn =
    document.getElementById("reset");

const playerInfo =
    document.getElementById("playerInfo");


// ==========================
// SPIEL
// ==========================

let board =
[
    "","","",
    "","","",
    "","",""
];

let currentPlayer = "X";

const winPatterns =
[
    [0,1,2],
    [3,4,5],
    [6,7,8],
    [0,3,6],
    [1,4,7],
    [2,5,8],
    [0,4,8],
    [2,4,6]
];


// ==========================
// SPEICHERN
// ==========================

function saveGame() {

    set(ref(db, "game"), {

        board,
        currentPlayer

    });

}


// ==========================
// GEWINNER
// ==========================

function checkWinner() {

    return winPatterns.some(pattern =>

        pattern.every(index =>

            board[index] === currentPlayer

        )

    );

}


// ==========================
// UI
// ==========================

function updateBoard() {

    cells.forEach((cell,index) => {

        cell.textContent =
            board[index];

    });

    if (checkWinner()) {

        statusText.textContent =
            `Spieler ${currentPlayer} gewinnt!`;

    }
    else {

        statusText.textContent =
            `Spieler ${currentPlayer} ist dran`;

    }

}


// ==========================
// LIVE DATEN
// ==========================

onValue(ref(db, "game"), snapshot => {

    const data =
        snapshot.val();

    if (!data) {

        saveGame();

        return;
    }

    board =
        data.board;

    currentPlayer =
        data.currentPlayer;

    updateBoard();

});


// ==========================
// KLICK
// ==========================

cells.forEach(cell => {

    cell.addEventListener(
        "click",
        handleClick
    );

});

function handleClick() {

    if (
        mySymbol === "Zuschauer"
    ) {

        alert(
            "Du bist Zuschauer."
        );

        return;
    }

    if (
        mySymbol !== currentPlayer
    ) {

        alert(
            "Du bist nicht dran!"
        );

        return;
    }

    const index =
        this.dataset.index;

    if (
        board[index] !== ""
    ) {
        return;
    }

    board[index] =
        currentPlayer;

    if (checkWinner()) {

        saveGame();

        return;
    }

    currentPlayer =
        currentPlayer === "X"
        ? "O"
        : "X";

    saveGame();

}


// ==========================
// RESET
// ==========================

resetBtn.addEventListener(
    "click",
    () => {

        board =
        [
            "","","",
            "","","",
            "","",""
        ];

        currentPlayer =
            "X";

        saveGame();

    }
);


// ==========================
// START
// ==========================

registerPlayer();