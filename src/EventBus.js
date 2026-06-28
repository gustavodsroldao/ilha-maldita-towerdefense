// Lightweight pub/sub — keeps classes decoupled without a framework.
export class EventBus {
  constructor() { this._map = {}; }

  on(event, cb) {
    (this._map[event] ??= []).push(cb);
    return () => this.off(event, cb);
  }

  off(event, cb) {
    if (this._map[event]) this._map[event] = this._map[event].filter(f => f !== cb);
  }

  emit(event, data) {
    this._map[event]?.forEach(cb => cb(data));
  }
}
