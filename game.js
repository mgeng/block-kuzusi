const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const W = canvas.width;   // 360
const H = canvas.height;  // 640

// ---- 設定 ----
const PADDLE_H = 10;
const BALL_R = 7;
const BLOCK_ROWS = 8;
const BLOCK_COLS = 8;
const BLOCK_H = 60;
const BLOCK_GAP = 3;
const BLOCK_TOP = 30;
const BLOCK_AREA_H = BLOCK_ROWS * (BLOCK_H + BLOCK_GAP) - BLOCK_GAP;

const MODES = {
  p: {
    label: '簡単',
    lives: 7,
    paddleW: 120,
    paddleSpeed: 8,
    powerupChance: 0.38,
    powerupSpeed: 2,
    ballVxBase: 2.1,
    ballVxLevel: 0.14,
    ballVyBase: 3.3,
    ballVyLevel: 0.22,
    maxBallSpeed: 5.6,
  },
  n: {
    label: '普通',
    lives: 5,
    paddleW: 100,
    paddleSpeed: 8,
    powerupChance: 0.3,
    powerupSpeed: 2.2,
    ballVxBase: 2.4,
    ballVxLevel: 0.18,
    ballVyBase: 3.7,
    ballVyLevel: 0.28,
    maxBallSpeed: 6.2,
  },
  g: {
    label: '難しい',
    lives: 1,
    paddleW: 72,
    paddleSpeed: 7,
    powerupChance: 0.08,
    powerupSpeed: 2.8,
    ballVxBase: 3.1,
    ballVxLevel: 0.26,
    ballVyBase: 4.7,
    ballVyLevel: 0.42,
    maxBallSpeed: 8,
  },
};

const LEVELS = [
  {
    image: 'assets/images/block-kuzushi/reward1.webp',
    bgm: 'assets/bgm/block-kuzushi.mp3',
  },
  {
    image: 'assets/images/block-kuzushi/reward2.webp',
    bgm: 'assets/bgm/8bit-Func.mp3',
  },
  {
    image: 'assets/images/block-kuzushi/reward3.webp',
    bgm: 'assets/bgm/D1.mp3',
  },
  {
    image: 'assets/images/block-kuzushi/reward4.webp',
    bgm: 'assets/bgm/D4.mp3',
  },
  {
    image: 'assets/images/block-kuzushi/reward5.webp',
    bgm: 'assets/bgm/D6-2.mp3',
  },
  {
    image: 'assets/images/block-kuzushi/reward6.webp',
    bgm: 'assets/bgm/Untitled.mp3',
  },
];

// ---- パワーアップ設定 ----
const POWERUP_W       = 24;
const POWERUP_H       = 16;
const WIDE_DURATION   = 600;
const FIRE_DURATION   = 360;
const BOMB_COUNT      = 10;
const GALLERY_DELAY   = 2600; // 花火演出の長さ（ms）
const GAME_OVER_DELAY = 1200;
const GAME_OVER_IMAGE = 'assets/images/block-kuzushi/game-over.webp';

const POWERUP_COLORS = {
  W: '#ab47bc', '+': '#ef5350', S: '#29b6f6', B: '#ff6d00', F: '#ff3d00',
};
const POWERUP_TABLE = ['W','W','+','+','S','S','B','F'];

// ---- 状態 ----
let state = 'idle'; // idle | playing | dead | clear | cleared
let score = 0;
let lives = 5;
let level = 1;
let mode = 'n';

let paddle = { x: W / 2 - MODES.n.paddleW / 2, y: H - 40 };
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
function modeConfig() {
  return MODES[mode];
}

function getPaddleW() {
  const baseW = modeConfig().paddleW;
  return effects.wide > 0 ? Math.round(baseW * 1.8) : baseW;
}
function blockWidth() {
  return (W - (BLOCK_COLS + 1) * BLOCK_GAP) / BLOCK_COLS;
}

// ---- 初期化系 ----
function initBall() {
  const pw = getPaddleW();
  const cfg = modeConfig();
  ball = {
    x: paddle.x + pw / 2,
    y: paddle.y - BALL_R - 2,
    vx: (Math.random() > 0.5 ? 1 : -1) * (cfg.ballVxBase + level * cfg.ballVxLevel),
    vy: -(cfg.ballVyBase + level * cfg.ballVyLevel),
    onPaddle: true,
  };
}

