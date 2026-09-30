const COLS = 10;
const ROWS = 20;
const CELL = 30;
const NEXT_CELL = 24;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next');
const nextCtx = nextCanvas.getContext('2d');

const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const highScoreEl = document.getElementById('high-score');
const nextNameEl = document.getElementById('next-name');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayMessage = document.getElementById('overlay-message');
const restartButton = document.getElementById('restart');

const PIECES = {
  I: { color: '#58a6ff', shape: [[1, 1, 1, 1]] },
  O: { color: '#f2cc60', shape: [[1, 1], [1, 1]] },
  T: { color: '#bc8cff', shape: [[0, 1, 0], [1, 1, 1]] },
  S: { color: '#56d364', shape: [[0, 1, 1], [1, 1, 0]] },
  Z: { color: '#ff7b72', shape: [[1, 1, 0], [0, 1, 1]] },
  J: { color: '#79c0ff', shape: [[1, 0, 0], [1, 1, 1]] },
  L: { color: '#ffa657', shape: [[0, 0, 1], [1, 1, 1]] }
};

let board;
let current;
let nextType;
let score;
let lines;
let level;
let dropInterval;
let dropCounter;
let lastTime;
let paused;
let gameOver;
let animationId;
let highScore = Number(localStorage.getItem('tetris-high-score') || 0);

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function randomType() {
  const types = Object.keys(PIECES);
  return types[Math.floor(Math.random() * types.length)];
}

function spawn(type) {
  const pieceType = type || randomType();
  const shape = PIECES[pieceType].shape.map(row => [...row]);
  current = {
    type: pieceType,
    color: PIECES[pieceType].color,
    shape,
    x: Math.floor((COLS - shape[0].length) / 2),
    y: 0
  };

  nextType = randomType();
  updateNextPreview();

  if (collides(current)) {
    gameOver = true;
    paused = false;
    showOverlay('Game Over', 'Press R or Restart game to play again.');
  }
}

