// Step-by-step first-play tutorial. Saved to localStorage so it runs once.

// Each text entry is an array of {tag, text} segments for safe DOM construction.
const STEPS = [
  {
    title: '⚓ Bem-vindo, Capitão!',
    lines: [
      ['p', 'Navios inimigos se aproximam pelo mar para atacar seu porto.'],
      ['p', 'Construa torres na ilha para detê-los antes que cheguem.'],
    ],
    hint: null,
  },
  {
    title: '🟡 Construa Torres',
    lines: [
      ['p', 'Clique nos círculos dourados pulsantes na ilha para posicionar uma torre.'],
      ['p', 'Você começa com 🪙200 de ouro. Torres podem ser vendidas por 60% do valor.'],
    ],
    hint: 'wave-btn',
  },
  {
    title: '🏰 Tipos de Torre',
    lines: [
      ['li', '💣 Canhão — dano sólido, 2× contra navios lentos'],
      ['li', '🔥 Piche — cria zona de fogo no impacto'],
      ['li', '⛓️ Corrente — desacelera navios em 45%'],
      ['li', '🔭 Vigia — passivo: +25% alcance torres adjacentes'],
      ['li', '⚡ Farol — raio elétrico que encadeia entre navios'],
      ['li', '🐙 Kraken — enorme alcance e alto dano'],
    ],
    hint: null,
  },
  {
    title: '💡 Sinergias',
    lines: [
      ['p', 'Corrente + Canhão = 2× dano em navios lentos.'],
      ['p', 'Torre Vigia expande o alcance de torres vizinhas em 25%.'],
      ['p', 'Vento muda a cada onda — navios a favor ganham +20% velocidade.'],
    ],
    hint: null,
  },
  {
    title: '🌊 Hora de Jogar!',
    lines: [
      ['p', 'Coloque suas torres nos círculos dourados e clique em INICIAR ONDA.'],
      ['p', 'Entre ondas você pode construir e reorganizar torres. Boa sorte, Capitão!'],
    ],
    hint: 'wave-btn',
  },
];

function buildText(lines) {
  const wrap = document.createElement('div');
  wrap.className = 'tut-body';
  for (const [tag, text] of lines) {
    const el = document.createElement(tag === 'li' ? 'div' : tag);
    if (tag === 'li') {
      el.className = 'tut-li';
      el.style.cssText = 'padding:2px 0;font-size:13px;';
    }
    el.textContent = text;
    wrap.appendChild(el);
  }
  return wrap;
}

export class TutorialManager {
  constructor() {
    this._step    = 0;
    this._overlay = null;
    this._done    = localStorage.getItem('ilha-tut-v2') === '1';
  }

  start() {
    if (this._done) return;
    this._build();
    this._show(0);
  }

  _build() {
    this._overlay = document.createElement('div');
    this._overlay.id = 'tut-overlay';

    this._box = document.createElement('div');
    this._box.className = 'tut-box';

    this._titleEl   = document.createElement('h3');
    this._titleEl.className = 'tut-title';
    this._contentEl = document.createElement('div');
    this._contentEl.className = 'tut-content';

    const nav = document.createElement('div');
    nav.className = 'tut-nav';

    this._dotsEl  = document.createElement('div');
    this._dotsEl.className = 'tut-dots';

    this._nextBtn = document.createElement('button');
    this._nextBtn.className = 'tut-btn';
    this._nextBtn.addEventListener('click', () => this._advance());

    nav.appendChild(this._dotsEl);
    nav.appendChild(this._nextBtn);

    this._box.appendChild(this._titleEl);
    this._box.appendChild(this._contentEl);
    this._box.appendChild(nav);
    this._overlay.appendChild(this._box);
    document.body.appendChild(this._overlay);
  }

  _show(n) {
    this._step = n;
    const s = STEPS[n];

    this._titleEl.textContent = s.title;

    this._contentEl.textContent = '';
    this._contentEl.appendChild(buildText(s.lines));

    this._nextBtn.textContent = n < STEPS.length - 1 ? 'Próximo →' : '🎮 Jogar!';

    this._dotsEl.textContent = '';
    for (let i = 0; i < STEPS.length; i++) {
      const d = document.createElement('span');
      d.className = 'tut-dot' + (i === n ? ' active' : '');
      this._dotsEl.appendChild(d);
    }

    this._clearHighlight();
    if (s.hint === 'wave-btn') document.getElementById('btn-next-wave')?.classList.add('tut-highlight');
  }

  _advance() {
    this._clearHighlight();
    if (this._step < STEPS.length - 1) {
      this._show(this._step + 1);
    } else {
      this._finish();
    }
  }

  _clearHighlight() {
    document.querySelectorAll('.tut-highlight').forEach(el => el.classList.remove('tut-highlight'));
  }

  _finish() {
    localStorage.setItem('ilha-tut-v2', '1');
    this._done = true;
    this._overlay.classList.add('tut-exit');
    setTimeout(() => this._overlay?.remove(), 400);
  }

  get done() { return this._done; }
}
