/* Mijoté — logique d'écran. Vanilla, zéro dépendance. */
(() => {
  'use strict';

  const R = (window.RECIPES || []);
  const TRENDS = (window.TRENDS || []);
  const TECH = (window.TECHNIQUES || []);
  const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
  const JOURS_COURT = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  const RAYONS = ['Fruits & légumes', 'Boucherie', 'Poissonnerie', 'Crèmerie', 'Épicerie', 'Boulangerie', 'Surgelés'];

  const state = {
    tab: 'today',
    profile: localStorage.getItem('mj-profile') || 'elle',
    day: new Date().getDay() === 0 ? 6 : new Date().getDay() - 1,
    week: Number(localStorage.getItem('mj-week') || 0),
    favs: JSON.parse(localStorage.getItem('mj-favs') || '[]'),
    checked: JSON.parse(localStorage.getItem('mj-checked') || '[]'),
    filter: 'tous',
  };

  const $ = (s, r = document) => r.querySelector(s);
  const screen = $('#screen');
  const sheet = $('#sheet');
  const scrim = $('#scrim');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ------------------------------------------------------------ helpers */
  const byDay = () => R.slice(state.week * 7, state.week * 7 + 7);
  const kcalOf = (r) => (r.portions?.[state.profile]?.kcal ?? 0);
  const protOf = (r) => (r.portions?.[state.profile]?.prot ?? 0);
  const qteOf = (ing) => (state.profile === 'lui' ? ing.qte_lui : ing.qte_elle) || ing.qte_elle || '';


  /* --------------------------------------------------- quantités agrégées */
  function parseQte(s) {
    if (!s) return null;
    const t = String(s).trim().toLowerCase().replace(',', '.');
    const m = t.match(/^(\d+(?:\.\d+)?)(?:\s*\/\s*(\d+))?\s*(.*)$/);
    if (!m) return { val: null, unit: t, raw: String(s).trim() };
    let val = parseFloat(m[1]);
    if (m[2]) val = val / parseFloat(m[2]);
    let unit = (m[3] || '').trim();
    unit = unit.replace(/^de\s+/, '');
    if (unit.startsWith('pièce')) unit = 'pièce';
    if (unit.startsWith('gousse')) unit = 'gousse';
    if (unit.startsWith('bouquet')) unit = 'bouquet';
    if (unit === 'g' || unit === 'gr' || unit === 'grammes') unit = 'g';
    if (unit === 'ml' || unit === 'cl') { if (unit === 'cl') val *= 10; unit = 'ml'; }
    if (unit === 'c. à s.' || unit === 'cas') unit = 'c. à s.';
    if (unit === 'c. à c.' || unit === 'cac') unit = 'c. à c.';
    return { val, unit: unit || '', raw: String(s).trim() };
  }

  function sumQte(parts) {
    const byUnit = new Map();
    parts.forEach((p) => {
      if (p.val == null) { byUnit.set(p.raw, { val: null, unit: p.raw }); return; }
      const k = p.unit;
      byUnit.set(k, { val: (byUnit.get(k)?.val || 0) + p.val, unit: k });
    });
    return [...byUnit.values()];
  }

  function fmtQte(list) {
    const out = list.map(({ val, unit }) => {
      if (val == null) return unit;
      let v = val;
      if (unit === 'g' || unit === 'ml') v = Math.ceil(v / 5) * 5;
      else if (unit === 'pièce') v = Math.ceil(v * 2) / 2;
      else v = Math.ceil(v);
      const n = Number.isInteger(v) ? v : v.toFixed(1).replace('.0', '').replace('.', ',');
      if (!unit) return `${n}`;
      if (unit === 'pièce') return `${n} pièce${v > 1 ? 's' : ''}`;
      if (unit === 'gousse') return `${n} gousse${v > 1 ? 's' : ''}`;
      if (unit === 'bouquet') return `${n} bouquet${v > 1 ? 's' : ''}`;
      return `${n} ${unit}`;
    });
    return out.join(' · ');
  }


  /* --------------------------------------------------- visuel de la carte */
  function hue(id) {
    let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
    return h;
  }
  function plateArt(r, size) {
    const h = hue(r.id);
    const letter = (r.nom || '?').replace(/[^A-Za-zÀ-ÿ]/g, '').charAt(0).toUpperCase();
    return `<div class="plate-art ${size}" style="--h:${h}" aria-hidden="true">
      <span class="pa-ring"></span><span class="pa-letter">${esc(letter)}</span>
    </div>`;
  }

  function saveFavs() { localStorage.setItem('mj-favs', JSON.stringify(state.favs)); }
  function saveChecked() { localStorage.setItem('mj-checked', JSON.stringify(state.checked)); }

  /* --------------------------------------------------------------- today */
  function viewToday() {
    const day = byDay();
    const rec = day[state.day] || R[0];
    if (!rec) return `<div class="empty">Aucune recette chargée.</div>`;
    const others = day.filter((_, i) => i !== state.day);
    return `
      <section class="tonight">
        <p class="eyebrow">${state.profile === 'elle' ? 'Elle · 1600 kcal' : 'Lui · 2000 kcal'} · ce soir</p>
        <div class="tonight-card">
          ${rec.photo ? `<div class="tonight-photo" style="background-image:url('img/${esc(rec.photo)}')"></div>` : plateArt(rec, 'hero')}
          <div class="tonight-top">
            <span class="tonight-day">${esc(JOURS[state.day])} · ${esc(rec.temps_min || 25)} min</span>
            <span class="tonight-time">
              <svg viewBox="0 0 24 24" style="width:12px;height:12px"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>
              ${esc(rec.difficulte || 'facile')}
            </span>
          </div>
          <h1 class="tonight-title">${esc(rec.nom)}</h1>
          <div class="tonight-tags">${(rec.tags || []).slice(0, 3).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>
          <div class="tonight-kcal">
            <span class="kcal-big">${kcalOf(rec)}<small>kcal</small></span>
            <span class="kcal-side"><b>${protOf(rec)} g</b> de protéines<br>dans ta portion</span>
          </div>
          <div class="tonight-cta">
            <button class="btn-main" data-open="${esc(rec.id)}">
              Voir la recette
              <svg viewBox="0 0 24 24"><path d="M5 12h13M13 6l6 6-6 6"/></svg>
            </button>
          </div>
        </div>
      </section>

      <section class="week-strip">
        <div class="strip-head">
          <h2>La semaine</h2>
          <span>7 dîners · ${R.length} au total</span>
        </div>
        <div class="weeks">
          ${[0, 1, 2, 3].map((w) => `<button class="wk ${state.week === w ? 'is-on' : ''}" data-week="${w}">S${w + 1}</button>`).join('')}
        </div>
        <div class="days">
          ${day.map((r, i) => `
            <button class="day ${i === state.day ? 'is-today' : ''}" data-day="${i}">
              <span class="day-name">${JOURS_COURT[i]}</span>
              <span class="day-kcal">${kcalOf(r)}</span>
            </button>`).join('')}
        </div>
        <div class="list">
          ${others.map((r) => {
            const idx = day.indexOf(r);
            return `
            <button class="row" data-day="${idx}" data-open="${esc(r.id)}">
              ${r.photo ? `<img class="row-thumb" src="img/${esc(r.photo)}" alt="" loading="lazy">` : plateArt(r, 'thumb')}
              <span class="row-main">
                <span class="row-title">${esc(r.nom)}</span>
                <span class="row-sub">${esc(JOURS[idx])} · ${esc(r.temps_min)} min · ${(r.tags || []).slice(0, 2).join(' · ')}</span>
              </span>
              <span class="row-kcal"><b>${kcalOf(r)}</b><span>kcal</span></span>
            </button>`;
          }).join('')}
        </div>
      </section>`;
  }

  /* ---------------------------------------------------------------- week */
  function viewWeek() {
    const filters = ['tous', 'rapide', 'four', 'poisson', 'végé'];
    const list = R.filter((r) => {
      if (state.filter === 'tous') return true;
      if (state.filter === 'rapide') return r.temps_min <= 20;
      if (state.filter === 'four') return (r.tags || []).includes('four');
      if (state.filter === 'poisson') return (r.tags || []).some((t) => /poisson|saumon|cabillaud|crevette|thon/.test(t));
      if (state.filter === 'végé') return (r.tags || []).some((t) => /végé|végétarien|tofu|pois chiche|lentille/.test(t));
      return true;
    });
    return `
      <p class="eyebrow">Les 4 semaines</p>
      <h1 class="h1">Tout le carnet</h1>
      <p class="lede">${R.length} dîners, mêmes plats pour vous deux, portions ajustées.</p>
      <div class="pill-row">
        ${filters.map((f) => `<button class="pill ${state.filter === f ? 'is-on' : ''}" data-filter="${f}">${f}</button>`).join('')}
      </div>
      <div class="list">
        ${list.length ? list.map((r) => `
          <button class="row" data-open="${esc(r.id)}">
            ${r.photo ? `<img class="row-thumb" src="img/${esc(r.photo)}" alt="" loading="lazy">` : plateArt(r, 'thumb')}
            <span class="row-main">
              <span class="row-title">${esc(r.nom)}</span>
              <span class="row-sub">${esc(r.temps_min)} min · ${esc(r.difficulte)} · ${(r.tags || []).slice(0, 2).join(' · ')}</span>
            </span>
            <span class="row-kcal"><b>${kcalOf(r)}</b><span>kcal</span></span>
          </button>`).join('') : '<div class="empty">Rien avec ce filtre.</div>'}
      </div>`;
  }

  /* ---------------------------------------------------------------- shop */
  function viewShop() {
    const week = byDay();
    const map = new Map();
    week.forEach((r) => (r.ingredients || []).forEach((ing) => {
      const key = ing.nom.toLowerCase() + '|' + (ing.rayon || '');
      if (!map.has(key)) map.set(key, { nom: ing.nom, rayon: ing.rayon || 'Épicerie', parts: [] });
      const q = parseQte(qteOf(ing));
      if (q) map.get(key).parts.push(q);
    }));
    [...map.values()].forEach((v) => { v.qtes = [fmtQte(sumQte(v.parts))]; });
    const grouped = {};
    [...map.values()].forEach((v) => (grouped[v.rayon] = grouped[v.rayon] || []).push(v));
    const ordered = RAYONS.filter((r) => grouped[r]).concat(Object.keys(grouped).filter((r) => !RAYONS.includes(r)));
    const total = [...map.values()].length;
    const done = [...map.values()].filter((v) => state.checked.includes(v.nom)).length;

    return `
      <p class="eyebrow">Cette semaine</p>
      <h1 class="h1">La liste</h1>
      <p class="lede">Pour 7 dîners, deux personnes. Coche au fur et à mesure, ça reste en mémoire.</p>
      <div class="receipt">
        <div class="receipt-head">
          <h2>MIJOTÉ · SEMAINE</h2>
          <p>7 DÎNERS · 2 COUVERTS</p>
        </div>
        ${ordered.map((rayon) => `
          <div class="shop-rayon">
            <h3>${esc(rayon)}</h3>
            ${grouped[rayon].map((v) => `
              <div class="shop-line ${state.checked.includes(v.nom) ? 'is-check' : ''}" data-check="${esc(v.nom)}">
                <span>${esc(v.nom)}</span>
                <span>${esc(v.qtes.join(' + '))}</span>
              </div>`).join('')}
          </div>`).join('')}
        <div class="receipt-total"><span>${done}/${total} pris</span><span>MIJOTÉ</span></div>
      </div>`;
  }

  /* -------------------------------------------------------------- trends */
  function viewTrends() {
    return `
      <p class="eyebrow">Veille 2026</p>
      <h1 class="h1">Ce qui tourne</h1>
      <p class="lede">Les idées piquées sur TikTok, Instagram et les forums food — retaillées pour deux budgets serrés.</p>
      ${TRENDS.slice(0, 12).map((t) => `
        <div class="trend">
          <div class="trend-top">
            <span class="trend-name">${esc(t.nom || t.name || '')}</span>
            <span class="trend-src">${esc(t.origine || t.source || '')}</span>
          </div>
          <p class="trend-desc">${esc(t.pourquoi || t.description || '')}</p>
          ${t.kcal ? `<div class="trend-stats"><span>${esc(t.kcal)} kcal</span>${t.prot ? `<span>${esc(t.prot)} g prot.</span>` : ''}</div>` : ''}
        </div>`).join('')}
      ${TECH.length ? `
        <h2 class="h2" style="margin-top:26px">Les 8 gestes</h2>
        ${TECH.map((t) => `<div class="trend"><div class="trend-top"><span class="trend-name">${esc(t.nom || t.name || '')}</span></div><p class="trend-desc">${esc(t.detail || t.explication || t.description || '')}</p></div>`).join('')}` : ''}
      <p class="credits">Les liens TikTok ouvrent une recherche sur le nom du plat : ce ne sont pas des vidéos d'origine, juste des versions filmées de la même idée.</p>`;
  }

  /* --------------------------------------------------------------- sheet */
  function openRecipe(id) {
    const r = R.find((x) => x.id === id);
    if (!r) return;
    $('#sheet-kicker').textContent = `${JOURS[R.indexOf(r)] || ''} · ${r.temps_min} min`;
    const fav = state.favs.includes(id);
    $('#sheet-fav').setAttribute('aria-pressed', String(fav));
    $('#sheet-body').innerHTML = `
      ${r.photo ? `<div class="sheet-hero" style="background-image:url('img/${esc(r.photo)}')"></div>` : plateArt(r, 'sheet')}
      <h1 class="recipe-title">${esc(r.nom)}</h1>
      <div class="recipe-meta">
        <span>${esc(r.difficulte)}</span>
        <span>${r.temps_min <= 20 ? 'express' : r.temps_min >= 40 ? 'week-end' : 'semaine'}</span>
        <span>${esc(r.portions?.elle?.kcal)} / ${esc(r.portions?.lui?.kcal)} kcal</span>
      </div>
      ${r.technique ? `<div class="tech-line"><b>Le geste</b>${esc(r.technique)}</div>` : ''}
      <div class="portion-block">
        <h3>La portion</h3>
        <div class="portion-cols">
          <div class="portion-col ${state.profile === 'elle' ? 'is-active' : ''}" data-profile="elle">
            <div class="pc-name">Elle</div>
            <div class="pc-kcal">${esc(r.portions?.elle?.kcal)} kcal</div>
            <div class="pc-prot">${esc(r.portions?.elle?.prot)} g prot.</div>
          </div>
          <div class="portion-col ${state.profile === 'lui' ? 'is-active' : ''}" data-profile="lui">
            <div class="pc-name">Lui</div>
            <div class="pc-kcal">${esc(r.portions?.lui?.kcal)} kcal</div>
            <div class="pc-prot">${esc(r.portions?.lui?.prot)} g prot.</div>
          </div>
        </div>
      </div>
      <h2 class="h2" style="margin-top:22px">Les ingrédients</h2>
      <ul class="ings">
        ${(r.ingredients || []).map((i) => `<li class="ing"><span>${esc(i.nom)}</span><b>${esc(qteOf(i))}</b></li>`).join('')}
      </ul>
      <h2 class="h2" style="margin-top:22px">On cuisine</h2>
      <ol class="steps">${(r.etapes || []).map((e) => `<li>${esc(e)}</li>`).join('')}</ol>
      ${r.inspiration ? `<p class="inspiration"><b>Inspiration virale</b>${esc(r.inspiration)}</p>` : ''}
      <a class="tiktok-btn" href="${esc(r.tiktok)}" target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4v9.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M14 4c.4 2.6 2 4.2 4.6 4.6"/></svg>
        Voir des versions sur TikTok
      </a>`;
    sheet.hidden = false;
    scrim.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeSheet() {
    sheet.hidden = true;
    scrim.hidden = true;
    document.body.style.overflow = '';
  }

  /* -------------------------------------------------------------- render */
  const views = { today: viewToday, week: viewWeek, shop: viewShop, trends: viewTrends };

  function countUp(el, to, suffix) {
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t0 = performance.now(), dur = 520;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(to * e) + suffix;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function render() {
    screen.innerHTML = views[state.tab]();
    const big = screen.querySelector('.kcal-big');
    if (big) { const v = parseInt(big.textContent, 10) || 0; big.textContent = '0'; countUp(big, v, ''); }
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('is-on', t.dataset.go === state.tab));
    document.querySelectorAll('.pbtn').forEach((b) => {
      const on = b.dataset.profile === state.profile;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    $('.profile-switch').dataset.active = state.profile;
  }

  /* ---------------------------------------------------------------- events */
  document.addEventListener('click', (e) => {
    const go = e.target.closest('[data-go]');
    if (go) { state.tab = go.dataset.go; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }

    const prof = e.target.closest('[data-profile]');
    if (prof) {
      state.profile = prof.dataset.profile;
      localStorage.setItem('mj-profile', state.profile);
      if (!sheet.hidden) { const id = sheet.dataset.id; closeSheet(); setTimeout(() => openRecipe(id), 30); }
      render();
      return;
    }

    const open = e.target.closest('[data-open]');
    if (open) {
      const day = e.target.closest('[data-day]');
      if (day) state.day = Number(day.dataset.day);
      sheet.dataset.id = open.dataset.open;
      openRecipe(open.dataset.open);
      return;
    }

    const day = e.target.closest('[data-day]');
    if (day) { state.day = Number(day.dataset.day); render(); return; }

    const wk = e.target.closest('[data-week]');
    if (wk) { state.week = Number(wk.dataset.week); localStorage.setItem('mj-week', state.week); render(); return; }

    const filt = e.target.closest('[data-filter]');
    if (filt) { state.filter = filt.dataset.filter; render(); return; }

    const chk = e.target.closest('[data-check]');
    if (chk) {
      const n = chk.dataset.check;
      state.checked = state.checked.includes(n) ? state.checked.filter((x) => x !== n) : [...state.checked, n];
      saveChecked(); render();
      return;
    }
  });

  $('#sheet-close').addEventListener('click', closeSheet);
  scrim.addEventListener('click', closeSheet);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

  $('#sheet-fav').addEventListener('click', () => {
    const id = sheet.dataset.id;
    state.favs = state.favs.includes(id) ? state.favs.filter((x) => x !== id) : [...state.favs, id];
    saveFavs();
    $('#sheet-fav').setAttribute('aria-pressed', String(state.favs.includes(id)));
  });

  function fromHash() {
    const h = location.hash.replace(/^#/, '');
    if (h.startsWith('r=')) { const id = decodeURIComponent(h.slice(2)); sheet.dataset.id = id; openRecipe(id); return; }
    if (h.startsWith('tab=')) { state.tab = h.slice(4); render(); return; }
    render();
  }
  fromHash();
  window.addEventListener('hashchange', () => { closeSheet(); fromHash(); });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