function collides(piece, dx = 0, dy = 0, testShape = piece.shape) {
  for (let y = 0; y < testShape.length; y++) {
    for (let x = 0; x < testShape[y].length; x++) {
      if (!testShape[y][x]) continue;
      const nx = piece.x + x + dx;
      const ny = piece.y + y + dy;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function merge() {
  current.shape.forEach((row, y) => row.forEach((value, x) => {
    if (value) board[current.y + y][current.x + x] = current.color;
  }));
}

function clearLines() {
  let cleared = 0;
  for (let y = ROWS - 1; y >= 0; y--) {
    if (board[y].every(Boolean)) {
      board.splice(y, 1);
      board.unshift(Array(COLS).fill(null));
      cleared++;
      y++;
    }
  }

  if (!cleared) return;

  const points = [0, 100, 300, 500, 800][cleared] * level;
  score += points;
  lines += cleared;
  level = Math.floor(lines / 10) + 1;
  dropInterval = Math.max(90, 800 - (level - 1) * 65);
  saveHighScore();
  updateStats();
}

function move(dx) {
  if (paused || gameOver) return;
  if (!collides(current, dx, 0)) current.x += dx;
}

function softDrop() {
  if (paused || gameOver) return;
  if (!collides(current, 0, 1)) {
    current.y++;
    score += 1;
    saveHighScore();
    updateStats();
  } else {
    lockPiece();
  }
  dropCounter = 0;
}

function hardDrop() {
  if (paused || gameOver) return;
  let distance = 0;
  while (!collides(current, 0, 1)) {
    current.y++;
    distance++;
  }
  score += distance * 2;
  saveHighScore();
  updateStats();
  lockPiece();
}

function rotateMatrix(matrix, direction = 1) {
  const rotated = matrix[0].map((_, index) =>
    matrix.map(row => row[index]).reverse()
  );
  if (direction < 0) {
    return rotated[0].map((_, index) => rotated.map(row => row[index]).reverse());
  }
  return rotated;
}

function rotate(direction) {
  if (paused || gameOver) return;
  const rotated = rotateMatrix(current.shape, direction);
  const offsets = [0, -1, 1, -2, 2];
  for (const offset of offsets) {
    if (!collides(current, offset, 0, rotated)) {
      current.x += offset;
      current.shape = rotated;
      return;
    }
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn(nextType);
  dropCounter = 0;
}

function restart() {
  cancelAnimationFrame(animationId);
  board = createBoard();
  current = null;
  nextType = randomType();
  score = 0;
  lines = 0;
  level = 1;
  dropInterval = 800;
  dropCounter = 0;
  lastTime = performance.now();
  paused = false;
  gameOver = false;
  hideOverlay();
  updateStats();
  spawn(nextType);
  animationId = requestAnimationFrame(update);
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (paused) showOverlay('Paused', 'Press P to continue.');
  else hideOverlay();
}

function update(time = 0) {
  const delta = time - lastTime;
  lastTime = time;

  if (!paused && !gameOver) {
    dropCounter += delta;
    if (dropCounter > dropInterval) {
      if (!collides(current, 0, 1)) current.y++;
      else lockPiece();
      dropCounter = 0;
    }
  }

  draw();
  animationId = requestAnimationFrame(update);
}

function drawCell(renderCtx, x, y, size, color, alpha = 1) {
  renderCtx.globalAlpha = alpha;
  renderCtx.fillStyle = color;
  renderCtx.fillRect(x + 1, y + 1, size - 2, size - 2);
  renderCtx.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = 'rgba(255,255,255,0.055)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= COLS; x++) {
    ctx.beginPath();
    ctx.moveTo(x * CELL + 0.5, 0);
    ctx.lineTo(x * CELL + 0.5, ROWS * CELL);
    ctx.stroke();
  }
  for (let y = 0; y <= ROWS; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * CELL + 0.5);
    ctx.lineTo(COLS * CELL, y * CELL + 0.5);
    ctx.stroke();
  }
}

function drawGhost() {
  let ghostY = current.y;
  while (!collides({ ...current, y: ghostY }, 0, 1)) ghostY++;
  current.shape.forEach((row, y) => row.forEach((value, x) => {
    if (value) drawCell(ctx, (current.x + x) * CELL, (ghostY + y) * CELL, CELL, current.color, 0.16);
  }));
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#05070a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  board.forEach((row, y) => row.forEach((color, x) => {
    if (color) drawCell(ctx, x * CELL, y * CELL, CELL, color);
  }));

  if (current && !gameOver) {
    drawGhost();
    current.shape.forEach((row, y) => row.forEach((value, x) => {
      if (value) drawCell(ctx, (current.x + x) * CELL, (current.y + y) * CELL, CELL, current.color);
    }));
  }
}

function updateNextPreview() {
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  nextCtx.fillStyle = '#05070a';
  nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
  if (!nextType) return;

  const piece = PIECES[nextType];
  nextNameEl.textContent = nextType;
  const shape = piece.shape;
  const offsetX = Math.floor((nextCanvas.width / NEXT_CELL - shape[0].length) / 2) * NEXT_CELL;
  const offsetY = Math.floor((nextCanvas.height / NEXT_CELL - shape.length) / 2) * NEXT_CELL;
  shape.forEach((row, y) => row.forEach((value, x) => {
    if (value) drawCell(nextCtx, offsetX + x * NEXT_CELL, offsetY + y * NEXT_CELL, NEXT_CELL, piece.color);
  }));
}

function updateStats() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines.toLocaleString();
  levelEl.textContent = level.toLocaleString();
  highScoreEl.textContent = highScore.toLocaleString();
}

function saveHighScore() {
  if (score > highScore) {
    highScore = score;
    localStorage.setItem('tetris-high-score', String(highScore));
  }
}

function showOverlay(title, message) {
  overlayTitle.textContent = title;
  overlayMessage.textContent = message;
  overlay.classList.remove('hidden');
}

function hideOverlay() {
  overlay.classList.add('hidden');
}

document.addEventListener('keydown', event => {
  const key = event.key.toLowerCase();
  if (['arrowleft', 'arrowright', 'arrowdown', ' ', 'z', 'x'].includes(key)) event.preventDefault();

  switch (key) {
    case 'arrowleft': move(-1); break;
    case 'arrowright': move(1); break;
    case 'arrowdown': softDrop(); break;
    case ' ': hardDrop(); break;
    case 'z': rotate(-1); break;
    case 'x':
    case 'arrowup': rotate(1); break;
    case 'p': togglePause(); break;
    case 'r': restart(); break;
  }
});

restartButton.addEventListener('click', restart);

restart();