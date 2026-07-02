import { Game } from './src/core/Game.js';
import { MAP_DEFS, DIFF_LABELS, DIFF_COLORS, DIFF_STARS } from './src/world/MapDefs.js';
import { MultiplayerManager } from './src/managers/MultiplayerManager.js';
import { TOWER_DEFS } from './src/entities/Tower.js';

const game = new Game();
let mp = null; // MultiplayerManager (created on demand)

// ── Nickname ──────────────────────────────────────────────────────────────

const NICK_KEY = 'ilha-nickname';
let nickname   = localStorage.getItem(NICK_KEY) || 'Capitão';

const $nameDsp   = document.getElementById('player-name-display');
const $nameInput = document.getElementById('player-name-input');
const $editBtn   = document.getElementById('btn-edit-name');

$nameDsp.textContent = nickname;

$editBtn.addEventListener('click', () => {
  $nameInput.value = nickname;
  $nameDsp.classList.add('hidden');
  $editBtn.classList.add('hidden');
  $nameInput.classList.remove('hidden');
  $nameInput.focus();
  $nameInput.select();
});

function saveName() {
  nickname = $nameInput.value.trim() || 'Capitão';
  localStorage.setItem(NICK_KEY, nickname);
  $nameDsp.textContent = nickname;
  $nameDsp.classList.remove('hidden');
  $editBtn.classList.remove('hidden');
  $nameInput.classList.add('hidden');
}
$nameInput.addEventListener('blur',    saveName);
$nameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') saveName();
  if (e.key === 'Escape') {
    $nameInput.classList.add('hidden');
    $nameDsp.classList.remove('hidden');
    $editBtn.classList.remove('hidden');
  }
});

// ── Menu navigation ───────────────────────────────────────────────────────

document.getElementById('btn-play-solo').addEventListener('click', () => {
  document.getElementById('menu-overlay').classList.add('hidden');
  showMapSelect({ solo: true });
});

document.getElementById('btn-play-mp').addEventListener('click', () => {
  document.getElementById('menu-overlay').classList.add('hidden');
  openMpLobby();
});

document.getElementById('btn-howtoplay').addEventListener('click', () => {
  buildHtpTowers();
  document.getElementById('howtoplay-overlay').classList.remove('hidden');
});

document.getElementById('btn-close-htp').addEventListener('click', () => {
  document.getElementById('howtoplay-overlay').classList.add('hidden');
});

document.getElementById('btn-back-menu').addEventListener('click', () => {
  document.getElementById('map-select-overlay').classList.add('hidden');
  document.getElementById('menu-overlay').classList.remove('hidden');
});

document.getElementById('btn-restart').addEventListener('click', () => {
  if (mp) { mp.disconnect(); mp = null; }
  window.location.reload();
});

// ── Map selection (solo) ──────────────────────────────────────────────────

function showMapSelect({ solo = true } = {}) {
  const overlay = document.getElementById('map-select-overlay');
  const grid    = document.getElementById('map-cards');
  grid.textContent = '';

  for (const def of Object.values(MAP_DEFS)) {
    const card = buildMapCard(def);
    card.addEventListener('click', async () => {
      overlay.classList.add('hidden');
      showLoading(def.name);
      await game.init(def, solo ? null : mp);
      hideLoading();
      if (mp && !solo) game.ui.showMpBar(nickname, getMpPartnerName());
      game.start();
    });
    grid.appendChild(card);
  }

  overlay.classList.remove('hidden');
}

function getMpPartnerName() {
  if (!mp?.partnerNickname) return '?';
  return mp.partnerNickname;
}

