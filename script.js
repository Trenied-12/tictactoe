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

cells.forEach(cell => {
    cell.addEventListener("click", handleClick);
});

function handleClick() {
    const index = this.dataset.index;

    if(board[index] !== "") return;

    board[index] = currentPlayer;
    this.textContent = currentPlayer;

    if(checkWinner()){
        statusText.textContent =
            `Spieler ${currentPlayer} gewinnt!`;
        return;
    }

    currentPlayer =
        currentPlayer === "X" ? "O" : "X";

    statusText.textContent =
        `Spieler ${currentPlayer} ist dran`;
}

function checkWinner(){
    return winPatterns.some(pattern => {
        return pattern.every(index =>
            board[index] === currentPlayer
        );
    });
}

resetBtn.addEventListener("click", () => {
    board = ["","","","","","","","",""];

    cells.forEach(cell => {
        cell.textContent = "";
    });

    currentPlayer = "X";
    statusText.textContent =
        "Spieler X ist dran";
});