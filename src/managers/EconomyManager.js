export class EconomyManager {
  constructor(eventBus, startGold = 150, startLives = 20) {
    this.bus = eventBus;
    this.gold  = startGold;
    this.lives = startLives;
    this.score = 0;
    this._maxLives = startLives;
  }

  earn(amount) {
    this.gold += amount;
    this.score += amount;
    this.bus.emit('economy-changed', this._state());
  }

  // Returns false and does nothing if not enough gold.
  spend(amount) {
    if (this.gold < amount) return false;
    this.gold -= amount;
    this.bus.emit('economy-changed', this._state());
    return true;
  }

  loseLife(count = 1) {
    this.lives = Math.max(0, this.lives - count);
    this.bus.emit('economy-changed', this._state());
    if (this.lives <= 0) this.bus.emit('lives-depleted', {});
  }

  reset(gold = 150, lives = 20) {
    this.gold = gold; this.lives = lives; this.score = 0; this._maxLives = lives;
    this.bus.emit('economy-changed', this._state());
  }

  _state() { return { gold: this.gold, lives: this.lives, score: this.score, maxLives: this._maxLives }; }
}
