const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const W = canvas.width;   // 360
const H = canvas.height;  // 640

// ---- 設定 ----
const PADDLE_H = 10;
const PADDLE_W = 80;
const BALL_R = 7;
const BLOCK_ROWS = 8;
const BLOCK_COLS = 8;
const BLOCK_H = 60;
const BLOCK_GAP = 3;
const BLOCK_TOP = 30;
const BLOCK_AREA_H = BLOCK_ROWS * (BLOCK_H + BLOCK_GAP) - BLOCK_GAP;

const LEVEL_IMAGES = [
  '../assets/images/block-kuzushi/clear1.png',
  '../assets/images/block-kuzushi/clear2.png',
  '../assets/images/block-kuzushi/clear3.png',
];

// ---- パワーアップ設定 ----
const POWERUP_CHANCE  = 0.18;
const POWERUP_SPEED   = 2.5;
const POWERUP_W       = 24;
const POWERUP_H       = 16;
const WIDE_DURATION   = 600;
const FIRE_DURATION   = 360;
const BOMB_COUNT      = 10;
const GALLERY_DELAY   = 2600; // 花火演出の長さ（ms）

const POWERUP_COLORS = {
  W: '#ab47bc', '+': '#ef5350', S: '#29b6f6', B: '#ff6d00', F: '#ff3d00',
};
const POWERUP_TABLE = ['W','W','+','+','S','S','B','F'];

// ---- 状態 ----
let state = 'idle'; // idle | playing | dead | clear | cleared
let score = 0;
let lives = 3;
let level = 1;

let paddle = { x: W / 2 - PADDLE_W / 2, y: H - 40 };
let ball = {};
let blocks = [];
let powerups = [];
let effects     = { wide: 0, fire: 0 };
let bombFlash   = 0;
let rewardCanvas = null;
let currentImageSrc = '';

// クリア演出
let particles      = [];
let fireworkTimers = [];
let clearText      = '';
let clearAnim      = 0;

// ---- ユーティリティ ----
function getPaddleW() {
  return effects.wide > 0 ? Math.round(PADDLE_W * 1.8) : PADDLE_W;
}
function blockWidth() {
  return (W - (BLOCK_COLS + 1) * BLOCK_GAP) / BLOCK_COLS;
}

// ---- 初期化系 ----
function initBall() {
  const pw = getPaddleW();
  ball = {
    x: paddle.x + pw / 2,
    y: paddle.y - BALL_R - 2,
    vx: (Math.random() > 0.5 ? 1 : -1) * (3 + level * 0.25),
    vy: -(4.5 + level * 0.4),
    onPaddle: true,
  };
}

function initBlocks() {
  blocks = [];
  const bw = blockWidth();
  const colors = ['#e040fb','#f06292','#ff8a65','#ffd54f','#aed581','#4dd0e1','#b39ddb','#ef9a9a'];
  for (let r = 0; r < BLOCK_ROWS; r++) {
    for (let c = 0; c < BLOCK_COLS; c++) {
      blocks.push({
        x: BLOCK_GAP + c * (bw + BLOCK_GAP),
        y: BLOCK_TOP + r * (BLOCK_H + BLOCK_GAP),
        w: bw, h: BLOCK_H, alive: true,
        color: colors[r % colors.length],
        points: (BLOCK_ROWS - r) * 10,
      });
    }
  }
}

