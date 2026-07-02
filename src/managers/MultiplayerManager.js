const WS_URL = 'ws://localhost:3001';

export class MultiplayerManager {
  constructor() {
    this.ws           = null;
    this.playerId     = null;
    this.roomCode     = null;
    this.nickname     = null;
    this.isHost       = false;
    this.selectedMapId = null;
    this._handlers    = new Map();
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(WS_URL);
      const timeout = setTimeout(() => reject(new Error('timeout')), 5000);
      this.ws.onopen  = () => { clearTimeout(timeout); resolve(); };
      this.ws.onerror = () => { clearTimeout(timeout); reject(new Error('Falha ao conectar')); };
      this.ws.onmessage = e => {
        let msg;
        try { msg = JSON.parse(e.data); } catch { return; }
        const cb = this._handlers.get(msg.type);
        if (cb) cb(msg);
      };
      this.ws.onclose = () => {
        const cb = this._handlers.get('disconnected');
        if (cb) cb();
      };
    });
  }

  on(type, cb) { this._handlers.set(type, cb); }

  send(msg) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  createRoom(nickname, mapId = null, inProgress = false) {
    this.nickname      = nickname;
    this.isHost        = true;
    this.selectedMapId = mapId;
    this.send({ type: 'create-room', nickname, mapId, inProgress });
  }

  joinRoom(code, nickname) {
    this.nickname = nickname;
    this.isHost   = false;
    this.send({ type: 'join-room', code, nickname });
  }

  selectMap(mapId) {
    this.selectedMapId = mapId;
    this.send({ type: 'map-selected', mapId });
  }

  setReady() {
    this.send({ type: 'ready' });
  }

  setUnready() {
    this.send({ type: 'unready' });
  }

  // ── In-game broadcasts ────────────────────────────────────────────────────

  broadcastTowerPlaced(slotIndex, towerType) {
    this.send({ type: 'tower-placed', slotIndex, towerType });
  }

  broadcastTowerUpgraded(slotIndex) {
    this.send({ type: 'tower-upgraded', slotIndex });
  }

  broadcastTowerSold(slotIndex) {
    this.send({ type: 'tower-sold', slotIndex });
  }

  broadcastWaveStart() {
    this.send({ type: 'wave-start' });
  }

  // Full game state sent to a friend who joins mid-match
  broadcastSnapshot(snapshot) {
    this.send({ type: 'game-snapshot', snapshot });
  }

  disconnect() {
    this.ws?.close();
  }
}