function buildMapCard(def) {
  const card = document.createElement('div');
  card.className = 'map-card';
  card.appendChild(buildPathSVG(def.path));

  const name = document.createElement('div');
  name.className = 'map-card-name';
  name.textContent = def.name;

  const sub = document.createElement('div');
  sub.className = 'map-card-sub';
  sub.textContent = def.subtitle;

  const stats = document.createElement('div');
  stats.className = 'map-card-stats';

  const diff  = document.createElement('span');
  diff.style.color = DIFF_COLORS[def.difficulty];
  diff.textContent = `${DIFF_STARS[def.difficulty]} ${DIFF_LABELS[def.difficulty]}`;

  const gold  = document.createElement('span');
  gold.textContent = `🪙 ${def.startGold}`;

  const slots = document.createElement('span');
  slots.textContent = `🏰 ${def.slots.length} slots`;

  stats.appendChild(diff);
  stats.appendChild(gold);
  stats.appendChild(slots);
  card.appendChild(name);
  card.appendChild(sub);
  card.appendChild(stats);
  return card;
}

function buildPathSVG(path) {
  const xs   = path.map(([x]) => x);
  const zs   = path.map(([, z]) => z);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const W = 200, H = 130, pad = 16;
  const rngX = maxX - minX || 1, rngZ = maxZ - minZ || 1;
  const mx = x => pad + ((x - minX) / rngX) * (W - pad * 2);
  const mz = z => pad + ((z - minZ) / rngZ) * (H - pad * 2);
  const ns = 'http://www.w3.org/2000/svg';

  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width',  W);
  svg.setAttribute('height', H);
  svg.setAttribute('class',  'map-preview-svg');

  // Aged sea-chart look: parchment field, dashed ink route, X marks the port
  const bg = document.createElementNS(ns, 'rect');
  bg.setAttribute('width', W); bg.setAttribute('height', H);
  bg.setAttribute('fill', '#d8c79a'); bg.setAttribute('rx', '8');
  svg.appendChild(bg);

  const poly = document.createElementNS(ns, 'polyline');
  poly.setAttribute('points', path.map(([x,z]) => `${mx(x).toFixed(1)},${mz(z).toFixed(1)}`).join(' '));
  poly.setAttribute('fill', 'none'); poly.setAttribute('stroke', '#6b4a1e');
  poly.setAttribute('stroke-width', '2.5');
  poly.setAttribute('stroke-dasharray', '5 4');
  poly.setAttribute('stroke-linecap', 'round'); poly.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(poly);

  const [sx, sz] = path[0], [ex, ez] = path[path.length - 1];

  // Start: green anchor point
  const start = document.createElementNS(ns, 'circle');
  start.setAttribute('cx', mx(sx).toFixed(1)); start.setAttribute('cy', mz(sz).toFixed(1));
  start.setAttribute('r', '4.5'); start.setAttribute('fill', '#2e7d32');
  start.setAttribute('stroke', '#173e18'); start.setAttribute('stroke-width', '1');
  svg.appendChild(start);

  // End: red X marking the port
  const pxc = +mx(ex).toFixed(1), pyc = +mz(ez).toFixed(1);
  const cross = document.createElementNS(ns, 'path');
  cross.setAttribute('d', `M${pxc-5},${pyc-5} L${pxc+5},${pyc+5} M${pxc+5},${pyc-5} L${pxc-5},${pyc+5}`);
  cross.setAttribute('stroke', '#a11f13'); cross.setAttribute('stroke-width', '3');
  cross.setAttribute('stroke-linecap', 'round');
  svg.appendChild(cross);

  return svg;
}

// ── Loading overlay ───────────────────────────────────────────────────────

function showLoading(mapName) {
  let el = document.getElementById('loading-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'loading-overlay';
    el.style.cssText = [
      'position:fixed;inset:0;background:rgba(3,8,18,0.96)',
      'display:flex;flex-direction:column;align-items:center;justify-content:center',
      'gap:16px;z-index:200;color:#f0e6d3;font-family:Georgia,serif',
    ].join(';');
    document.body.appendChild(el);
  }
  el.textContent = '';
  const t = document.createElement('div');
  t.style.cssText = 'font-size:28px;color:#ffd700;';
  t.textContent = mapName;
  const m = document.createElement('div');
  m.style.cssText = 'font-size:16px;color:#c8b87a;';
  m.textContent = 'Carregando...';
  el.appendChild(t); el.appendChild(m);
  el.style.display = 'flex';
}

