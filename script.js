import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";

import {
    getDatabase,
    ref,
    set,
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
// SPIELER
// ==========================

const params = new URLSearchParams(window.location.search);

const mySymbol = params.get("player");

const playerInfo = document.getElementById("playerInfo");

playerInfo.textContent =
    mySymbol
        ? `Du spielst als ${mySymbol}`
        : "Kein Spieler ausgewählt!";


// ==========================
// SPIEL
// ==========================

const cells = document.querySelectorAll(".cell");
const statusText = document.getElementById("status");
const resetBtn = document.getElementById("reset");

let board = ["","","","","","","","",""];
let currentPlayer = "X";

const winPatterns = [
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
// FIREBASE SPEICHERN
// ==========================

function saveGame() {

    set(ref(db, "game"), {

        board: board,
        currentPlayer: currentPlayer

    });

}


// ==========================
// GEWINNER PRÜFEN
// ==========================

function checkWinner() {

    return winPatterns.some(pattern => {

        return pattern.every(index =>

            board[index] === currentPlayer

        );

    });

}


// ==========================
// BOARD AKTUALISIEREN
// ==========================

function updateBoard() {

    cells.forEach((cell, index) => {

        cell.textContent = board[index];

    });

    if(checkWinner()) {

        statusText.textContent =
            `Spieler ${currentPlayer} gewinnt!`;

    }
    else {

        statusText.textContent =
            `Spieler ${currentPlayer} ist dran`;

    }

}


// ==========================
// FIREBASE EMPFANGEN
// ==========================

onValue(ref(db, "game"), (snapshot) => {

    const data = snapshot.val();

    if(!data) {

        saveGame();

        return;

    }

    board = data.board;
    currentPlayer = data.currentPlayer;

    updateBoard();

});


// ==========================
// KLICK EVENTS
// ==========================

cells.forEach(cell => {

    cell.addEventListener("click", handleClick);

});

function handleClick() {

    if(mySymbol !== currentPlayer) {

        alert("Du bist nicht dran!");

        return;

    }

    const index = this.dataset.index;

    if(board[index] !== "") {

        return;

    }

    board[index] = currentPlayer;

    if(checkWinner()) {

        updateBoard();

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

resetBtn.addEventListener("click", () => {

    board = ["","","","","","","","",""];

    currentPlayer = "X";

    saveGame();

});