function buildRewardCanvas(img) {
  const rc = document.createElement('canvas');
  rc.width = W; rc.height = H;
  const rctx = rc.getContext('2d');
  const scale = Math.max(W / img.naturalWidth, BLOCK_AREA_H / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  rctx.drawImage(img, (W - dw) / 2, BLOCK_TOP + (BLOCK_AREA_H - dh) / 2, dw, dh);
  return rc;
}

function initLevel() {
  rewardCanvas = null;
  powerups = [];
  effects.wide = 0;
  effects.fire = 0;
  bombFlash = 0;
  currentImageSrc = LEVEL_IMAGES[(level - 1) % LEVEL_IMAGES.length];
  const img = new Image();
  img.onload = () => { rewardCanvas = buildRewardCanvas(img); };
  img.src = currentImageSrc;
  initBlocks();
  initBall();
}

function resetGame() {
  fireworkTimers.forEach(t => clearTimeout(t));
  fireworkTimers = []; particles = []; clearAnim = 0;
  score = 0; lives = 3; level = 1;
  updateHUD();
  initLevel();
  state = 'idle';
  setMessage('クリックまたはタップでスタート');
  loop();
}

function updateHUD() {
  document.getElementById('score').textContent = score;
  document.getElementById('lives').textContent = lives;
  document.getElementById('level').textContent = level;
}
function setMessage(msg) {
  document.getElementById('message').textContent = msg;
}

// ---- 花火パーティクル ----
function spawnBurst(x, y) {
  const hue = Math.random() * 360;
  const count = 36;
  for (let j = 0; j < count; j++) {
    const angle = (j / count) * Math.PI * 2;
    const speed = 2 + Math.random() * 5;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 0.8,
      life: 1,
      decay: 0.011 + Math.random() * 0.009,
      color: `hsl(${hue + Math.random() * 60 - 30}, 100%, ${58 + Math.random() * 22}%)`,
      r: 1.5 + Math.random() * 2.2,
      gravity: 0.07,
    });
  }
}

function startFireworks() {
  fireworkTimers.forEach(t => clearTimeout(t));
  fireworkTimers = []; particles = [];
  for (let i = 0; i < 12; i++) {
    const t = setTimeout(() => {
      spawnBurst(
        30 + Math.random() * (W - 60),
        BLOCK_TOP + 20 + Math.random() * (BLOCK_AREA_H * 0.75),
      );
    }, i * 200 + Math.random() * 80);
    fireworkTimers.push(t);
  }
}

function updateParticles() {
  particles = particles.filter(p => {
    p.x += p.vx; p.y += p.vy;
    p.vy += p.gravity; p.vx *= 0.97;
    p.life -= p.decay;
    return p.life > 0;
  });
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = p.life * p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ---- ギャラリー ----
function showGallery(isGameClear, clearedLevel) {
  document.getElementById('gallery-img').src = currentImageSrc;
  document.getElementById('gallery-title').textContent =
    isGameClear ? '全クリア！ おめでとう！' : `Level ${clearedLevel} クリア！`;
  const btn = document.getElementById('gallery-btn');
  btn.textContent = isGameClear ? 'もう一度' : '次のレベルへ';
  btn.onclick = () => {
    hideGallery();
    if (isGameClear) resetGame(); else startNextLevel();
  };
  document.getElementById('gallery').classList.remove('hidden');
}

function hideGallery() {
  document.getElementById('gallery').classList.add('hidden');
}

// ---- 入力 ----
canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  const mx = (e.clientX - rect.left) * (W / rect.width);
  const pw = getPaddleW();
  paddle.x = Math.max(0, Math.min(W - pw, mx - pw / 2));
  if (ball.onPaddle) ball.x = paddle.x + pw / 2;
});
canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const mx = (e.touches[0].clientX - rect.left) * (W / rect.width);
  const pw = getPaddleW();
  paddle.x = Math.max(0, Math.min(W - pw, mx - pw / 2));
  if (ball.onPaddle) ball.x = paddle.x + pw / 2;
}, { passive: false });

function launch() {
  if (state === 'idle' || (state === 'playing' && ball.onPaddle)) {
    ball.onPaddle = false;
    state = 'playing';
    setMessage('');
    bgm.start();
  }
}
canvas.addEventListener('click', launch);
canvas.addEventListener('touchstart', launch, { passive: true });

// ---- パワーアップ ----
function applyPowerup(type) {
  if (type === 'W') {
    const center = paddle.x + getPaddleW() / 2;
    effects.wide = WIDE_DURATION;
    const pw = getPaddleW();
    paddle.x = Math.max(0, Math.min(W - pw, center - pw / 2));
  } else if (type === '+') {
    lives = Math.min(lives + 1, 9);
    updateHUD();
  } else if (type === 'S') {
    const speed = Math.hypot(ball.vx, ball.vy);
    if (speed > 0) { const t = Math.max(2.5, speed * 0.55); ball.vx *= t/speed; ball.vy *= t/speed; }
  } else if (type === 'B') {
    const alive = blocks.filter(b => b.alive).sort(() => Math.random() - 0.5).slice(0, BOMB_COUNT);
    for (const b of alive) { b.alive = false; score += b.points; }
    updateHUD(); bombFlash = 25;
  } else if (type === 'F') {
    effects.fire = FIRE_DURATION;
  }
}

