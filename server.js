const { WebSocketServer } = require('ws');

const wss = new WebSocketServer({ port: 3001 });
const rooms = new Map();
let _seq = 0;
const genId = () => `p${++_seq}`;

function send(ws, msg) {
  if (ws.readyState === 1) ws.send(JSON.stringify(msg));
}

function broadcast(room, msg, excludeId = null) {
  for (const p of room.players)
    if (p.id !== excludeId) send(p.ws, msg);
}

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms.has(code));
  return code;
}

wss.on('connection', ws => {
  let playerId = null;
  let roomCode = null;

  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'create-room') {
      playerId = genId();
      roomCode = genCode();
      rooms.set(roomCode, {
        code: roomCode,
        players: [{ id: playerId, nickname: msg.nickname, ws, ready: false }],
        mapId: msg.mapId ?? null,
        inProgress: !!msg.inProgress,   // room opened mid-match (invite friend)
      });
      send(ws, { type: 'room-created', code: roomCode, playerId });
      return;
    }

    if (msg.type === 'join-room') {
      const code = (msg.code || '').toUpperCase();
      const room = rooms.get(code);
      if (!room)              { send(ws, { type: 'error', msg: 'Sala não encontrada' }); return; }
      if (room.players.length >= 2) { send(ws, { type: 'error', msg: 'Sala cheia' });        return; }

      playerId = genId();
      roomCode = code;
      room.players.push({ id: playerId, nickname: msg.nickname, ws, ready: false });
      send(ws, {
        type: 'room-joined',
        code: roomCode,
        playerId,
        players: room.players.map(p => ({ id: p.id, nickname: p.nickname })),
        mapId: room.mapId,
        inProgress: !!room.inProgress,
      });
      broadcast(room, { type: 'player-joined', playerId, nickname: msg.nickname }, playerId);
      return;
    }

    // All other messages: relay to room-mates
    const room = rooms.get(roomCode);
    if (!room) return;

    if (msg.type === 'map-selected') {
      room.mapId = msg.mapId;
    }

    if (msg.type === 'ready') {
      const p = room.players.find(p => p.id === playerId);
      if (p) p.ready = true;
      // Check all ready → start game
      if (room.players.length >= 2 && room.players.every(p => p.ready)) {
        broadcast(room, { type: 'game-start', mapId: room.mapId });
        return;
      }
    }

    if (msg.type === 'unready') {
      const p = room.players.find(p => p.id === playerId);
      if (p) p.ready = false;
      broadcast(room, { type: 'player-unready', playerId }, playerId);
      return;
    }

    broadcast(room, { ...msg, fromId: playerId }, playerId);
  });

  ws.on('close', () => {
    const room = rooms.get(roomCode);
    if (!room) return;
    const p = room.players.find(p => p.id === playerId);
    if (p) broadcast(room, { type: 'player-left', playerId, nickname: p.nickname });
    room.players = room.players.filter(p => p.id !== playerId);
    if (room.players.length === 0) rooms.delete(roomCode);
  });
});

console.log('WS server → ws://localhost:3001');
