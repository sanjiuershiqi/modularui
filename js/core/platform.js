/* ==========================================================================
   platform.js — theme engine, i18n, http client, hotkeys, command registry
   ========================================================================== */
(function (MUI) {
  'use strict';
  var util = MUI.util;
  var root = document.documentElement;

  /* ======================================================================
     Theme engine
     ====================================================================== */
  var FS_BASE = { '--fs-2xs': 10.5, '--fs-xs': 11.5, '--fs-sm': 12.5, '--fs-md': 13.5, '--fs-base': 14.5, '--fs-lg': 16, '--fs-xl': 19, '--fs-2xl': 24, '--fs-3xl': 32, '--fs-4xl': 44 };
  var RADIUS = {
    sharp: { xs: 0, sm: 1, md: 2, lg: 3, xl: 4 },
    soft: { xs: 3, sm: 4, md: 6, lg: 8, xl: 11 },
    round: { xs: 8, sm: 12, md: 16, lg: 22, xl: 28 }
  };
  var PALETTES = [
    { name: '靛蓝', a1: '#5b4df0', a2: '#12b5a5' },
    { name: '品红', a1: '#e0559a', a2: '#7c5cff' },
    { name: '绯红', a1: '#d93a3f', a2: '#e8a03a' },
    { name: '橙焰', a1: '#d15f4d', a2: '#f0b429' },
    { name: '鎏金', a1: '#bd881e', a2: '#8b6f2e' },
    { name: '森绿', a1: '#3f7d3a', a2: '#a6bf80' },
    { name: '青碧', a1: '#0e8a8a', a2: '#79baba' },
    { name: '海蓝', a1: '#3b6fd4', a2: '#8bb8ff' },
    { name: '紫罗兰', a1: '#8451a6', a2: '#b78ac2' },
    { name: '石墨', a1: '#5b6472', a2: '#9aa3b2' },
    { name: '霓虹', a1: '#e6478e', a2: '#65bd42' },
    { name: '赛博', a1: '#7b2ff7', a2: '#00d4ff' }
  ];
  var systemMedia = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
  var state = {
    mode: MUI.store.get('themeMode', 'system'),
    accent: MUI.store.get('accent', '#5b4df0'),
    accent2: MUI.store.get('accent2', '#12b5a5'),
    palette: MUI.store.get('palette', '靛蓝'),
    density: MUI.store.get('density', 'cozy'),
    radius: MUI.store.get('radiusStyle', 'soft'),
    fontScale: MUI.store.get('fontScale', 1),
    motion: MUI.store.get('motion', 'smooth'),
    contrast: MUI.store.get('contrast', false)
  };

  function resolvedMode() {
    if (state.mode === 'system') return systemMedia && systemMedia.matches ? 'dark' : 'light';
    return state.mode;
  }
  function applyMode() {
    var m = resolvedMode();
    root.dataset.theme = m;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = m === 'dark' ? '#0b0d12' : (m === 'sepia' ? '#e6dfd1' : '#f4f5f9');
    applyAccent();
    MUI.bus.emit('theme:mode', m);
  }
  function applyAccent() {
    var dark = resolvedMode() === 'dark';
    var ramp = util.accentRamp(state.accent, dark);
    for (var k in ramp) root.style.setProperty('--accent-' + k, ramp[k]);
    root.style.setProperty('--accent', ramp[500]);
    root.style.setProperty('--on-accent', util.contrastOn(ramp[500]));
    var ramp2 = util.accentRamp(state.accent2, dark);
    root.style.setProperty('--accent-2', ramp2[500]);
    root.style.setProperty('--accent-2-soft', util.rgba(ramp2[500], .16));
    root.style.setProperty('--ring', util.rgba(ramp[500], 0.32));
    MUI.bus.emit('theme:accent', state.accent, state.accent2);
  }
  function applyDensity() { root.dataset.density = state.density; }
  function applyRadius() {
    var r = RADIUS[state.radius] || RADIUS.soft;
    root.style.setProperty('--r-xs', r.xs + 'px');
    root.style.setProperty('--r-sm', r.sm + 'px');
    root.style.setProperty('--r-md', r.md + 'px');
    root.style.setProperty('--r-lg', r.lg + 'px');
    root.style.setProperty('--r-xl', r.xl + 'px');
  }
  function applyFontScale() {
    for (var k in FS_BASE) root.style.setProperty(k, (FS_BASE[k] * state.fontScale).toFixed(2) + 'px');
  }
  function applyMotion() { root.dataset.motion = state.motion; }
  function applyContrast() { root.dataset.contrast = state.contrast ? 'on' : 'off'; }
  if (systemMedia) {
    var onSys = function () { if (state.mode === 'system') applyMode(); };
    if (systemMedia.addEventListener) systemMedia.addEventListener('change', onSys);
    else if (systemMedia.addListener) systemMedia.addListener(onSys);
  }

  var theme = {
    init: function () { applyMode(); applyDensity(); applyRadius(); applyFontScale(); applyMotion(); applyContrast(); },
    mode: function () { return state.mode; },
    resolved: resolvedMode,
    setMode: function (m) { state.mode = m; MUI.store.set('themeMode', m); applyMode(); },
    toggle: function () { theme.setMode(resolvedMode() === 'dark' ? 'light' : 'dark'); },
    accent: function () { return state.accent; },
    accent2: function () { return state.accent2; },
    setAccent: function (hex, hex2) { state.accent = hex; MUI.store.set('accent', hex); if (hex2) { state.accent2 = hex2; MUI.store.set('accent2', hex2); } applyAccent(); },
    palette: function () { return state.palette; },
    setPalette: function (name) {
      var p = PALETTES.filter(function (x) { return x.name === name; })[0];
      if (!p) return;
      state.palette = p.name; state.accent = p.a1; state.accent2 = p.a2;
      MUI.store.set('palette', p.name); MUI.store.set('accent', p.a1); MUI.store.set('accent2', p.a2);
      applyAccent();
    },
    palettes: PALETTES,
    density: function () { return state.density; },
    setDensity: function (d) { state.density = d; MUI.store.set('density', d); applyDensity(); },
    radiusStyle: function () { return state.radius; },
    setRadiusStyle: function (r) { state.radius = r; MUI.store.set('radiusStyle', r); applyRadius(); },
    fontScale: function () { return state.fontScale; },
    setFontScale: function (n) { state.fontScale = n; MUI.store.set('fontScale', n); applyFontScale(); },
    motion: function () { return state.motion; },
    setMotion: function (m) { state.motion = m; MUI.store.set('motion', m); applyMotion(); },
    contrast: function () { return state.contrast; },
    setContrast: function (b) { state.contrast = !!b; MUI.store.set('contrast', state.contrast); applyContrast(); },
    setVar: function (k, v) { root.style.setProperty(k.indexOf('--') === 0 ? k : '--' + k, v); },
    getVar: function (k) { return getComputedStyle(root).getPropertyValue(k.indexOf('--') === 0 ? k : '--' + k).trim(); },
    tokens: function () {
      var out = {};
      ['--bg', '--surface', '--text', '--text-2', '--border', '--accent', '--r-md'].forEach(function (k) { out[k] = theme.getVar(k); });
      return out;
    },
    presets: [
      { name: '靛蓝', value: '#5b4df0' }, { name: '紫罗兰', value: '#8b5cf6' },
      { name: '海蓝', value: '#2f7df6' }, { name: '青绿', value: '#0ea5a5' },
      { name: '森绿', value: '#129a6a' }, { name: '琥珀', value: '#c07a00' },
      { name: '玫瑰', value: '#d93a3f' }, { name: '石墨', value: '#5b6472' }
    ]
  };
  MUI.theme = theme;

  /* ======================================================================
     i18n
     ====================================================================== */
  var i18n = {
    _locale: MUI.store.get('locale', 'zh-CN'),
    _dict: Object.create(null),
    register: function (locale, map) {
      this._dict[locale] = Object.assign(this._dict[locale] || {}, map);
      MUI.bus.emit('i18n:changed', this._locale);
      return this;
    },
    locale: function () { return this._locale; },
    setLocale: function (l) { this._locale = l; MUI.store.set('locale', l); MUI.bus.emit('i18n:changed', l); },
    t: function (key, vars) {
      var d = this._dict[this._locale] || {};
      var s = Object.prototype.hasOwnProperty.call(d, key) ? d[key] : (this._dict['en'] && this._dict['en'][key] != null ? this._dict['en'][key] : key);
      if (vars) s = String(s).replace(/\{(\w+)\}/g, function (_, k) { return vars[k] != null ? vars[k] : '{' + k + '}'; });
      return s;
    },
    plural: function (key, count, vars) {
      var base = this.t(key, Object.assign({ count: count }, vars || {}));
      return count === 1 ? base : this.t(key + '_plural', Object.assign({ count: count }, vars || {})) === key + '_plural' ? base : this.t(key + '_plural', Object.assign({ count: count }, vars || {}));
    },
    number: function (n, opts) { return util.formatNumber(n, opts); },
    date: function (d, fmt) { return util.formatDate(d, fmt); },
    onChange: function (cb) { return MUI.bus.on('i18n:changed', cb); }
  };
  MUI.i18n = i18n;
  i18n.register('zh-CN', { 'app.name': 'ModularUI', 'common.confirm': '确定', 'common.cancel': '取消' });
  i18n.register('en', { 'app.name': 'ModularUI', 'common.confirm': 'Confirm', 'common.cancel': 'Cancel' });

  /* ======================================================================
     HTTP client
     ====================================================================== */
  var http = {
    defaults: { timeout: 15000, retries: 0, retryDelay: 400, headers: {} },
    interceptors: { request: [], response: [] },
    use: function (kind, fn) { this.interceptors[kind].push(fn); return this; },
    request: async function (url, options) {
      options = Object.assign({ method: 'GET' }, this.defaults, options || {});
      var cfg = { url: url, method: (options.method || 'GET').toUpperCase(), headers: Object.assign({}, this.defaults.headers, options.headers), body: options.body, raw: options };
      for (var i = 0; i < this.interceptors.request.length; i++) cfg = (await this.interceptors.request[i](cfg)) || cfg;

      var attempt = 0, retries = cfg.raw.retries != null ? cfg.raw.retries : this.defaults.retries;
      while (true) {
        var controller = new AbortController();
        var timer = setTimeout(function () { controller.abort(); }, cfg.raw.timeout || this.defaults.timeout);
        var res, err;
        try {
          res = await fetch(cfg.url, {
            method: cfg.method, headers: cfg.headers,
            body: cfg.body != null && cfg.method !== 'GET' ? (typeof cfg.body === 'string' ? cfg.body : JSON.stringify(cfg.body)) : undefined,
            signal: controller.signal
          });
        } catch (e) { err = e; }
        clearTimeout(timer);

        if (err) {
          if (attempt < retries) { attempt++; await util.wait((cfg.raw.retryDelay || this.defaults.retryDelay) * attempt); continue; }
          throw err;
        }
        if (!res.ok && res.status >= 500 && attempt < retries) { attempt++; await util.wait((cfg.raw.retryDelay || this.defaults.retryDelay) * attempt); continue; }

        var result = { status: res.status, ok: res.ok, headers: res.headers, data: null, response: res };
        var ct = res.headers.get('content-type') || '';
        try { result.data = ct.indexOf('application/json') > -1 ? await res.json() : await res.text(); } catch (e) { result.data = null; }
        for (var j = 0; j < this.interceptors.response.length; j++) result = (await this.interceptors.response[j](result, cfg)) || result;
        if (!res.ok) {
          var httpErr = new Error('HTTP ' + res.status + ' ' + cfg.method + ' ' + cfg.url);
          httpErr.status = res.status; httpErr.data = result.data; httpErr.response = res;
          throw httpErr;
        }
        return result.data;
      }
    }
  };
  ['get', 'post', 'put', 'patch', 'delete'].forEach(function (m) {
    http[m] = function (url, data, opt) {
      return http.request(url, Object.assign({ method: m.toUpperCase(), body: data }, opt || {}));
    };
  });
  MUI.http = http;

  /* ======================================================================
     Hotkeys (scoped)
     ====================================================================== */
  var bindings = [];
  var scopeStack = ['global'];
  function normalize(combo) {
    return String(combo).toLowerCase().replace(/\s+/g, '').split('+')
      .map(function (s) { return s === 'mod' ? (util.isMac ? 'meta' : 'ctrl') : (s === 'cmd' ? 'meta' : (s === 'ctrl' ? 'ctrl' : s)); })
      .sort().join('+');
  }
  function eventCombo(e) {
    var parts = [];
    if (e.ctrlKey) parts.push('ctrl');
    if (e.metaKey) parts.push('meta');
    if (e.shiftKey) parts.push('shift');
    if (e.altKey) parts.push('alt');
    var k = (e.key || '').toLowerCase();
    if (k === ' ') k = 'space';
    if (k === 'esc') k = 'escape';
    if (k === 'arrowup') k = 'up';
    if (k === 'arrowdown') k = 'down';
    if (parts.indexOf('shift') === -1 && k.length === 1) k = k.toLowerCase();
    return parts.sort().join('+') + (k ? (parts.length ? '+' : '') + k : '');
  }
  function comboHasModifier(c) { return /ctrl|meta|alt/.test(c); }

  document.addEventListener('keydown', function (e) {
    var combo = eventCombo(e);
    for (var i = bindings.length - 1; i >= 0; i--) {
      var b = bindings[i];
      if (b.combo !== combo) continue;
      if (b.scope && scopeStack.indexOf(b.scope) === -1) continue;
      if (b.when && !b.when()) continue;
      var t = e.target;
      var typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if (typing && !comboHasModifier(combo)) continue;
      if (b.preventDefault !== false) e.preventDefault();
      try { b.fn(e); } catch (err) { console.error('[hotkey:' + combo + ']', err); }
      return;
    }
  });

  var keys = {
    register: function (combo, fn, opt) {
      opt = opt || {};
      var entry = { combo: normalize(combo), fn: fn, scope: opt.scope, when: opt.when, preventDefault: opt.preventDefault, owner: opt.owner };
      bindings.push(entry);
      return function () { var i = bindings.indexOf(entry); if (i > -1) bindings.splice(i, 1); };
    },
    scope: function (name) {
      scopeStack.push(name);
      return function () { var i = scopeStack.lastIndexOf(name); if (i > -1) scopeStack.splice(i, 1); };
    },
    activeScopes: function () { return scopeStack.slice(); },
    list: function () { return bindings.slice(); },
    format: function (combo) {
      var ORDER = { ctrl: 0, meta: 1, alt: 2, shift: 3 };
      var parts = normalize(combo).split('+').sort(function (a, b) {
        var ao = ORDER[a] != null ? ORDER[a] : 9, bo = ORDER[b] != null ? ORDER[b] : 9;
        return ao - bo;
      });
      return parts.map(function (p) {
        return p === 'meta' ? (util.isMac ? '⌘' : 'Win') : p === 'ctrl' ? 'Ctrl' : p === 'alt' ? (util.isMac ? '⌥' : 'Alt')
          : p === 'shift' ? (util.isMac ? '⇧' : 'Shift') : p === 'up' ? '↑' : p === 'down' ? '↓'
          : p === 'escape' ? 'Esc' : p.length === 1 ? p.toUpperCase() : p.charAt(0).toUpperCase() + p.slice(1);
      }).join(util.isMac ? '' : '+');
    },
    removeByOwner: function (owner) { for (var i = bindings.length - 1; i >= 0; i--) if (bindings[i].owner === owner) bindings.splice(i, 1); }
  };
  MUI.keys = keys;

  /* ======================================================================
     Command registry
     ====================================================================== */
  var commands = new Map();
  var commandAPI = {
    register: function (cmd) {
      if (!cmd || !cmd.id) throw new Error('[commands] id required');
      var entry = Object.assign({ group: '通用', keywords: '' }, cmd);
      commands.set(entry.id, entry);
      MUI.bus.emit('commands:changed');
      return function () { commands.delete(entry.id); MUI.bus.emit('commands:changed'); };
    },
    get: function (id) { return commands.get(id); },
    unregister: function (id) { commands.delete(id); },
    list: function () { return Array.from(commands.values()); },
    enabled: function () { return Array.from(commands.values()).filter(function (c) { return !c.when || c.when(); }); },
    run: function (id) {
      var c = typeof id === 'string' ? commands.get(id) : id;
      if (!c) return false;
      if (c.when && !c.when()) return false;
      try { c.run(c); } catch (e) { console.error('[command:' + c.id + ']', e); }
      return true;
    },
    search: function (query) {
      var q = String(query || '').trim().toLowerCase();
      var all = commandAPI.enabled();
      if (!q) return all;
      var scored = [];
      all.forEach(function (c) {
        var hay = (c.title + ' ' + (c.subtitle || '') + ' ' + c.group + ' ' + c.keywords).toLowerCase();
        var s = 0;
        if (hay.indexOf(q) > -1) s = 100 - hay.indexOf(q);
        else {
          var i = 0, ok = true;
          for (var n = 0; n < q.length; n++) { i = hay.indexOf(q[n], i); if (i === -1) { ok = false; break; } i++; }
          if (ok) s = 10;
        }
        if (c.title.toLowerCase().indexOf(q) === 0) s += 50;
        if (s > 0) scored.push({ c: c, s: s });
      });
      return scored.sort(function (a, b) { return b.s - a.s; }).map(function (x) { return x.c; });
    },
    removeByOwner: function (owner) {
      commands.forEach(function (c, id) { if (c.owner === owner) commands.delete(id); });
    }
  };
  MUI.commands = commandAPI;

  /* ======================================================================
     Settings registry (consumed by the settings view)
     ====================================================================== */
  var settingItems = [];
  var settings = {
    register: function (owner, item) {
      if (!item || typeof item !== 'object') throw new Error('[settings] item must be an object');
      var entry = Object.assign({ id: util.uid('set'), owner: owner || null, order: 50 }, item);
      settingItems.push(entry);
      settingItems.sort(function (a, b) { return a.order - b.order; });
      MUI.bus.emit('settings:changed');
      return function remove() { var i = settingItems.indexOf(entry); if (i > -1) { settingItems.splice(i, 1); MUI.bus.emit('settings:changed'); } };
    },
    list: function () { return settingItems.slice(); },
    removeByOwner: function (owner) {
      for (var i = settingItems.length - 1; i >= 0; i--) if (settingItems[i].owner === owner) settingItems.splice(i, 1);
      MUI.bus.emit('settings:changed');
    }
  };
  MUI.settings = settings;

  /* ======================================================================
     Runtime log bus (captures module + kernel output for the in-app log)
     ====================================================================== */
  var LOG_MAX = 600;
  var logItems = [];
  var logSeq = 0;
  function pushLog(level, scope, args) {
    var text = (args || []).map(function (a) {
      if (typeof a === 'string') return a;
      if (a instanceof Error) return a.message;
      try { return JSON.stringify(a); } catch (e) { return String(a); }
    }).join(' ');
    logItems.push({ id: ++logSeq, t: Date.now(), level: level, scope: scope || null, text: text });
    if (logItems.length > LOG_MAX) logItems.splice(0, logItems.length - LOG_MAX);
    MUI.bus.emit('logs:changed');
  }
  MUI.logs = {
    push: pushLog,
    list: function () { return logItems.slice(); },
    count: function (level) { return level ? logItems.filter(function (l) { return l.level === level; }).length : logItems.length; },
    clear: function () { logItems.length = 0; MUI.bus.emit('logs:changed'); },
    on: function (cb) { return MUI.bus.on('logs:changed', cb); }
  };
  ['warn', 'error'].forEach(function (level) {
    var orig = console[level].bind(console);
    console[level] = function () {
      if (!console.__muiLogger) { try { pushLog(level, 'console', Array.prototype.slice.call(arguments)); } catch (e) {} }
      return orig.apply(console, arguments);
    };
  });
})(window.MUI = window.MUI || {});
