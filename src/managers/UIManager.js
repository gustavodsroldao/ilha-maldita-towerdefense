import { TOWER_DEFS } from '../entities/Tower.js';

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'style') Object.assign(node.style, v);
    else if (k === 'class') node.className = v;
    else node.setAttribute(k, v);
  }
  for (const child of children) {
    if (typeof child === 'string') node.appendChild(document.createTextNode(child));
    else node.appendChild(child);
  }
  return node;
}

export class UIManager {
  constructor(game) {
    this.game = game;
    this._selectedSlot  = null;
    this._selectedTower = null;

    this.$lives    = document.getElementById('lives-icons');
    this.$gold     = document.getElementById('gold-amount');
    this.$score    = document.getElementById('score-amount');
    this.$wave     = document.getElementById('wave-current');
    this.$waveTotal = document.getElementById('wave-total');
    this.$wind     = document.getElementById('wind-label');
    this.$compass  = document.getElementById('compass');
    this.$twrPanel = document.getElementById('tower-panel');
    this.$upPanel  = document.getElementById('upgrade-panel');
    this.$nextBtn  = document.getElementById('btn-next-wave');
    this.$speedBtn = document.getElementById('btn-speed');
    this.$mpBar    = document.getElementById('mp-hud-bar');

    this._compassCtx = this.$compass.getContext('2d');
    this.$tip        = document.getElementById('hud-tip');
    this._tipIndex   = 0;
    this._tipTimer   = 0;
    this._tips = [
      '💡 Clique nos círculos dourados para construir torres',
      '💡 WASD / setas movem a câmera • Scroll para zoom • P pausa',
      '💡 Corrente + Canhão = 2× dano em navios lentos',
      '💡 Torre Vigia: +25% alcance para torres vizinhas',
      '💡 Clique numa torre colocada para vender ou melhorar',
      '💡 Del / Backspace vende a torre selecionada rapidamente',
      '💡 Vento muda a cada onda — navios a favor ficam 20% mais rápidos',
      '💡 Farol: raio elétrico encadeia até 2 navios extras',
    ];
    this._buildTowerPanel();
  }

  // ── Multiplayer HUD bar ───────────────────────────────────────────────────

  showMpBar(myName, partnerName) {
    if (!this.$mpBar) return;
    this.$mpBar.textContent = '';

    const you = el('div', { class: 'mp-hud-player' }, [`🏴‍☠️ ${myName}`]);
    const dot  = el('div', { class: 'mp-hud-sep' }, ['—']);
    const them = el('div', { class: 'mp-hud-player' }, [`🦜 ${partnerName}`]);

    this.$mpBar.appendChild(you);
    this.$mpBar.appendChild(dot);
    this.$mpBar.appendChild(them);
    this.$mpBar.classList.remove('hidden');
  }

  hideMpBar() {
    this.$mpBar?.classList.add('hidden');
  }

  // ── Selection helpers ─────────────────────────────────────────────────────

  hasSelectedTower() { return this._selectedTower !== null; }
  getSelection()     { return { tower: this._selectedTower, slot: this._selectedSlot }; }
  isPanelOpen() {
    return !this.$twrPanel.classList.contains('hidden') || !this.$upPanel.classList.contains('hidden');
  }

  // ── Panels ────────────────────────────────────────────────────────────────

  _buildTowerPanel() {
    this.$twrPanel.textContent = '';
    for (const [type, def] of Object.entries(TOWER_DEFS)) {
      const icon  = el('div', { class: 't-icon'  }, [def.icon]);
      const name  = el('div', { class: 't-name'  }, [def.name]);
      const cost  = el('div', { class: 't-cost'  }, [`🪙${def.cost}`]);
      const desc  = el('div', { class: 't-desc'  }, [def.desc]);
      const card  = el('div', { class: 'tower-opt', 'data-type': type }, [icon, name, cost, desc]);
      card.addEventListener('click', () => {
        if (card.classList.contains('disabled')) return;
        const slot = this._selectedSlot;
        if (!slot || !slot.isEmpty) return;
        this.game.placeTower(type, slot);
        this.hidePanels();
      });
      this.$twrPanel.appendChild(card);
    }
  }

