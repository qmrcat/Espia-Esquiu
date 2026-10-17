/* =========================================================
   L'Espia Esmunyedís — lògica del joc
   Sense dependències externes.
   ========================================================= */
'use strict';

(() => {
  // ---------- Constants ----------

  // Direccions en sentit horari, de 45 en 45 graus. Índex parell = recta, senar = diagonal.
  const DIRS = [[-1, 0], [-1, 1], [0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1]];
  const DIR_NAMES = ['amunt', 'amunt a la dreta', 'a la dreta', 'avall a la dreta',
    'avall', "avall a l'esquerra", "a l'esquerra", "amunt a l'esquerra"];

  // Màxim d'espies segons la mida (no es poden tocar entre ells).
  const MAX_SPIES = { 4: 3, 5: 5, 6: 7 };
  const BLANK_RATIO = 0.34;
  const STORE_KEY = 'espia-esmunyedis-v2';

  const ICONS = {
    arrow: '<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M50 6 L84 44 H62 V92 H38 V44 H16 Z"/></svg>',
    blank: '<svg viewBox="0 0 100 100" aria-hidden="true"><rect x="16" y="16" width="68" height="68" rx="10" fill="none" stroke="currentColor" stroke-width="6" stroke-dasharray="12 9"/></svg>',
    spy: '<svg viewBox="0 0 100 100" aria-hidden="true">' +
      '<path d="M16 100 C18 78 30 68 43 64 L50 77 L57 64 C70 68 82 78 84 100 Z" fill="#0e121b"/>' +
      '<path d="M43 64 L50 77 L57 64 L54 62 H46 Z" fill="#d8cdb4"/>' +
      '<path d="M30 72 L43 64 L46 84 Z M70 72 L57 64 L54 84 Z" fill="#1b2232"/>' +
      '<path d="M35 39 C35 56 41 64 50 64 C59 64 65 56 65 39 Z" fill="#2a1d1a"/>' +
      '<rect x="36" y="43" width="12" height="7" rx="3" fill="#07090d"/>' +
      '<rect x="52" y="43" width="12" height="7" rx="3" fill="#07090d"/>' +
      '<rect x="47" y="45" width="6" height="2" fill="#07090d"/>' +
      '<path d="M39 44.5 h4" stroke="#fff" stroke-width="1.2" opacity=".55"/>' +
      '<path d="M55 44.5 h4" stroke="#fff" stroke-width="1.2" opacity=".55"/>' +
      '<path d="M31 37 C31 21 40 13 50 13 C60 13 69 21 69 37 Z" fill="#141925"/>' +
      '<rect x="31" y="30" width="38" height="6" fill="#9b2d3a"/>' +
      '<ellipse cx="50" cy="38" rx="35" ry="6" fill="#0c1018"/>' +
      '</svg>',
    lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h1Zm2 0h6V7a3 3 0 0 0-6 0v3Z"/></svg>',
    star: '<svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6-4.9-4.6 6.6-.8z"/></svg>'
  };

  // ---------- Desat local ----------

  const store = {
    data: { size: 5, live: false, sound: true, best: {}, completed: 0 },
    existed: false,
    load() {
      try {
        const raw = localStorage.getItem(STORE_KEY);
        if (raw) {
          Object.assign(this.data, JSON.parse(raw));
          this.existed = true;
        }
      } catch (e) { /* navegació privada o emmagatzematge bloquejat */ }
    },
    save() {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(this.data)); } catch (e) { /* res */ }
    }
  };

  // ---------- Utilitats ----------

  const $ = (sel, root = document) => root.querySelector(sel);
  const rand = (n) => Math.floor(Math.random() * n);

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = rand(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function neighbor(size, idx, dir) {
    const r = Math.floor(idx / size) + DIRS[dir][0];
    const c = (idx % size) + DIRS[dir][1];
    return (r < 0 || c < 0 || r >= size || c >= size) ? -1 : r * size + c;
  }

  function fmtTime(ms) {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  // ---------- Generador de nivells (sempre resolubles) ----------
  // Primer es construeix una solució vàlida i després es barregen les peces.

  function placeSpies(size, count) {
    const chosen = [];
    for (const idx of shuffle([...Array(size * size).keys()])) {
      if (chosen.length === count) break;
      const r = Math.floor(idx / size);
      const c = idx % size;
      const free = chosen.every((s) =>
        Math.max(Math.abs(Math.floor(s / size) - r), Math.abs((s % size) - c)) > 1);
      if (free) chosen.push(idx);
    }
    return chosen.length === count ? chosen : null;
  }

  function buildSolution(size, spySet) {
    const n = size * size;
    const sol = new Array(n).fill(null);
    for (let i = 0; i < n; i++) {
      if (!spySet.has(i)) sol[i] = { kind: Math.random() < BLANK_RATIO ? 'blank' : 'arrow', dir: -1 };
    }

    const optionsFor = (i) => {
      const opts = [];
      for (let d = 0; d < 8; d++) {
        const j = neighbor(size, i, d);
        if (j >= 0 && sol[j] && sol[j].kind === 'blank') opts.push(d);
      }
      return opts;
    };

    // Una fletxa sense cap peça blanca al voltant es converteix en blanca.
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < n; i++) {
        if (sol[i] && sol[i].kind === 'arrow' && optionsFor(i).length === 0) {
          sol[i].kind = 'blank';
          changed = true;
        }
      }
    }

    const isCovered = (b) => {
      for (let d = 0; d < 8; d++) {
        const a = neighbor(size, b, (d + 4) % 8);
        if (a >= 0 && sol[a] && sol[a].kind === 'arrow' && sol[a].dir === d) return true;
      }
      return false;
    };
    const candidatesFor = (b) => {
      const list = [];
      for (let d = 0; d < 8; d++) {
        const a = neighbor(size, b, (d + 4) % 8);
        if (a >= 0 && sol[a] && sol[a].kind === 'arrow' && sol[a].dir === -1) list.push({ a, d });
      }
      return list;
    };

    // Cada peça blanca necessita almenys una fletxa (primer les més difícils de cobrir).
    let pending = [];
    for (let i = 0; i < n; i++) if (sol[i] && sol[i].kind === 'blank') pending.push(i);
    shuffle(pending);
    while (true) {
      pending = pending.filter((b) => !isCovered(b));
      if (!pending.length) break;
      pending.sort((x, y) => candidatesFor(x).length - candidatesFor(y).length);
      const cands = candidatesFor(pending[0]);
      if (!cands.length) return null;
      const pick = cands[rand(cands.length)];
      sol[pick.a].dir = pick.d;
    }

    // La resta de fletxes apunten a qualsevol peça blanca veïna.
    let arrows = 0;
    let blanks = 0;
    for (let i = 0; i < n; i++) {
      if (!sol[i]) continue;
      if (sol[i].kind === 'blank') { blanks++; continue; }
      arrows++;
      if (sol[i].dir === -1) {
        const opts = optionsFor(i);
        sol[i].dir = opts[rand(opts.length)];
      }
    }

    // Descartem taulers massa fàcils (massa peces blanques o cap fletxa).
    if (arrows < 2 || blanks / (arrows + blanks) > 0.5) return null;
    return sol;
  }

  function generatePuzzle(size, spies) {
    for (let attempt = 0; attempt < 4000; attempt++) {
      const list = placeSpies(size, spies);
      if (!list) continue;
      const spySet = new Set(list);
      const sol = buildSolution(size, spySet);
      if (sol) return { spySet, sol };
    }
    return null;
  }

  // ---------- Estat ----------

  const S = {
    size: 5,
    level: 1,
    spyCount: 1,
    spySet: new Set(),
    sol: [],
    grid: [],
    pieces: [],
    cells: [],
    layer: null,
    initial: null,
    moves: 0,
    hints: 0,
    undo: [],
    solved: false,
    timeStart: 0,
    timeElapsed: 0,
    timerId: null,
    cursor: 0,
    picked: -1,
    aim: -1,
    flashErrorsUntil: 0,
    flashTimer: null
  };

  const board = $('#board');
  const ui = {
    level: $('#hud-level'),
    spies: $('#hud-spies'),
    time: $('#hud-time'),
    moves: $('#hud-moves'),
    hints: $('#hud-hints'),
    best: $('#hud-best'),
    undo: $('#btn-undo'),
    hint: $('#btn-hint'),
    check: $('#btn-check'),
    next: $('#btn-next'),
    restart: $('#btn-restart'),
    newGame: $('#btn-new'),
    live: $('#live'),
    sound: $('#sound'),
    modal: $('#modal'),
    toast: $('#toast')
  };

  const dirOf = (p) => (((Math.round(p.angle / 45)) % 8) + 8) % 8;
  const pieceType = (p) => (p.kind === 'blank' ? 'blank' : p.family);
  const solType = (s) => (s.kind === 'blank' ? 'blank' : (s.dir % 2 === 0 ? 'ortho' : 'diag'));
  const rowCol = (i) => `fila ${Math.floor(i / S.size) + 1}, columna ${(i % S.size) + 1}`;
  const elementAt = (i) => (S.grid[i] ? S.grid[i].el : S.cells[i]);
  const canMove = (i) => i >= 0 && !S.spySet.has(i) && !!S.grid[i] && !S.grid[i].locked;

  function matchesSolution(i) {
    const p = S.grid[i];
    const s = S.sol[i];
    if (!p || !s || p.kind !== s.kind) return false;
    return p.kind === 'blank' || dirOf(p) === s.dir;
  }

  // ---------- Anàlisi del tauler ----------

  // Funciona amb qualsevol tauler (el de joc o el de la demo).
  function analyzeGrid(size, grid, spySet) {
    const errors = new Map();
    const covered = new Set();
    const n = size * size;
    for (let i = 0; i < n; i++) {
      const p = grid[i];
      if (!p || p.kind !== 'arrow') continue;
      const j = neighbor(size, i, dirOf(p));
      if (j < 0) errors.set(i, 'out');
      else if (spySet.has(j)) errors.set(i, 'spy');
      else if (grid[j].kind === 'arrow') errors.set(i, 'arrow');
      else covered.add(j);
    }
    for (let i = 0; i < n; i++) {
      const p = grid[i];
      if (p && p.kind === 'blank' && !covered.has(i)) errors.set(i, 'lonely');
    }
    return errors;
  }

  function analyze() {
    return analyzeGrid(S.size, S.grid, S.spySet);
  }

  function describeError(i, code) {
    switch (code) {
      case 'out': return `La fletxa (${rowCol(i)}) apunta fora del tauler.`;
      case 'spy': return `La fletxa (${rowCol(i)}) apunta a un espia!`;
      case 'arrow': return `La fletxa (${rowCol(i)}) apunta a una altra fletxa.`;
      default: return `La peça blanca (${rowCol(i)}) no rep cap fletxa.`;
    }
  }

  // ---------- Creació de nivells ----------

  function newLevel() {
    stopTimer();
    hideModal();
    let count = Math.min(S.level, MAX_SPIES[S.size]);
    let puzzle = null;
    while (!puzzle && count >= 0) {
      puzzle = generatePuzzle(S.size, count);
      if (!puzzle) count--;
    }
    S.spyCount = count;
    S.spySet = puzzle.spySet;
    S.sol = puzzle.sol;
    S.pieces = [];
    S.sol.forEach((s) => {
      if (!s) return;
      S.pieces.push({
        id: S.pieces.length,
        kind: s.kind,
        family: s.kind === 'blank' ? null : (s.dir % 2 === 0 ? 'ortho' : 'diag'),
        angle: 0,
        locked: false,
        el: null,
        glyph: null
      });
    });
    scramble();
    S.initial = { grid: S.grid.map((p) => (p ? p.id : null)), angles: S.pieces.map((p) => p.angle) };
    resetCounters();
    buildBoard();
    afterChange();
    if (S.level > MAX_SPIES[S.size] && S.level === MAX_SPIES[S.size] + 1) {
      toast(`Ja tens el màxim d'espies per a un ${S.size}×${S.size}. Prova una mida més gran!`, 'info');
    }
  }

  function scramble() {
    const free = [];
    for (let i = 0; i < S.size * S.size; i++) if (!S.spySet.has(i)) free.push(i);
    const minErrors = Math.max(3, Math.ceil(free.length * 0.3));
    for (let tries = 0; tries < 300; tries++) {
      S.grid = new Array(S.size * S.size).fill(null);
      const order = shuffle(S.pieces.slice());
      free.forEach((idx, k) => { S.grid[idx] = order[k]; });
      S.pieces.forEach((p) => {
        if (p.kind === 'arrow') p.angle = (p.family === 'ortho' ? 0 : 45) + 90 * rand(4);
      });
      if (analyze().size >= minErrors) return;
    }
  }

  function resetCounters() {
    S.moves = 0;
    S.hints = 0;
    S.undo = [];
    S.solved = false;
    S.timeStart = 0;
    S.timeElapsed = 0;
    S.picked = -1;
    S.aim = -1;
    S.flashErrorsUntil = 0;
    S.cursor = Math.min(S.cursor, S.size * S.size - 1);
    S.pieces.forEach((p) => { p.locked = false; });
    ui.time.textContent = '0:00';
  }

  function restartLevel() {
    stopTimer();
    hideModal();
    S.grid = S.initial.grid.map((id) => (id === null ? null : S.pieces[id]));
    S.pieces.forEach((p, k) => { p.angle = S.initial.angles[k]; });
    resetCounters();
    board.classList.remove('solved');
    S.grid.forEach((p, i) => { if (p) placePiece(p, i); });
    S.pieces.forEach(updateGlyph);
    afterChange();
    toast('Nivell reiniciat.', 'info');
  }

  // ---------- Pintat ----------

  function buildBoard() {
    board.innerHTML = '';
    board.style.setProperty('--n', S.size);
    board.classList.remove('solved');
    S.cells = [];
    for (let i = 0; i < S.size * S.size; i++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.idx = i;
      if (S.spySet.has(i)) {
        cell.classList.add('spy');
        cell.innerHTML = ICONS.spy;
      }
      board.appendChild(cell);
      S.cells.push(cell);
    }
    S.layer = document.createElement('div');
    S.layer.className = 'layer';
    board.appendChild(S.layer);

    S.pieces.forEach((p) => {
      const el = document.createElement('div');
      el.className = `piece ${p.kind}${p.family ? ' ' + p.family : ''}`;
      el.dataset.id = p.id;
      el.innerHTML = `<div class="tile"><div class="glyph">${p.kind === 'arrow' ? ICONS.arrow : ICONS.blank}</div>` +
        `<span class="lock">${ICONS.lock}</span></div>`;
      p.el = el;
      p.glyph = el.querySelector('.glyph');
      S.layer.appendChild(el);
    });
    S.grid.forEach((p, i) => { if (p) placePiece(p, i); });
    S.pieces.forEach(updateGlyph);
  }

  function placePiece(p, idx) {
    p.el.style.setProperty('--r', Math.floor(idx / S.size));
    p.el.style.setProperty('--c', idx % S.size);
    p.el.style.setProperty('--i', idx);
  }

  function updateGlyph(p) {
    p.glyph.style.setProperty('--a', `${p.angle}deg`);
    p.el.classList.toggle('locked', p.locked);
  }

  function updateLabels() {
    S.grid.forEach((p, i) => {
      if (!p) return;
      let label = p.kind === 'blank'
        ? `Peça blanca${p.el.classList.contains('lonely') ? ' sense cap fletxa' : ''}, ${rowCol(i)}`
        : `Fletxa ${p.family === 'ortho' ? 'recta' : 'diagonal'} cap ${DIR_NAMES[dirOf(p)]}, ${rowCol(i)}`;
      if (p.locked) label += ', fixada';
      p.el.setAttribute('aria-label', label);
    });
  }

  function clearMarks(...classes) {
    board.querySelectorAll(classes.map((c) => '.' + c).join(',')).forEach((el) => el.classList.remove(...classes));
  }

  // Ressalta la casella on apunta la fletxa de la posició i (verd si és correcte).
  function markAim(root, size, grid, cells, spySet, i) {
    root.querySelectorAll('.aim, .aim-bad, .aim-out').forEach((el) => el.classList.remove('aim', 'aim-bad', 'aim-out'));
    if (i < 0) return;
    const p = grid[i];
    if (!p || p.kind !== 'arrow') return;
    const j = neighbor(size, i, dirOf(p));
    if (j < 0) p.el.classList.add('aim-out');
    else if (spySet.has(j)) cells[j].classList.add('aim-bad');
    else grid[j].el.classList.add(grid[j].kind === 'blank' ? 'aim' : 'aim-bad');
  }

  function updateAim() {
    markAim(board, S.size, S.grid, S.cells, S.spySet, (S.solved || drag) ? -1 : S.aim);
  }

  function updateCursor() {
    clearMarks('kcursor', 'picked');
    if (board.classList.contains('kbd') && !S.solved) elementAt(S.cursor).classList.add('kcursor');
    if (S.picked >= 0 && S.grid[S.picked]) S.grid[S.picked].el.classList.add('picked');
  }

  function updateHUD() {
    ui.level.textContent = S.level;
    ui.spies.textContent = S.spyCount;
    ui.moves.textContent = S.moves;
    ui.hints.textContent = S.hints;
    const best = store.data.best[S.size];
    ui.best.textContent = best && best.level ? `Niv. ${best.level}` : '–';
    document.querySelectorAll('.seg button').forEach((b) => {
      b.setAttribute('aria-pressed', String(+b.dataset.size === S.size));
    });
  }

  function updateButtons() {
    ui.undo.disabled = S.solved || S.undo.length === 0;
    ui.hint.disabled = S.solved;
    ui.check.disabled = S.solved;
    ui.check.hidden = S.solved;
    ui.next.hidden = !S.solved;
  }

  function afterChange() {
    const errors = analyze();
    const showErrors = store.data.live || Date.now() < S.flashErrorsUntil;
    S.pieces.forEach((p) => p.el.classList.remove('err', 'lonely'));
    if (!S.solved) {
      errors.forEach((code, i) => {
        // Les peces blanques sense cap fletxa es marquen sempre
        if (code === 'lonely') S.grid[i].el.classList.add('lonely');
        if (showErrors) S.grid[i].el.classList.add('err');
      });
    }
    updateAim();
    updateCursor();
    updateLabels();
    updateHUD();
    updateButtons();
    if (errors.size === 0 && !S.solved) win();
    return errors;
  }

  // ---------- Temporitzador ----------

  function tick() {
    S.timeElapsed = Date.now() - S.timeStart;
    ui.time.textContent = fmtTime(S.timeElapsed);
  }

  function startTimer() {
    if (S.timerId || S.solved) return;
    S.timeStart = Date.now() - S.timeElapsed;
    S.timerId = setInterval(tick, 250);
    tick();
  }

  function stopTimer() {
    if (!S.timerId) return;
    clearInterval(S.timerId);
    S.timerId = null;
    tick();
  }

  // ---------- Accions ----------

  function countMove() {
    S.moves++;
    startTimer();
  }

  function rawSwap(a, b) {
    const pa = S.grid[a];
    const pb = S.grid[b];
    S.grid[a] = pb;
    S.grid[b] = pa;
    placePiece(pb, a);
    placePiece(pa, b);
  }

  function doSwap(a, b, record = true) {
    if (S.solved || a === b || !canMove(a) || !canMove(b)) return false;
    rawSwap(a, b);
    if (record) {
      S.undo.push({ t: 'swap', a, b });
      countMove();
    }
    sfx('move');
    afterChange();
    return true;
  }

  function doRotate(idx, delta, record = true) {
    if (S.solved || !canMove(idx)) return false;
    const p = S.grid[idx];
    if (p.kind !== 'arrow') return false;
    p.angle += 90 * delta;
    updateGlyph(p);
    if (record) {
      S.undo.push({ t: 'rot', idx, delta });
      countMove();
    }
    sfx('rotate');
    afterChange();
    return true;
  }

  function undo() {
    if (S.solved) return;
    const a = S.undo.pop();
    if (!a) return;
    if (a.t === 'swap') doSwap(a.a, a.b, false);
    else doRotate(a.idx, -a.delta, false);
  }

  function hint() {
    if (S.solved) return;
    const n = S.size * S.size;
    const wrong = [];
    for (let i = 0; i < n; i++) {
      if (S.grid[i] && !S.grid[i].locked && !matchesSolution(i)) wrong.push(i);
    }
    if (!wrong.length) return;

    const t = wrong[rand(wrong.length)];
    const need = solType(S.sol[t]);
    if (pieceType(S.grid[t]) !== need) {
      let cands = wrong.filter((i) => i !== t && pieceType(S.grid[i]) === need);
      const better = cands.filter((i) => solType(S.sol[i]) !== need);
      if (better.length) cands = better;
      if (!cands.length) return;
      rawSwap(t, cands[rand(cands.length)]);
    }
    const p = S.grid[t];
    if (p.kind === 'arrow') p.angle += (((S.sol[t].dir - dirOf(p)) % 8 + 8) % 8) * 45;
    p.locked = true;
    updateGlyph(p);
    p.el.classList.remove('hinted');
    void p.el.offsetWidth; // reinicia l'animació
    p.el.classList.add('hinted');

    S.hints++;
    S.undo = [];
    if (S.picked === t) S.picked = -1;
    startTimer();
    sfx('hint');
    toast(`Pista: la peça de la ${rowCol(t)} ja és al seu lloc.`, 'info');
    afterChange();
  }

  function checkNow() {
    if (S.solved) return;
    const errors = analyze();
    if (errors.size === 0) { afterChange(); return; }
    S.flashErrorsUntil = Date.now() + 2600;
    afterChange();
    clearTimeout(S.flashTimer);
    S.flashTimer = setTimeout(afterChange, 2700);
    const [i, code] = errors.entries().next().value;
    const count = errors.size;
    toast(`${count} ${count === 1 ? 'problema' : 'problemes'} · ${describeError(i, code)}`, 'error');
    sfx('error');
  }

  function wiggle(el) {
    el.classList.remove('wiggle');
    void el.offsetWidth;
    el.classList.add('wiggle');
    setTimeout(() => el.classList.remove('wiggle'), 400);
  }

  // ---------- Victòria ----------

  function win() {
    S.solved = true;
    S.picked = -1;
    stopTimer();

    const stars = S.hints === 0 ? 3 : (S.hints <= 2 ? 2 : 1);
    const best = store.data.best[S.size] || { level: 0, times: {} };
    best.times = best.times || {};
    if (S.level > best.level) best.level = S.level;
    const prev = best.times[S.level];
    const record = S.hints === 0 && (!prev || S.timeElapsed < prev);
    if (record) best.times[S.level] = S.timeElapsed;
    store.data.best[S.size] = best;
    store.data.completed = (store.data.completed || 0) + 1;
    store.save();

    board.classList.add('solved');
    clearMarks('aim', 'aim-bad', 'aim-out', 'kcursor', 'picked', 'err');
    updateHUD();
    updateButtons();
    sfx('win');
    confetti();
    toast('Missió complerta! Cap espia no ha estat descobert.', 'ok');
    setTimeout(() => { if (S.solved) showModal(stars, record && !!prev, prev); }, 750);
  }

  function showModal(stars, newRecord, prev) {
    $('#m-title').textContent = `Nivell ${S.level} superat`;
    $('#m-sub').textContent = `Tauler ${S.size}×${S.size} · ${S.spyCount} ${S.spyCount === 1 ? 'espia' : 'espies'}`;
    $('#m-stars').innerHTML = [0, 1, 2].map((k) => ICONS.star.replace('<svg', `<svg class="${k < stars ? 'on' : ''}"`)).join('');
    $('#m-time').textContent = fmtTime(S.timeElapsed);
    $('#m-moves').textContent = S.moves;
    $('#m-hints').textContent = S.hints;
    let note = '';
    if (newRecord) note = `Nou rècord de temps! (abans ${fmtTime(prev)})`;
    else if (S.hints === 0) note = 'Sense cap pista. Impecable.';
    else note = 'Prova-ho sense pistes per aconseguir 3 estrelles.';
    $('#m-note').textContent = note;
    ui.modal.hidden = false;
    $('#m-next').focus();
  }

  function hideModal() {
    ui.modal.hidden = true;
  }

  function nextLevel() {
    S.level++;
    newLevel();
  }

  // ---------- So (Web Audio, sense fitxers) ----------

  let actx = null;

  function tone(freq, t0, dur, type, vol) {
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(actx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.03);
  }

  function sfx(kind) {
    if (!store.data.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      const t = actx.currentTime;
      switch (kind) {
        case 'move': tone(260, t, 0.09, 'triangle', 0.07); tone(390, t + 0.04, 0.08, 'triangle', 0.05); break;
        case 'rotate': tone(640, t, 0.05, 'square', 0.02); break;
        case 'error': tone(190, t, 0.16, 'sawtooth', 0.035); tone(140, t + 0.1, 0.2, 'sawtooth', 0.03); break;
        case 'hint': tone(740, t, 0.12, 'sine', 0.06); tone(988, t + 0.08, 0.18, 'sine', 0.05); break;
        case 'bump': tone(120, t, 0.08, 'square', 0.025); break;
        case 'win': [523, 659, 784, 1047].forEach((f, k) => tone(f, t + k * 0.11, 0.3, 'triangle', 0.07)); break;
        default: break;
      }
    } catch (e) { /* àudio no disponible */ }
  }

  // ---------- Confeti ----------

  let confettiRaf = 0;

  function confetti() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cv = $('#confetti');
    const ctx = cv.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const W = window.innerWidth;
    const H = window.innerHeight;
    cv.width = W * dpr;
    cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const colors = ['#f2b13c', '#38c9b4', '#f3ead6', '#e5525f', '#8fb0ff'];
    const parts = Array.from({ length: 170 }, () => ({
      x: W / 2 + (Math.random() - 0.5) * 160,
      y: H * 0.38,
      vx: (Math.random() - 0.5) * 15,
      vy: -Math.random() * 15 - 4,
      s: 6 + Math.random() * 6,
      r: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.3,
      c: colors[rand(colors.length)]
    }));
    const start = performance.now();
    const DURATION = 3200;
    cancelAnimationFrame(confettiRaf);

    const frame = (now) => {
      const el = now - start;
      ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = Math.max(0, 1 - el / DURATION);
      parts.forEach((p) => {
        p.vy += 0.35;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        ctx.restore();
      });
      if (el < DURATION) confettiRaf = requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, W, H);
    };
    confettiRaf = requestAnimationFrame(frame);
  }

  // ---------- Avisos ----------

  let toastTimer = null;

  function toast(msg, kind = 'info') {
    ui.toast.textContent = msg;
    ui.toast.className = `toast show ${kind}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 3400);
  }

  // ---------- Ratolí i pantalla tàctil (Pointer Events) ----------

  let drag = null;

  function cellIndexAt(x, y) {
    const cell = document.elementsFromPoint(x, y).find((el) => el.classList && el.classList.contains('cell'));
    return cell ? +cell.dataset.idx : -1;
  }

  function setDropTarget(i) {
    if (drag.target === i) return;
    if (drag.target >= 0) elementAt(drag.target).classList.remove('drop-target', 'drop-bad');
    drag.target = i;
    if (i < 0 || i === drag.idx) return;
    elementAt(i).classList.add(canMove(i) ? 'drop-target' : 'drop-bad');
  }

  function endDrag(e, cancelled) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    if (d.target >= 0) elementAt(d.target).classList.remove('drop-target', 'drop-bad');

    if (d.active) {
      d.el.classList.remove('dragging');
      d.el.style.transform = '';
      if (!cancelled && d.target >= 0 && d.target !== d.idx) {
        if (canMove(d.target)) doSwap(d.idx, d.target);
        else { sfx('bump'); wiggle(elementAt(d.target)); }
      }
    } else if (!cancelled) {
      if (d.p.kind === 'arrow') doRotate(d.idx, 1);
      else wiggle(d.el);
    }
    updateAim();
  }

  board.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') board.classList.remove('kbd');
    if (e.button !== 0 || S.solved || drag) return;
    const el = e.target.closest('.piece');
    if (!el) {
      const spyCell = e.target.closest('.cell.spy');
      if (spyCell) { wiggle(spyCell); sfx('bump'); }
      return;
    }
    const p = S.pieces[+el.dataset.id];
    const idx = S.grid.indexOf(p);
    if (p.locked) {
      wiggle(el);
      sfx('bump');
      toast('Aquesta peça està fixada per una pista.', 'info');
      return;
    }
    e.preventDefault();
    try { el.setPointerCapture(e.pointerId); } catch (err) { /* res */ }
    drag = { p, idx, el, id: e.pointerId, x0: e.clientX, y0: e.clientY, active: false, target: -1, offX: 0, offY: 0 };
  });

  board.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.active) {
      if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 7) return;
      drag.active = true;
      const r = drag.el.getBoundingClientRect();
      drag.offX = drag.x0 - r.left;
      drag.offY = drag.y0 - r.top;
      drag.el.classList.add('dragging');
      clearMarks('aim', 'aim-bad', 'aim-out');
    }
    const lr = S.layer.getBoundingClientRect();
    drag.el.style.transform = `translate(${e.clientX - lr.left - drag.offX}px, ${e.clientY - lr.top - drag.offY}px)`;
    setDropTarget(cellIndexAt(e.clientX, e.clientY));
  });

  board.addEventListener('pointerup', (e) => endDrag(e, false));
  board.addEventListener('pointercancel', (e) => endDrag(e, true));

  board.addEventListener('contextmenu', (e) => {
    const el = e.target.closest('.piece');
    if (!el) return;
    e.preventDefault();
    if (drag) return;
    const p = S.pieces[+el.dataset.id];
    if (!p.locked) doRotate(S.grid.indexOf(p), -1);
  });

  // Previsualitza a on apunta la fletxa quan hi passes el ratolí
  board.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse' || drag) return;
    const el = e.target.closest('.piece');
    const next = el ? S.grid.indexOf(S.pieces[+el.dataset.id]) : -1;
    if (next !== S.aim) {
      S.aim = next;
      updateAim();
    }
  });

  board.addEventListener('pointerleave', () => {
    if (drag || board.classList.contains('kbd')) return;
    S.aim = -1;
    updateAim();
  });

  // ---------- Teclat ----------

  function pickOrDrop() {
    if (S.solved) return;
    const c = S.cursor;
    if (S.picked < 0) {
      if (canMove(c)) S.picked = c;
      else { sfx('bump'); wiggle(elementAt(c)); }
    } else if (S.picked === c) {
      S.picked = -1;
    } else if (canMove(c)) {
      const from = S.picked;
      S.picked = -1;
      doSwap(from, c);
    } else {
      sfx('bump');
      wiggle(elementAt(c));
    }
  }

  board.addEventListener('keydown', (e) => {
    const n = S.size;
    let r = Math.floor(S.cursor / n);
    let c = S.cursor % n;
    switch (e.key) {
      case 'ArrowUp': r = Math.max(0, r - 1); break;
      case 'ArrowDown': r = Math.min(n - 1, r + 1); break;
      case 'ArrowLeft': c = Math.max(0, c - 1); break;
      case 'ArrowRight': c = Math.min(n - 1, c + 1); break;
      case 'Enter':
      case ' ': pickOrDrop(); break;
      case 'r':
      case 'R': doRotate(S.cursor, e.shiftKey ? -1 : 1); break;
      case 'Escape': S.picked = -1; break;
      default: return;
    }
    e.preventDefault();
    board.classList.add('kbd');
    S.cursor = r * n + c;
    S.aim = S.cursor;
    updateAim();
    updateCursor();
  });

  board.addEventListener('focus', () => {
    // Només mostrem el cursor si s'hi arriba amb el teclat
    if (board.matches(':focus-visible')) {
      board.classList.add('kbd');
      updateCursor();
    }
  });

  board.addEventListener('blur', () => {
    board.classList.remove('kbd');
    S.picked = -1;
    updateCursor();
  });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      undo();
    } else if (e.key === 'Escape') {
      if (!demoUI.modal.hidden) closeDemo();
      else if (!ui.modal.hidden) hideModal();
    }
  });

  // ---------- Demo animada ----------
  // Un tauler 3×3 independent del joc on un cursor fictici resol el trencaclosques pas a pas.

  const DEMO_SIZE = 3;
  const DEMO_SPIES = new Set([0]);
  // Angles: 0 = amunt, 45 = amunt-dreta, 90 = dreta, 180 = avall, 315 = amunt-esquerra...
  const DEMO_START = [
    null,
    { kind: 'arrow', family: 'diag', angle: 45 },
    { kind: 'arrow', family: 'ortho', angle: 90 },
    { kind: 'blank' },
    { kind: 'arrow', family: 'diag', angle: 315 },
    { kind: 'blank' },
    { kind: 'blank' },
    { kind: 'blank' },
    { kind: 'arrow', family: 'ortho', angle: 180 }
  ];

  const CANCELLED = Symbol('demo-cancelled');
  const demo = { grid: [], cells: [], aim: -1, token: null, paused: false, timerWasRunning: false };
  const demoUI = {
    modal: $('#demo'),
    stage: $('#demo-stage'),
    board: $('#demo-board'),
    cursor: $('#demo-cursor'),
    tag: $('#demo-tag'),
    caption: $('#demo-caption'),
    dots: $('#demo-dots'),
    pause: $('#demo-pause'),
    restart: $('#demo-restart'),
    close: $('#demo-close')
  };

  function setPos(el, idx, size) {
    el.style.setProperty('--r', Math.floor(idx / size));
    el.style.setProperty('--c', idx % size);
    el.style.setProperty('--i', idx);
  }

  function demoBuild() {
    const b = demoUI.board;
    b.innerHTML = '';
    b.classList.remove('solved');
    b.style.setProperty('--n', DEMO_SIZE);
    demo.cells = [];
    for (let i = 0; i < DEMO_SIZE * DEMO_SIZE; i++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      if (DEMO_SPIES.has(i)) {
        cell.classList.add('spy');
        cell.innerHTML = ICONS.spy;
      }
      b.appendChild(cell);
      demo.cells.push(cell);
    }
    const layer = document.createElement('div');
    layer.className = 'layer';
    b.appendChild(layer);

    demo.grid = DEMO_START.map((d, i) => {
      if (!d) return null;
      const el = document.createElement('div');
      el.className = `piece ${d.kind}${d.family ? ' ' + d.family : ''}`;
      el.innerHTML = `<div class="tile"><div class="glyph">${d.kind === 'arrow' ? ICONS.arrow : ICONS.blank}</div></div>`;
      layer.appendChild(el);
      const p = { kind: d.kind, family: d.family || null, angle: d.angle || 0, el, glyph: el.querySelector('.glyph') };
      setPos(el, i, DEMO_SIZE);
      p.glyph.style.setProperty('--a', `${p.angle}deg`);
      return p;
    });
    demo.aim = -1;
    demoRefresh();

    // El cursor comença invisible al centre del tauler
    demoUI.cursor.classList.remove('show', 'hold', 'press', 'tagged');
    demoUI.cursor.style.transition = 'none';
    cursorTo(4);
    void demoUI.cursor.offsetWidth;
    demoUI.cursor.style.transition = '';
  }

  function demoRefresh() {
    const errors = analyzeGrid(DEMO_SIZE, demo.grid, DEMO_SPIES);
    demo.grid.forEach((p) => { if (p) p.el.classList.remove('lonely'); });
    errors.forEach((code, i) => { if (code === 'lonely') demo.grid[i].el.classList.add('lonely'); });
    demoUI.board.classList.toggle('solved', errors.size === 0);
    markAim(demoUI.board, DEMO_SIZE, demo.grid, demo.cells, DEMO_SPIES, demo.aim);
  }

  function demoSetAim(i) {
    demo.aim = i;
    markAim(demoUI.board, DEMO_SIZE, demo.grid, demo.cells, DEMO_SPIES, i);
  }

  // Espera que es pot posar en pausa i cancel·lar
  function dwait(ms) {
    const token = demo.token;
    return new Promise((resolve, reject) => {
      let left = ms;
      let last = performance.now();
      const step = () => {
        if (token.cancelled) { reject(CANCELLED); return; }
        const now = performance.now();
        if (!demo.paused) left -= now - last;
        last = now;
        if (left <= 0) resolve();
        else setTimeout(step, 40);
      };
      setTimeout(step, 40);
    });
  }

  function cursorTo(i) {
    const stage = demoUI.stage.getBoundingClientRect();
    const r = demo.cells[i].getBoundingClientRect();
    const x = r.left - stage.left + r.width * 0.55;
    const y = r.top - stage.top + r.height * 0.55;
    demoUI.cursor.style.transform = `translate(${x}px, ${y}px)`;
  }

  async function moveTo(i) {
    demoUI.cursor.classList.add('show');
    cursorTo(i);
    await dwait(750);
  }

  function setTag(text) {
    demoUI.tag.textContent = text;
    demoUI.cursor.classList.toggle('tagged', !!text);
  }

  async function demoClick(i, delta, label) {
    setTag(label);
    demoUI.cursor.classList.remove('press');
    void demoUI.cursor.offsetWidth;
    demoUI.cursor.classList.add('press');
    await dwait(180);
    const p = demo.grid[i];
    p.angle += 90 * delta;
    p.glyph.style.setProperty('--a', `${p.angle}deg`);
    demo.aim = i;
    demoRefresh();
    await dwait(900);
    setTag('');
  }

  async function demoDrag(a, b) {
    const pa = demo.grid[a];
    const pb = demo.grid[b];
    await moveTo(a);
    setTag('arrossega');
    demoUI.cursor.classList.add('hold');
    await dwait(300);
    pa.el.classList.add('demo-lift');
    setPos(pa.el, b, DEMO_SIZE);
    cursorTo(b);
    await dwait(800);
    demo.grid[a] = pb;
    demo.grid[b] = pa;
    setPos(pb.el, a, DEMO_SIZE);
    demoUI.cursor.classList.remove('hold');
    pa.el.classList.remove('demo-lift');
    setTag('');
    demoRefresh();
    await dwait(300);
  }

  const DEMO_STEPS = [
    {
      text: "L'objectiu: cada fletxa ha d'apuntar a una peça blanca del costat, i cada peça blanca ha de rebre almenys una fletxa. Les marcades amb «!» encara no en reben cap.",
      run: async () => { await dwait(4500); }
    },
    {
      text: "Compte! Aquesta fletxa apunta a l'espia. Un espia no es pot assenyalar mai.",
      run: async () => { await moveTo(4); demoSetAim(4); await dwait(2800); }
    },
    {
      text: "El clic dret (o Maj+R) la gira 90° cap a l'esquerra. Ara apunta a una peça blanca: el verd vol dir que està bé.",
      run: async () => { await demoClick(4, -1, 'clic dret'); await dwait(2800); }
    },
    {
      text: 'Aquesta altra apunta fora del tauler. Un clic (o la tecla R) la gira 90° cap a la dreta.',
      run: async () => { await moveTo(2); demoSetAim(2); await dwait(2000); await demoClick(2, 1, 'clic'); await dwait(2000); }
    },
    {
      text: 'La de la cantonada també surt del tauler. Un altre clic i ja apunta a una peça blanca.',
      run: async () => { await moveTo(8); demoSetAim(8); await dwait(1800); await demoClick(8, 1, 'clic'); await dwait(2000); }
    },
    {
      text: 'Arrossega una peça sobre una altra per intercanviar-les. Les fletxes diagonals (turquesa) sempre continuen sent diagonals.',
      run: async () => { demoSetAim(-1); await dwait(1200); await demoDrag(1, 3); demoSetAim(3); await dwait(2600); }
    },
    {
      text: 'Totes les peces blanques reben una fletxa i cap espia no ha estat delatat. Missió complerta! Ara et toca a tu.',
      run: async () => { demoSetAim(-1); demoUI.cursor.classList.remove('show'); await dwait(600); }
    }
  ];

  function renderDots(k) {
    demoUI.dots.innerHTML = DEMO_STEPS.map((_, i) =>
      `<span class="${i === k ? 'on' : (i < k ? 'done' : '')}"></span>`).join('');
  }

  function updatePauseBtn(finished = false) {
    demoUI.pause.disabled = finished;
    demoUI.pause.innerHTML = demo.paused
      ? '<span aria-hidden="true">▶</span> Continua'
      : '<span aria-hidden="true">❚❚</span> Pausa';
  }

  async function runDemo() {
    if (demo.token) demo.token.cancelled = true;
    demo.token = { cancelled: false };
    demo.paused = false;
    updatePauseBtn();
    demoBuild();
    try {
      for (let k = 0; k < DEMO_STEPS.length; k++) {
        renderDots(k);
        demoUI.caption.textContent = DEMO_STEPS[k].text;
        await DEMO_STEPS[k].run();
      }
      renderDots(DEMO_STEPS.length);
      updatePauseBtn(true);
    } catch (e) {
      if (e !== CANCELLED) throw e;
    }
  }

  function openDemo() {
    hideModal();
    demo.timerWasRunning = !!S.timerId;
    stopTimer();
    demoUI.modal.hidden = false;
    demoUI.close.focus();
    runDemo();
  }

  function closeDemo() {
    if (demoUI.modal.hidden) return;
    if (demo.token) demo.token.cancelled = true;
    demoUI.modal.hidden = true;
    if (demo.timerWasRunning && !S.solved) startTimer();
    board.focus({ preventScroll: true });
  }

  $('#btn-demo').addEventListener('click', openDemo);
  $('#btn-demo-2').addEventListener('click', openDemo);
  demoUI.close.addEventListener('click', closeDemo);
  demoUI.restart.addEventListener('click', runDemo);
  demoUI.pause.addEventListener('click', () => {
    demo.paused = !demo.paused;
    updatePauseBtn();
  });
  demoUI.modal.addEventListener('click', (e) => { if (e.target === demoUI.modal) closeDemo(); });

  // ---------- Botons ----------

  ui.undo.addEventListener('click', undo);
  ui.hint.addEventListener('click', hint);
  ui.check.addEventListener('click', checkNow);
  ui.next.addEventListener('click', nextLevel);
  ui.restart.addEventListener('click', restartLevel);
  ui.newGame.addEventListener('click', () => { S.level = 1; newLevel(); });

  $('#m-next').addEventListener('click', nextLevel);
  $('#m-replay').addEventListener('click', newLevel);
  $('#m-close').addEventListener('click', hideModal);
  ui.modal.addEventListener('click', (e) => { if (e.target === ui.modal) hideModal(); });

  document.querySelectorAll('.seg button').forEach((b) => {
    b.addEventListener('click', () => {
      const size = +b.dataset.size;
      if (size === S.size) return;
      S.size = size;
      S.level = 1;
      store.data.size = size;
      store.save();
      newLevel();
    });
  });

  ui.live.addEventListener('change', () => {
    store.data.live = ui.live.checked;
    store.save();
    afterChange();
  });

  ui.sound.addEventListener('click', () => {
    store.data.sound = !store.data.sound;
    store.save();
    ui.sound.setAttribute('aria-pressed', String(store.data.sound));
    sfx('rotate');
  });

  // ---------- Inici ----------

  function init() {
    store.load();
    S.size = [4, 5, 6].includes(store.data.size) ? store.data.size : 5;
    ui.live.checked = !!store.data.live;
    ui.sound.setAttribute('aria-pressed', String(!!store.data.sound));
    if (!store.existed) $('#rules').open = true;

    document.querySelectorAll('.mini[data-icon]').forEach((el) => {
      const kind = el.dataset.icon;
      el.innerHTML = kind === 'spy' ? ICONS.spy : (kind === 'blank' ? ICONS.blank : ICONS.arrow);
    });

    newLevel();
  }

  init();
})();