function hideLoading() {
  const el = document.getElementById('loading-overlay');
  if (el) el.style.display = 'none';
}

// ── How to Play tower grid ────────────────────────────────────────────────

function buildHtpTowers() {
  const grid = document.getElementById('htp-tower-grid');
  if (!grid || grid.children.length > 0) return;
  for (const [, def] of Object.entries(TOWER_DEFS)) {
    const card = document.createElement('div');
    card.className = 'htp-tower-card';
    const icon = document.createElement('div'); icon.className = 'htp-tc-icon'; icon.textContent = def.icon;
    const name = document.createElement('div'); name.className = 'htp-tc-name'; name.textContent = def.name;
    const cost = document.createElement('div'); cost.className = 'htp-tc-cost'; cost.textContent = `🪙${def.cost}`;
    const desc = document.createElement('div'); desc.className = 'htp-tc-desc'; desc.textContent = def.desc;
    card.appendChild(icon); card.appendChild(name); card.appendChild(cost); card.appendChild(desc);
    grid.appendChild(card);
  }
}

// ── Multiplayer lobby ─────────────────────────────────────────────────────

function mpScreen(id) {
  for (const s of document.querySelectorAll('.mp-screen')) s.classList.add('hidden');
  document.getElementById(`mp-screen-${id}`)?.classList.remove('hidden');
}

function mpSetStatus(msg) {
  document.getElementById('mp-status-msg').textContent = msg;
}

async function openMpLobby() {
  document.getElementById('mp-overlay').classList.remove('hidden');
  mpScreen('connecting');

  mp = new MultiplayerManager();

  try {
    await mp.connect();
  } catch {
    mpScreen('error');
    document.getElementById('mp-error-msg').textContent = 'Servidor não encontrado';
    return;
  }

  mp.on('error', ({ msg }) => mpSetStatus(`⚠️ ${msg}`));
  mp.on('disconnected', () => {
    mpScreen('error');
    document.getElementById('mp-error-msg').textContent = 'Conexão perdida';
  });

  mpScreen('main');
}

function closeMpLobby() {
  if (mp) { mp.disconnect(); mp = null; }
  document.getElementById('mp-overlay').classList.add('hidden');
  document.getElementById('menu-overlay').classList.remove('hidden');
}

document.getElementById('btn-mp-close').addEventListener('click', closeMpLobby);

document.getElementById('btn-mp-retry').addEventListener('click', () => {
  document.getElementById('mp-overlay').classList.add('hidden');
  document.getElementById('menu-overlay').classList.remove('hidden');
  openMpLobby();
  document.getElementById('menu-overlay').classList.add('hidden');
});

// ── Create room ───────────────────────────────────────────────────────────

document.getElementById('btn-create-room').addEventListener('click', () => {
  mp.createRoom(nickname);

  mp.on('room-created', ({ code, playerId }) => {
    mp.roomCode  = code;
    mp.playerId  = playerId;
    showMpLobby(code, true);
    mpSetStatus('Aguardando 2º jogador...');
  });
});

// ── Join room ─────────────────────────────────────────────────────────────