  showTowerPanel(slot) {
    this._selectedSlot  = slot;
    this._selectedTower = null;
    this.$upPanel.classList.add('hidden');
    this.$twrPanel.classList.remove('hidden');
    this._refreshTowerPanel();
  }

  showUpgradePanel(tower, slot) {
    this._selectedTower = tower;
    this._selectedSlot  = slot;
    this.$twrPanel.classList.add('hidden');
    this.$upPanel.classList.remove('hidden');
    tower.showRange(true);
    this._refreshUpgradePanel();
  }

  hidePanels() {
    if (this._selectedTower) this._selectedTower.showRange(false);
    this._selectedSlot  = null;
    this._selectedTower = null;
    this._upBtn         = null;
    this.$twrPanel.classList.add('hidden');
    this.$upPanel.classList.add('hidden');
  }

  showNextWaveButton() { this.$nextBtn.classList.remove('hidden'); }
  hideNextWaveButton() { this.$nextBtn.classList.add('hidden'); }

  showSpeedBtn() { this.$speedBtn.classList.remove('hidden'); }
  hideSpeedBtn() { this.$speedBtn.classList.add('hidden'); }

  updateSpeedBtn(speed) {
    const labels = { 1: '▶ 1×', 2: '⏩ 2×', 3: '⏩⏩ 3×' };
    this.$speedBtn.textContent = labels[speed] ?? '▶ 1×';
    this.$speedBtn.dataset.speed = speed;
  }

  showGameOver(won, score) {
    const overlay = document.getElementById('gameover-overlay');
    const title   = document.getElementById('go-title');
    const scoreEl = document.getElementById('go-score');
    title.textContent = won ? '🏆 Vitória!' : '💀 Derrota!';
    title.style.color = won ? '#ffd700' : '#ff4444';
    scoreEl.textContent = `Pontuação: ${score}`;
    document.getElementById('btn-continue-endless')?.classList.add('hidden');
    overlay.classList.remove('hidden');
  }

  // Wave-10 victory with the option to continue into endless mode
  showVictory(score, onContinue) {
    const overlay = document.getElementById('gameover-overlay');
    const title   = document.getElementById('go-title');
    title.textContent = '🏆 Vitória!';
    title.style.color = '#ffd700';
    document.getElementById('go-score').textContent =
      `Pontuação: ${score} — você sobreviveu às 10 ondas!`;
    const contBtn = document.getElementById('btn-continue-endless');
    if (contBtn) {
      contBtn.classList.remove('hidden');
      contBtn.onclick = () => { overlay.classList.add('hidden'); onContinue?.(); };
    }
    overlay.classList.remove('hidden');
  }

  _refreshTowerPanel() {
    const gold = this.game.economy.gold;
    for (const card of this.$twrPanel.querySelectorAll('.tower-opt')) {
      const cost = TOWER_DEFS[card.dataset.type].cost;
      card.classList.toggle('disabled', gold < cost);
    }
  }