function dropPowerup(b) {
  if (Math.random() < POWERUP_CHANCE) {
    powerups.push({
      x: b.x + b.w / 2, y: b.y + b.h / 2,
      type: POWERUP_TABLE[Math.floor(Math.random() * POWERUP_TABLE.length)],
    });
  }
}

// ---- 衝突判定 ----
function rectCircle(bx, by, bw, bh, cx, cy, r) {
  const nearX = Math.max(bx, Math.min(cx, bx + bw));
  const nearY = Math.max(by, Math.min(cy, by + bh));
  const dx = cx - nearX, dy = cy - nearY;
  return dx * dx + dy * dy < r * r;
}

// ---- ゲームロジック ----
function update() {
  if (state === 'cleared') {
    clearAnim++;
    updateParticles();
    return;
  }
  if (state !== 'playing') return;

  // エフェクトタイマー
  if (effects.wide > 0) {
    if (effects.wide === 1) {
      const center = paddle.x + getPaddleW() / 2;
      paddle.x = Math.max(0, Math.min(W - PADDLE_W, center - PADDLE_W / 2));
    }
    effects.wide--;
  }
  if (effects.fire > 0) effects.fire--;

  // パワーアップ落下
  const pw = getPaddleW();
  powerups = powerups.filter(p => {
    p.y += POWERUP_SPEED;
    if (p.y > H) return false;
    if (p.y + POWERUP_H/2 >= paddle.y && p.y - POWERUP_H/2 <= paddle.y + PADDLE_H &&
        p.x + POWERUP_W/2 >= paddle.x && p.x - POWERUP_W/2 <= paddle.x + pw) {
      applyPowerup(p.type); return false;
    }
    return true;
  });

  if (ball.onPaddle) { ball.x = paddle.x + pw / 2; return; }

  ball.x += ball.vx;
  ball.y += ball.vy;

  if (ball.x - BALL_R < 0)  { ball.x = BALL_R;       ball.vx *= -1; }
  if (ball.x + BALL_R > W)  { ball.x = W - BALL_R;   ball.vx *= -1; }
  if (ball.y - BALL_R < 0)  { ball.y = BALL_R;        ball.vy *= -1; }

  if (ball.vy > 0 &&
      ball.y + BALL_R >= paddle.y && ball.y + BALL_R <= paddle.y + PADDLE_H + Math.abs(ball.vy) &&
      ball.x >= paddle.x && ball.x <= paddle.x + pw) {
    ball.vy *= -1;
    ball.y = paddle.y - BALL_R;
    const rel = (ball.x - (paddle.x + pw / 2)) / (pw / 2);
    ball.vx = rel * 5;
    if (effects.fire > 0) effects.fire = FIRE_DURATION;
  }

  if (ball.y - BALL_R > H) {
    lives--;
    updateHUD();
    if (lives <= 0) {
      state = 'dead'; bgm.stop();
      setMessage('ゲームオーバー… クリックでリスタート');
      canvas.addEventListener('click', resetOnDead, { once: true });
      canvas.addEventListener('touchstart', resetOnDead, { once: true, passive: true });
      return;
    }
    initBall();
    setMessage('クリックで再開');
  }

  let cleared = true;
  for (const b of blocks) {
    if (!b.alive) continue;
    cleared = false;
    if (rectCircle(b.x, b.y, b.w, b.h, ball.x, ball.y, BALL_R)) {
      b.alive = false; score += b.points; updateHUD(); dropPowerup(b);
      if (effects.fire <= 0) {
        const ol = ball.x - b.x, or_ = b.x + b.w - ball.x;
        const ot = ball.y - b.y, ob  = b.y + b.h - ball.y;
        if (Math.min(ol, or_) < Math.min(ot, ob)) ball.vx *= -1; else ball.vy *= -1;
      }
    }
  }
  if (cleared) onClear();
}

function resetOnDead() { resetGame(); }