document.getElementById('btn-join-room').addEventListener('click', () => {
  const code = document.getElementById('room-code-input').value.trim().toUpperCase();
  if (code.length < 4) { mpSetStatus('⚠️ Código precisa ter 4 letras'); return; }
  mp.joinRoom(code, nickname);

  mp.on('room-joined', ({ code, players, mapId, inProgress, playerId }) => {
    mp.roomCode  = code;
    mp.playerId  = playerId;
    const hostId = players[0]?.id;   // first player in the room is the creator
    // Store partner nickname (by id, so identical default names don't collide)
    const partner = players.find(p => p.id !== playerId);
    if (partner) mp.partnerNickname = partner.nickname;

    // Mid-match invite: skip the lobby, wait for the host's snapshot
    if (inProgress) { joinMidMatch(mapId); return; }

    showMpLobby(code, false);
    // showMpLobby already added self; add only the other players
    for (const p of players) {
      if (p.id === playerId) continue;
      addMpPlayerSlot(p.nickname, { isHost: p.id === hostId, pid: p.id });
    }

    if (mapId) {
      mp.selectedMapId = mapId;
      highlightMpMap(mapId);
      mpSetStatus('Mapa escolhido pelo anfitrião. Clique em Pronto!');
      enableReadyBtn();
    } else {
      mpSetStatus('Aguardando anfitrião escolher mapa...');
    }
  });

  mp.on('map-selected', ({ mapId }) => {
    mp.selectedMapId = mapId;
    highlightMpMap(mapId);
    mpSetStatus('Mapa escolhido! Clique em Pronto!');
    enableReadyBtn();
  });
});

// ── Copy room code ────────────────────────────────────────────────────────

document.getElementById('btn-copy-code').addEventListener('click', () => {
  const code = document.getElementById('mp-code-display').textContent;
  navigator.clipboard?.writeText(code).then(() => mpSetStatus('Código copiado!'));
});

// ── Ready button (toggle) ─────────────────────────────────────────────────

document.getElementById('btn-mp-ready').addEventListener('click', () => {
  const btn = document.getElementById('btn-mp-ready');
  const isReady  = btn.classList.contains('ready');
  const counting = btn.classList.contains('counting');

  if (isReady || counting) {
    // Cancel ready / interrupt countdown
    mp.setUnready();
    resetReadyBtn();
    mpSetStatus('Você cancelou o pronto.');
  } else {
    // Mark as ready
    if (!mp.selectedMapId) { mpSetStatus('⚠️ Escolha um mapa primeiro'); return; }
    mp.setReady();
    btn.classList.add('ready');
    btn.textContent = '✔ Pronto! (cancelar)';
    mpSetStatus('Aguardando o parceiro ficar pronto...');
  }
});

function resetReadyBtn() {
  const btn = document.getElementById('btn-mp-ready');
  btn.classList.remove('ready', 'counting');
  btn.textContent = '⚓ Pronto!';
  hideCountdownDisplay();
}

// ── Countdown display ──────────────────────────────────────────────

function showCountdownDisplay(n) {
  let el = document.getElementById('mp-countdown-display');
  if (!el) {
    el = document.createElement('div');
    el.id = 'mp-countdown-display';
    // inject after the ready button inside the mp-screen-lobby
    document.getElementById('mp-screen-lobby').appendChild(el);
  }
  el.textContent = n;
  el.classList.remove('hidden', 'cd-out');
  // pulse animation: remove/re-add class
  el.classList.remove('cd-pop');
  void el.offsetWidth;          // force reflow
  el.classList.add('cd-pop');
}

function hideCountdownDisplay() {
  const el = document.getElementById('mp-countdown-display');
  if (el) el.classList.add('hidden');
}

// ── game-start + countdown ───────────────────────────────────────────

function bindGameStart() {
  mp.on('game-start', async ({ mapId }) => {
    const def = MAP_DEFS[mapId];
    if (!def) { mpSetStatus('⚠️ Mapa inválido'); return; }
    hideCountdownDisplay();
    document.getElementById('mp-overlay').classList.add('hidden');
    showLoading(def.name);
    await game.init(def, mp);
    hideLoading();
    game.ui.showMpBar(nickname, mp.partnerNickname ?? '?');
    game.start();
  });
}

// ── player-joined / left ──────────────────────────────────────────────────