  _refreshUpgradePanel() {
    const t = this._selectedTower;
    if (!t) return;
    const def       = TOWER_DEFS[t.type];
    const dmgMult   = [1, 1.5, 2.1][t.level - 1];
    const rangeMult = [1, 1.5, 2.1][t.level - 1];
    const effRange  = (def.range * rangeMult * (1 + t.rangeBonus)).toFixed(1);

    this.$upPanel.textContent = '';

    const heading = el('h3', {}, [`${def.icon} ${def.name} Nv.${t.level}`]);
    heading.style.cssText = 'font-size:14px;margin-bottom:8px;color:#ffd700;';

    const stats = el('div', { class: 'up-stats' });
    stats.style.cssText = 'font-size:11px;color:#a89060;margin-bottom:8px;line-height:1.6;';
    stats.appendChild(document.createTextNode(`Dano: ${Math.round(def.damage * dmgMult)}`));
    stats.appendChild(el('br'));
    stats.appendChild(document.createTextNode(`Alcance: ${effRange}`));
    stats.appendChild(el('br'));
    stats.appendChild(document.createTextNode(`Investido: 🪙${t.totalInvested}`));

    this.$upPanel.appendChild(heading);
    this.$upPanel.appendChild(stats);

    this._upBtn = null;
    if (t.level < 3) {
      const upCost = t.upgradeCost;
      const canUp  = this.game.economy.gold >= upCost;
      const upBtn  = el('button', { class: 'up-btn' }, [`⬆ Nv.${t.level + 1} (🪙${upCost})`]);
      upBtn.disabled = !canUp;
      // Use game.upgradeTower so MP broadcast happens there
      upBtn.addEventListener('click', () => {
        this.game.upgradeTower(t);
        this._refreshUpgradePanel();
      });
      this._upBtn = upBtn;
      this.$upPanel.appendChild(upBtn);
    } else {
      const maxNote = el('div', {}, ['✨ Nível máximo']);
      maxNote.style.cssText = 'color:#ffd700;font-size:12px;margin-top:6px;';
      this.$upPanel.appendChild(maxNote);
    }

    const sellVal = Math.floor(t.totalInvested * 0.6);
    const sellBtn = el('button', { class: 'up-btn sell' }, [`💰 Vender (🪙${sellVal})  [Del]`]);
    sellBtn.addEventListener('click', () => {
      this.game.sellTower(t, this._selectedSlot);
      this.hidePanels();
    });
    this.$upPanel.appendChild(sellBtn);
  }

  // Per-frame: just enable/disable the upgrade button as gold changes. No DOM rebuild.
  _tickUpgradePanel() {
    const t = this._selectedTower;
    if (!t || !this._upBtn || t.level >= 3) return;
    this._upBtn.disabled = this.game.economy.gold < t.upgradeCost;
  }

  update(delta = 0) {
    if (!this.$twrPanel.classList.contains('hidden')) this._refreshTowerPanel();
    // Only tick affordability — NEVER rebuild the panel per-frame, or the button
    // gets recreated between mousedown/mouseup and the click never fires.
    if (!this.$upPanel.classList.contains('hidden') && this._selectedTower) {
      this._tickUpgradePanel();
    }

    if (this.$tip) {
      this._tipTimer += delta;
      if (this._tipTimer >= 5) {
        this._tipTimer = 0;
        this._tipIndex = (this._tipIndex + 1) % this._tips.length;
        this.$tip.textContent = this._tips[this._tipIndex];
      }
    }
  }

  onEconomyChanged({ gold, lives, score, maxLives }) {
    this.$gold.textContent  = gold;
    this.$score.textContent = score;

    this.$lives.textContent = '';
    for (let i = 0; i < maxLives; i++) {
      const heart = el('span', {}, ['❤️']);
      heart.style.opacity  = i < lives ? '1' : '0.2';
      heart.style.fontSize = '14px';
      this.$lives.appendChild(heart);
    }
  }

  onWaveChanged(wave, endless = false) {
    this.$wave.textContent = wave;
    if (endless && this.$waveTotal) this.$waveTotal.textContent = '∞';
  }

  onWindChanged(dir) {
    this.$wind.textContent = dir;
    this._drawCompass(dir);
  }

  _drawCompass(dir) {
    const ctx = this._compassCtx;
    const cx = 26, cy = 26, r = 22;
    ctx.clearRect(0, 0, 52, 52);

    ctx.strokeStyle = '#8b6914'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();

    const labels = [['N', 0, -1], ['S', 0, 1], ['E', 1, 0], ['W', -1, 0]];
    ctx.font = '9px Georgia'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const [l, dx, dy] of labels) {
      ctx.fillStyle = l === dir ? '#ffd700' : '#c8b87a';
      ctx.fillText(l, cx + dx * (r - 6), cy + dy * (r - 6));
    }

    const angles = { N: -Math.PI / 2, S: Math.PI / 2, E: 0, W: Math.PI };
    const a = angles[dir] ?? 0;
    ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * (r - 8), cy + Math.sin(a) * (r - 8));
    ctx.stroke();
  }
}
