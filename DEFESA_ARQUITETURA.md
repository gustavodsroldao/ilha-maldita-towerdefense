# Defesa de Arquitetura — Ilha Maldita (Pirate Tower Defense)

Respostas prontas para perguntas de banca/apresentação sobre decisões de arquitetura. Cada seção segue o padrão: **o que foi feito → por quê → trade-off aceito**.

---

## 1. Banco de dados: não usamos

**O que existe hoje:**
- Nenhum banco de dados (SQL ou NoSQL) no projeto.
- Persistência local mínima via `localStorage` do navegador: apelido do jogador (`ilha-nickname`) e progresso do tutorial (`ilha-tut-v2`).
- Estado da partida (ouro, vidas, torres, ondas) vive inteiramente em memória, no objeto `Game` (`src/core/Game.js`), e é descartado ao recarregar a página (`window.location.reload()` no restart).
- No servidor multiplayer (`server.js`), as salas ficam em um `Map()` em memória (`const rooms = new Map()`), sem gravação em disco.

**Por quê:**
- Não há requisito de persistência entre sessões (ranking global, histórico de partidas, contas de usuário). O jogo é "sessão única": abre, joga, termina.
- Introduzir um banco (schema, migrations, conexão) adicionaria complexidade de infraestrutura sem benefício funcional no escopo atual.

**Trade-off aceito:**
- Se o servidor de sala cair, a partida em andamento se perde — aceitável porque é um relay volátil, não uma fonte de verdade persistente.
- Não há como consultar "quantas partidas o jogador X já jogou" — não é um requisito do produto atual.

**Se cobrarem "e se precisasse de DB?":** resposta pronta — adicionaria um banco leve (SQLite/PostgreSQL) só se o requisito fosse persistir ranking/perfil, e isso ficaria isolado atrás de uma camada de repositório, sem tocar na lógica de jogo (que já é desacoplada via `EventBus`).

---

## 2. Cache: sim, cache de assets em memória

**O que existe:**
- `src/managers/AssetLoader.js` mantém um `Map()` (`_cache`) que guarda geometrias/materiais 3D já construídos, indexados por tipo (torre, inimigo, etc).
- Antes de criar uma nova malha 3D, o loader verifica se já existe no cache; se sim, reaproveita/clona em vez de reconstruir do zero.

**Por quê:**
- Criar `Geometry`/`Material` do Three.js repetidamente (a cada torre ou inimigo instanciado) é caro para o WebGL — recompila buffers de GPU sem necessidade.
- Cache resolve isso: constrói uma vez, reutiliza N vezes.

**Escopo do cache:**
- É cache **local ao processo do navegador**, não um cache distribuído (Redis, Memcached) — não faz sentido nesse contexto porque não há backend com estado compartilhado entre múltiplos clientes que precise ser cacheado.

**Se cobrarem "por que não Redis?":** não há dado compartilhado entre sessões/usuários que justifique cache distribuído — o servidor (`server.js`) só faz *relay* de mensagens, não processa nem serve dados que se beneficiem de cache.

---

## 3. Fila (message queue): não usamos — e por quê

**O que existe no lugar de fila:**
- **EventBus interno** (`src/core/EventBus.js`): pub/sub síncrono, em memória, dentro do próprio cliente. Um `emit()` chama os `callbacks` na hora, sem buffer, sem persistência, sem ordem garantida entre execuções futuras.
- **WebSocket relay** (`server.js`): mensagens de um jogador são repassadas (broadcast) para o outro jogador da sala **imediatamente**, sem fila intermediária, sem retry, sem garantia de entrega caso o socket caia.

**Por quê não uma fila real (RabbitMQ/Kafka/SQS):**
- Fila resolve problemas de: desacoplamento temporal entre produtor/consumidor, garantia de entrega, replay de eventos, processamento assíncrono pesado, múltiplos consumidores independentes.
- Nenhum desses problemas existe aqui: é um jogo cooperativo **2 jogadores, tempo real**, onde a mensagem só importa se chegar *agora* — se o WebSocket cair, não faz sentido "reprocessar depois", a partida já mudou de estado local em ambos os clientes.
- Latência de fila (broker externo) seria pior para sincronização em tempo real do que WebSocket direto.

**Se cobrarem "e se fosse assíncrono/multi-sala em escala?":** aí sim justificaria fila (ex.: Redis Pub/Sub ou um broker) para desacoplar o servidor de relay de múltiplas instâncias — hoje não é necessário porque `rooms` cabe inteiro na memória de um único processo Node.

---

## 4. Arquitetura geral: monolito modular no cliente + processo separado para multiplayer

**Não é microsserviços.** É a seguinte divisão, com justificativa de cada corte:

```
┌─────────────────────────────┐        ┌──────────────────────────┐
│  Cliente (navegador)         │  WS    │  server.js (Node.js)     │
│  ES6 modules, sem bundler    │◄──────►│  WebSocketServer relay   │
│  servido estático (npx serve)│        │  porta 3001              │
└─────────────────────────────┘        └──────────────────────────┘
```

**Por que dois processos, e não um monolito único:**
- O cliente (jogo em si, renderização 3D, lógica de torres/inimigos) roda 100% no navegador — não precisa de servidor para o modo solo.
- O servidor WebSocket só existe porque o modo cooperativo (2 jogadores) precisa de um ponto central para repassar mensagens entre os dois clientes (WebRTC P2P direto seria mais complexo de configurar — NAT traversal, STUN/TURN — e o ganho não compensa para 2 jogadores).
- São ciclos de vida independentes: dá para jogar sozinho sem nunca subir `server.js`.