function bindMpPlayerEvents() {
  mp.on('player-joined', ({ nickname: pn, playerId: pid }) => {
    mp.partnerNickname = pn;
    addMpPlayerSlot(pn, { isHost: false, pid });   // joiners are always crew
    enableReadyBtn();
    mpSetStatus(`${pn} entrou na sala!`);
    // Host can now mark ready
    document.getElementById('btn-mp-ready').disabled = !mp.selectedMapId;
  });

  mp.on('player-left', ({ nickname: pn, playerId: pid }) => {
    mpSetStatus(`${pn} saiu da sala`);
    removePlayerSlot(pid);
    document.getElementById('btn-mp-ready').disabled = true;
    document.getElementById('btn-mp-ready').textContent = 'Aguardando jogadores...';
    document.getElementById('btn-mp-ready').classList.remove('ready');
  });

  mp.on('player-unready', () => {
    mpSetStatus('⚠️ Parceiro cancelou o pronto!');
  });
}

// ── Lobby UI helpers ──────────────────────────────────────────────────────

function showMpLobby(code, isHost) {
  document.getElementById('mp-code-display').textContent = code;
  mpScreen('lobby');

  // Clear players list, add self (creator is the sole Capitão)
  document.getElementById('mp-players-list').textContent = '';
  addMpPlayerSlot(nickname, { isYou: true, isHost, pid: mp.playerId });

  // Add empty second slot
  document.getElementById('mp-players-list').appendChild(buildPlaceholderSlot());

  // Map select (host only)
  const mapWrap = document.getElementById('mp-map-select-wrap');
  if (isHost) {
    mapWrap.classList.remove('hidden');
    buildMpMapButtons();
  } else {
    mapWrap.classList.add('hidden');
  }

  // Ready btn
  const readyBtn = document.getElementById('btn-mp-ready');
  readyBtn.disabled = true;
  readyBtn.textContent = 'Aguardando jogadores...';
  readyBtn.classList.remove('ready');

  bindGameStart();
  bindMpPlayerEvents();
}

// Only the room creator is the Capitão (host); everyone else is Tripulante (crew).
// Slots are keyed by server player id so identical nicknames never collide.
function buildMpPlayerSlot(nick, { isYou = false, isHost = false, pid = null } = {}) {
  const slot = document.createElement('div');
  slot.className = `mp-player-slot ${isYou ? 'you' : 'filled'}${isHost ? ' host' : ''}`;
  if (pid != null) slot.dataset.pid = pid;

  const icon = document.createElement('span');
  icon.className = 'mp-player-icon';
  icon.textContent = isHost ? '👑' : '🦜';

  const name = document.createElement('span');
  name.className = 'mp-player-name';
  name.textContent = isYou ? `${nick} (você)` : nick;

  const role = document.createElement('span');
  role.className = 'mp-player-role';
  role.textContent = isHost ? 'Capitão' : 'Tripulante';

  slot.appendChild(icon);
  slot.appendChild(name);
  slot.appendChild(role);
  return slot;
}

function buildPlaceholderSlot() {
  const slot = document.createElement('div');
  slot.className = 'mp-player-slot';
  slot.dataset.id = 'empty';
  const icon = document.createElement('span'); icon.className = 'mp-player-icon'; icon.textContent = '⏳';
  const name = document.createElement('span'); name.className = 'mp-player-name'; name.textContent = 'Aguardando...';
  slot.appendChild(icon); slot.appendChild(name);
  return slot;
}

function addMpPlayerSlot(nick, opts = {}) {
  const list = document.getElementById('mp-players-list');
  // Guard against duplicates (same player re-reported)
  if (opts.pid != null && list.querySelector(`[data-pid="${opts.pid}"]`)) return;
  const empty = list.querySelector('[data-id="empty"]');
  if (empty) empty.remove();
  list.appendChild(buildMpPlayerSlot(nick, opts));
}

function removePlayerSlot(pid) {
  const list = document.getElementById('mp-players-list');
  const slot = list.querySelector(`[data-pid="${pid}"]`);
  if (slot) slot.remove();
  if (!list.querySelector('[data-id="empty"]')) list.appendChild(buildPlaceholderSlot());
}