function initBlocks() {
  blocks = [];
  const bw = blockWidth();
  const colors = ['#ff2d95','#ff4b2f','#ffd34d','#39ff88','#19f6ff','#4d7dff','#b45cff','#ffffff'];
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
  const levelConfig = LEVELS[level - 1];
  currentImageSrc = levelConfig.image;
  bgm.setSrc(levelConfig.bgm);
  const img = new Image();
  img.onload = () => { rewardCanvas = buildRewardCanvas(img); };
  img.src = currentImageSrc;
  initBlocks();
  initBall();
}

function resetGame() {
  fireworkTimers.forEach(t => clearTimeout(t));
  fireworkTimers = []; particles = []; clearAnim = 0;
  score = 0; lives = modeConfig().lives; level = 1;
  paddle = { x: W / 2 - getPaddleW() / 2, y: H - 40 };
  updateHUD();
  initLevel();
  state = 'idle';
  setMessage(`${modeConfig().label}: クリック / タップ / Space でスタート`);
  loop();
}

function updateHUD() {
  document.getElementById('score').textContent = score;
  document.getElementById('lives').textContent = lives;
  document.getElementById('level').textContent = level;
  document.getElementById('mode').textContent = modeConfig().label;
}
function setMessage(msg) {
  document.getElementById('message').textContent = msg;
}

function updateModeButtons() {
  document.querySelectorAll('.route-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
}

function setMode(nextMode) {
  if (!MODES[nextMode]) return;
  mode = nextMode;
  bgm.stop();
  hideGallery();
  updateModeButtons();
  resetGame();
}

// ---- 効果音 ----
let audioCtx = null;
let sfxEnabled = true;

function getAudioContext() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playTone(freq, duration = 0.08, type = 'square', volume = 0.08, endFreq = freq) {
  if (!sfxEnabled) return;
  const ac = getAudioContext();
  const now = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), now + duration);
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(now);
  osc.stop(now + duration);
}