function onClear() {
  bgm.stop();
  const clearedLevel = level;
  const isGameClear  = clearedLevel >= 3;
  state = 'cleared';
  clearAnim = 0;
  clearText = isGameClear ? '全クリア！' : `Level ${clearedLevel} クリア！`;

  if (!isGameClear) { level++; updateHUD(); }

  startFireworks();
  setMessage('');

  const tid = setTimeout(() => {
    if (state === 'cleared') showGallery(isGameClear, clearedLevel);
  }, GALLERY_DELAY);
  fireworkTimers.push(tid);
}

function startNextLevel() {
  particles = []; clearAnim = 0;
  initLevel();
  state = 'idle';
  setMessage('クリックでスタート');
}

// ---- 描画 ----
function draw() {
  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(0, 0, W, H);

  if (bombFlash > 0) {
    ctx.fillStyle = `rgba(255,109,0,${bombFlash / 25 * 0.45})`;
    ctx.fillRect(0, 0, W, H);
    bombFlash--;
  }

  // 消えたブロックの位置に画像を表示
  if (rewardCanvas) {
    for (const b of blocks) {
      if (b.alive) continue;
      ctx.drawImage(rewardCanvas, b.x, b.y, b.w, b.h, b.x, b.y, b.w, b.h);
    }
  }

  if (state !== 'cleared') {
    // 残っているブロック
    for (const b of blocks) {
      if (!b.alive) continue;
      ctx.fillStyle = b.color;
      ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 3); ctx.fill();
    }

    // パワーアップ
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 11px sans-serif';
    for (const p of powerups) {
      ctx.fillStyle = POWERUP_COLORS[p.type];
      ctx.beginPath(); ctx.roundRect(p.x - POWERUP_W/2, p.y - POWERUP_H/2, POWERUP_W, POWERUP_H, 5); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillText(p.type, p.x, p.y);
    }

    // タイマーバー（wide）
    if (effects.wide > 0) {
      const r = effects.wide / WIDE_DURATION;
      ctx.fillStyle = '#2a0a2a'; ctx.fillRect(0, paddle.y - 6, W, 3);
      ctx.fillStyle = '#ce93d8'; ctx.fillRect(0, paddle.y - 6, W * r, 3);
    }
    // タイマーバー（fire）
    if (effects.fire > 0) {
      const r = effects.fire / FIRE_DURATION;
      const by = paddle.y - (effects.wide > 0 ? 11 : 6);
      ctx.fillStyle = '#2a0800'; ctx.fillRect(0, by, W, 3);
      ctx.fillStyle = '#ff6d00'; ctx.fillRect(0, by, W * r, 3);
    }

    // パドル
    const pw = getPaddleW();
    ctx.fillStyle = effects.wide > 0 ? '#ce93d8' : '#00e5ff';
    ctx.beginPath(); ctx.roundRect(paddle.x, paddle.y, pw, PADDLE_H, 5); ctx.fill();

    // ボール
    ctx.save();
    if (effects.fire > 0) { ctx.shadowColor = '#ff6d00'; ctx.shadowBlur = 14; ctx.fillStyle = '#ff9800'; }
    else { ctx.fillStyle = '#fff'; }
    ctx.beginPath(); ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // クリア演出
  if (state === 'cleared') {
    // ブロックエリアを薄く暗くしてテキストを見やすく
    ctx.fillStyle = 'rgba(0,0,8,0.38)';
    ctx.fillRect(0, BLOCK_TOP, W, BLOCK_AREA_H);

    // クリアテキスト（スケールアニメ）
    const s = Math.min(1.08, clearAnim / 18) * (1 + 0.05 * Math.sin(clearAnim * 0.13));
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.round(36 * s)}px sans-serif`;
    ctx.shadowColor = '#ff6d00'; ctx.shadowBlur = 22;
    ctx.fillStyle = '#ffd54f';
    ctx.fillText(clearText, W / 2, BLOCK_TOP + BLOCK_AREA_H / 2);
    ctx.restore();

    drawParticles();
  }
}

// ---- ループ ----
let rafId;
function loop() {
  cancelAnimationFrame(rafId);
  update(); draw();
  rafId = requestAnimationFrame(loop);
}

// ---- ミュートボタン ----
document.getElementById('mute-btn').addEventListener('click', () => {
  const on = bgm.toggle();
  document.getElementById('mute-btn').textContent = on ? '🔊' : '🔇';
});

// ---- 初期化 ----
initLevel();
loop();