function buildMpMapButtons() {
  const btns = document.getElementById('mp-map-btns');
  btns.textContent = '';
  for (const def of Object.values(MAP_DEFS)) {
    const b = document.createElement('button');
    b.className = 'mp-map-option';
    b.dataset.mapId = def.id;
    b.textContent = `${def.name}`;
    b.addEventListener('click', () => {
      mp.selectMap(def.id);
      highlightMpMap(def.id);
      enableReadyBtn();
      mpSetStatus(`Mapa escolhido: ${def.name}`);
    });
    btns.appendChild(b);
  }
}

function highlightMpMap(mapId) {
  for (const b of document.querySelectorAll('.mp-map-option')) {
    b.classList.toggle('selected', b.dataset.mapId === mapId);
  }
}

function enableReadyBtn() {
  const btn = document.getElementById('btn-mp-ready');
  const players = document.querySelectorAll('#mp-players-list .mp-player-slot:not([data-id="empty"])');
  if (players.length >= 2) {
    btn.disabled = !mp.selectedMapId;
    btn.textContent = mp.selectedMapId ? '⚓ Pronto!' : 'Escolha um mapa...';
  }
}

// ── Convidar amigo durante a partida ──────────────────────────────────────

// Host side: called by the pause-menu invite button (wired via game.onInvite)
game.onInvite = startInviteMidMatch;

async function startInviteMidMatch() {
  const overlay  = document.getElementById('invite-overlay');
  const status   = document.getElementById('invite-status');
  const codeWrap = document.getElementById('invite-code-wrap');
  overlay.classList.remove('hidden');
  codeWrap.classList.add('hidden');
  status.textContent = 'Conectando ao servidor...';

  mp = new MultiplayerManager();
  try {
    await mp.connect();
  } catch {
    status.textContent = '⚠️ Servidor não encontrado. Inicie server.js (node server.js).';
    return;
  }

  mp.on('room-created', ({ code }) => {
    mp.roomCode = code;
    game.attachMp(mp);                 // solo game becomes co-op host
    game.ui.showMpBar(nickname, '?');
    document.getElementById('invite-code').textContent = code;
    status.textContent = 'Sala criada! Aguardando amigo entrar...';
    codeWrap.classList.remove('hidden');
  });

  mp.on('player-joined', ({ nickname: pn }) => {
    mp.partnerNickname = pn;
    game.ui.showMpBar(nickname, pn);
    mp.broadcastSnapshot(game.buildSnapshot());
    status.textContent = `${pn} entrou! Pode fechar e continuar jogando.`;
    game._showToast(`${pn} entrou na partida!`);
  });

  mp.createRoom(nickname, game.mapDef.id, true);
}

document.getElementById('btn-invite-copy')?.addEventListener('click', () => {
  const code = document.getElementById('invite-code').textContent;
  navigator.clipboard?.writeText(code);
  document.getElementById('invite-status').textContent = 'Código copiado!';
});

document.getElementById('btn-invite-close')?.addEventListener('click', () => {
  document.getElementById('invite-overlay').classList.add('hidden');
  game._closePauseMenu();   // resume the match (room stays open in background)
});

// Joiner side: a friend who entered a mid-match room, waiting for the snapshot
function joinMidMatch(mapId) {
  mpSetStatus('Entrando na partida em andamento...');
  mp.on('game-snapshot', async ({ snapshot }) => {
    const def = MAP_DEFS[snapshot?.mapId] ?? MAP_DEFS[mapId];
    if (!def) { mpSetStatus('⚠️ Mapa inválido'); return; }
    document.getElementById('mp-overlay').classList.add('hidden');
    showLoading(def.name);
    await game.init(def, mp);
    hideLoading();
    game.start();
    game.applySnapshot(snapshot);
    game.ui.showMpBar(nickname, mp.partnerNickname ?? '?');
  });
}