**Por que não microsserviços:**
- Não há domínios de negócio distintos que justifiquem serviços separados (ex.: serviço de pagamento, serviço de usuários, serviço de catálogo). É um jogo com um único domínio (partida de tower defense) e uma única responsabilidade de infraestrutura extra (relay de sala).
- Microsserviços trariam custo operacional (deploy múltiplo, service discovery, rede entre serviços) sem nenhum benefício aqui — over-engineering para o escopo do projeto.

**Dentro do cliente, é modular (não é um arquivo gigante):**
- `src/core/` — motor do jogo (`Game.js` orquestra tudo, `Scene.js` cuida do WebGL/Three.js, `EventBus.js` desacopla os módulos).
- `src/entities/` — Tower, Enemy, Projectile (regras de cada entidade).
- `src/managers/` — WaveManager, EconomyManager, UIManager, MultiplayerManager, AssetLoader, AudioManager, TutorialManager (cada um cuida de uma responsabilidade única).
- `src/world/` — Map, MapDefs (definição de fases/mapas).

Isso é separação por **responsabilidade única dentro de um monolito de frontend**, não separação por serviço de rede.

---

## 5. Arquitetura orientada a eventos: sim, em duas camadas

### Camada 1 — Eventos internos do cliente (`EventBus`)

Implementação: `src/core/EventBus.js` — pub/sub clássico (`on`/`off`/`emit`), sem dependência de framework.

Exemplo de fluxo (`src/core/Game.js`, `_bindEvents()`):
```
Enemy morre → bus.emit('enemy-died', { enemy })
  → Game escuta e chama economy.earn(reward)
  → EconomyManager processa e faz bus.emit('economy-changed', {...})
  → UIManager escuta 'economy-changed' e atualiza o HUD
```

**Por que eventos e não chamada direta (`ui.updateGold(x)` espalhado pelo código):**
- Desacopla quem gera o dado (Economy) de quem consome (UI). `EconomyManager` não conhece `UIManager` e vice-versa.
- Permite múltiplos consumidores do mesmo evento sem alterar o produtor (ex.: `wave-started` atualiza UI de onda **e** UI de vento **e** mostra botão de velocidade, três handlers independentes no mesmo evento).
- Facilita testar/estender: um novo sistema (ex.: conquistas) só precisa escutar eventos existentes, sem tocar no código de quem os emite.

**Trade-off aceito:** fluxo fica menos "rastreável linearmente" (é preciso procurar quem escuta cada evento), mitigado por manter todos os `bus.on(...)` centralizados em `_bindEvents()` dentro de `Game.js`.

### Camada 2 — Eventos de rede (WebSocket messages como eventos)

Implementação: `src/managers/MultiplayerManager.js` (cliente) + `server.js` (relay).

- Cada ação do jogador vira uma mensagem tipada (`{ type: 'tower-placed', slotIndex, towerType }`), similar a um evento de domínio.
- O servidor é **stateless em relação à lógica do jogo** — só guarda `rooms` (metadados de sala) e repassa (`broadcast`) a mensagem para o outro jogador, sem validar nem processar a regra de negócio.
- Quem interpreta o evento e aplica a regra é o cliente que recebe (`Game._bindMpEvents()` → `placeRemoteTower`, `upgradeRemoteTower`, `sellRemoteTower`).

**Por que essa escolha (cliente autoritativo, servidor "burro"):**
- Modelo de confiança cooperativo (não competitivo) — os dois jogadores estão do mesmo lado, sem incentivo a trapacear um contra o outro. Não há necessidade de servidor autoritativo validando cada jogada (o que exigiria duplicar toda a lógica de jogo no servidor).
- Reduz drasticamente a complexidade do backend: `server.js` tem ~100 linhas porque não reimplementa regras de torre/economia/onda.

**Se cobrarem "isso não é inseguro/trapaceável?":** sim, é um trade-off consciente — aceitável porque é um jogo cooperativo local entre amigos, não um jogo competitivo com ranking/apostas onde trapacear prejudicaria terceiros.

---

## 6. Resumo rápido para resposta direta em banca

| Pergunta da banca | Resposta curta |
|---|---|
| Usa banco de dados? | Não. Estado em memória + `localStorage` para preferências locais. Sem requisito de persistência entre sessões. |
| Usa cache? | Sim, cache local de assets 3D (`AssetLoader._cache`) para evitar recriar geometrias no WebGL. Não é cache distribuído — não há dado compartilhado entre usuários que justifique. |
| Usa fila de mensagens? | Não. WebSocket relay em tempo real substitui — fila adicionaria latência sem resolver nenhum problema real do escopo (2 jogadores, tempo real, sem replay necessário). |
| É monolito ou microsserviços? | Nem um nem outro puro: monolito modular no cliente (módulos ES6 por responsabilidade) + um processo Node.js separado só para relay de multiplayer, porque são ciclos de vida independentes (dá pra jogar solo sem o servidor). |
| Tem arquitetura orientada a eventos? | Sim, duas camadas: EventBus interno (desacopla Game/UI/Economy/Wave) e mensagens WebSocket tipadas como eventos de domínio entre clientes, com servidor atuando só como relay sem lógica de negócio. |