function playNoise(duration = 0.12, volume = 0.05) {
  if (!sfxEnabled) return;
  const ac = getAudioContext();
  const buffer = ac.createBuffer(1, Math.floor(ac.sampleRate * duration), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  const gain = ac.createGain();
  src.buffer = buffer;
  gain.gain.setValueAtTime(volume, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
  src.connect(gain).connect(ac.destination);
  src.start();
}

function playSfx(name) {
  if (!sfxEnabled) return;
  if (name === 'launch') playTone(440, 0.08, 'triangle', 0.07, 760);
  else if (name === 'wall') playTone(280, 0.035, 'square', 0.035, 220);
  else if (name === 'paddle') playTone(520, 0.055, 'square', 0.06, 740);
  else if (name === 'block') playTone(760, 0.05, 'square', 0.055, 420);
  else if (name === 'powerup') {
    playTone(660, 0.06, 'triangle', 0.06, 880);
    setTimeout(() => playTone(990, 0.06, 'triangle', 0.05, 1320), 55);
  } else if (name === 'bomb') {
    playNoise(0.18, 0.08);
    playTone(140, 0.16, 'sawtooth', 0.07, 60);
  } else if (name === 'miss') playTone(220, 0.16, 'sawtooth', 0.06, 90);
  else if (name === 'gameover') playTone(180, 0.35, 'sawtooth', 0.07, 50);
  else if (name === 'clear') {
    [523, 659, 784, 1047].forEach((freq, i) => {
      setTimeout(() => playTone(freq, 0.12, 'triangle', 0.06, freq * 1.1), i * 90);
    });
  }
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
    isGameClear ? `${modeConfig().label} 全クリア！` : `${modeConfig().label} Level ${clearedLevel} クリア！`;
  const btn = document.getElementById('gallery-btn');
  btn.textContent = isGameClear ? 'もう一度' : '次のレベルへ';
  btn.onclick = () => {
    hideGallery();
    if (isGameClear) resetGame(); else startNextLevel();
  };
  document.getElementById('gallery').classList.remove('hidden');
}

function showGameOverGallery() {
  document.getElementById('gallery-img').src = GAME_OVER_IMAGE;
  document.getElementById('gallery-title').textContent = '残念…';
  const btn = document.getElementById('gallery-btn');
  btn.textContent = 'もう一度';
  btn.onclick = () => {
    hideGallery();
    resetGame();
  };
  document.getElementById('gallery').classList.remove('hidden');
}

function hideGallery() {
  document.getElementById('gallery').classList.add('hidden');
}

// ---- 入力 ----
const keys = {
  left: false,
  right: false,
};

function movePaddleBy(dx) {
  const pw = getPaddleW();
  paddle.x = Math.max(0, Math.min(W - pw, paddle.x + dx));
  if (ball.onPaddle) ball.x = paddle.x + pw / 2;
}

function updateKeyboardMovement() {
  if (state !== 'idle' && state !== 'playing') return;
  const speed = modeConfig().paddleSpeed;
  if (keys.left) movePaddleBy(-speed);
  if (keys.right) movePaddleBy(speed);
}

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

function handleActionKey() {
  const gallery = document.getElementById('gallery');
  if (!gallery.classList.contains('hidden')) {
    document.getElementById('gallery-btn').click();
  } else if (state === 'dead') {
    return;
  } else {
    launch();
  }
}

document.addEventListener('keydown', e => {
  const key = e.key.toLowerCase();
  if (key === 'arrowleft' || key === 'h') {
    keys.left = true;
    e.preventDefault();
  } else if (key === 'arrowright' || key === 'l') {
    keys.right = true;
    e.preventDefault();
  } else if (key === 'j' || key === 'k') {
    e.preventDefault();
  } else if (key === ' ') {
    handleActionKey();
    e.preventDefault();
  }
});

document.addEventListener('keyup', e => {
  const key = e.key.toLowerCase();
  if (key === 'arrowleft' || key === 'h') {
    keys.left = false;
    e.preventDefault();
  } else if (key === 'arrowright' || key === 'l') {
    keys.right = false;
    e.preventDefault();
  } else if (key === 'j' || key === 'k' || key === ' ') {
    e.preventDefault();
  }
});

function launch() {
  if (state === 'idle' || (state === 'playing' && ball.onPaddle)) {
    getAudioContext();
    playSfx('launch');
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
    playSfx('bomb');
  } else if (type === 'F') {
    effects.fire = FIRE_DURATION;
  }
  if (type !== 'B') playSfx('powerup');
}

function dropPowerup(b) {
  if (Math.random() < modeConfig().powerupChance) {
    powerups.push({
      x: b.x + b.w / 2, y: b.y + b.h / 2,
      type: POWERUP_TABLE[Math.floor(Math.random() * POWERUP_TABLE.length)],
    });
  }
}

function capBallSpeed() {
  const speed = Math.hypot(ball.vx, ball.vy);
  const maxSpeed = modeConfig().maxBallSpeed;
  if (speed <= maxSpeed) return;
  ball.vx = ball.vx / speed * maxSpeed;
  ball.vy = ball.vy / speed * maxSpeed;
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
  updateKeyboardMovement();

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
      const baseW = modeConfig().paddleW;
      paddle.x = Math.max(0, Math.min(W - baseW, center - baseW / 2));
    }
    effects.wide--;
  }
  if (effects.fire > 0) effects.fire--;

  // パワーアップ落下
  const pw = getPaddleW();
  powerups = powerups.filter(p => {
    p.y += modeConfig().powerupSpeed;
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

  if (ball.x - BALL_R < 0)  { ball.x = BALL_R;       ball.vx *= -1; playSfx('wall'); }
  if (ball.x + BALL_R > W)  { ball.x = W - BALL_R;   ball.vx *= -1; playSfx('wall'); }
  if (ball.y - BALL_R < 0)  { ball.y = BALL_R;        ball.vy *= -1; playSfx('wall'); }

  if (ball.vy > 0 &&
      ball.y + BALL_R >= paddle.y && ball.y + BALL_R <= paddle.y + PADDLE_H + Math.abs(ball.vy) &&
      ball.x >= paddle.x && ball.x <= paddle.x + pw) {
    ball.vy *= -1;
    ball.y = paddle.y - BALL_R;
    const rel = (ball.x - (paddle.x + pw / 2)) / (pw / 2);
    ball.vx = rel * 5;
    capBallSpeed();
    if (effects.fire > 0) effects.fire = FIRE_DURATION;
    playSfx('paddle');
  }

  if (ball.y - BALL_R > H) {
    lives--;
    updateHUD();
    if (lives <= 0) {
      state = 'dead'; bgm.stop();
      playSfx('gameover');
      setMessage(`${modeConfig().label}: GAME OVER`);
      const tid = setTimeout(() => {
        if (state === 'dead') showGameOverGallery();
      }, GAME_OVER_DELAY);
      fireworkTimers.push(tid);
      return;
    }
    playSfx('miss');
    initBall();
    setMessage(`${modeConfig().label}: クリック / Space で再開`);
  }

  let cleared = true;
  for (const b of blocks) {
    if (!b.alive) continue;
    cleared = false;
    if (rectCircle(b.x, b.y, b.w, b.h, ball.x, ball.y, BALL_R)) {
      b.alive = false; score += b.points; updateHUD(); dropPowerup(b);
      playSfx('block');
      if (effects.fire <= 0) {
        const ol = ball.x - b.x, or_ = b.x + b.w - ball.x;
        const ot = ball.y - b.y, ob  = b.y + b.h - ball.y;
        if (Math.min(ol, or_) < Math.min(ot, ob)) ball.vx *= -1; else ball.vy *= -1;
        capBallSpeed();
      }
    }
  }
  if (cleared) onClear();
}

function onClear() {
  bgm.stop();
  const clearedLevel = level;
  const isGameClear  = clearedLevel >= LEVELS.length;
  state = 'cleared';
  clearAnim = 0;
  clearText = isGameClear ? `${modeConfig().label} CLEAR!` : `${modeConfig().label} Lv ${clearedLevel} CLEAR!`;
  playSfx('clear');

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
  setMessage(`${modeConfig().label}: クリック / Space でスタート`);
}

// ---- 描画 ----
function draw() {
  ctx.fillStyle = '#050511';
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = '#19f6ff';
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 24) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, H);
    ctx.stroke();
  }
  for (let y = 0; y <= H; y += 24) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(W, y + 0.5);
    ctx.stroke();
  }
  ctx.restore();

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
      ctx.save();
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = b.color;
      ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 3); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.72)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
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
    ctx.save();
    ctx.shadowColor = effects.wide > 0 ? '#ff2d95' : '#19f6ff';
    ctx.shadowBlur = 14;
    ctx.fillStyle = effects.wide > 0 ? '#ce93d8' : '#00e5ff';
    ctx.beginPath(); ctx.roundRect(paddle.x, paddle.y, pw, PADDLE_H, 5); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillRect(paddle.x + 8, paddle.y + 2, Math.max(0, pw - 16), 2);
    ctx.restore();

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

  if (state === 'dead') {
    ctx.fillStyle = 'rgba(0,0,8,0.72)';
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 46px sans-serif';
    ctx.shadowColor = '#ff2d95';
    ctx.shadowBlur = 24;
    ctx.fillStyle = '#ffd34d';
    ctx.fillText('GAME OVER', W / 2, H / 2);
    ctx.restore();
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
  sfxEnabled = on;
  document.getElementById('mute-btn').textContent = on ? '🔊' : '🔇';
});

document.querySelectorAll('.route-btn').forEach(btn => {
  btn.addEventListener('click', () => setMode(btn.dataset.mode));
});

function bindHoldButton(id, direction) {
  const button = document.getElementById(id);
  const start = e => {
    e.preventDefault();
    keys[direction] = true;
  };
  const stop = e => {
    e.preventDefault();
    keys[direction] = false;
  };
  button.addEventListener('pointerdown', start);
  button.addEventListener('pointerup', stop);
  button.addEventListener('pointercancel', stop);
  button.addEventListener('pointerleave', stop);
}

bindHoldButton('touch-left', 'left');
bindHoldButton('touch-right', 'right');
document.getElementById('touch-action').addEventListener('click', handleActionKey);

// ---- 初期化 ----
updateModeButtons();
resetGame();
