/* ==========================================================================
   util.js — utilities, color math, semver, event emitter, hooks
   ========================================================================== */
(function (MUI) {
  'use strict';

  var _seq = 0;
  var util = {
    uid: function (p) { return (p || 'u') + '-' + (++_seq).toString(36); },
    isNode: function (v) { return typeof Node !== 'undefined' && v instanceof Node; },
    isEl: function (v) { return v && v.nodeType === 1; },
    isFn: function (v) { return typeof v === 'function'; },
    isObj: function (v) { return v !== null && typeof v === 'object'; },
    isPlain: function (v) { return Object.prototype.toString.call(v) === '[object Object]'; },
    isMac: /Mac|iPhone|iPad|iPod/.test((navigator.platform || '') + (navigator.userAgent || '')),

    escapeHtml: function (s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    },
    clamp: function (v, a, b) { return Math.min(b, Math.max(a, v)); },
    sum: function (arr) { return (arr || []).reduce(function (a, b) { return a + (Number(b) || 0); }, 0); },
    avg: function (arr) { return arr && arr.length ? util.sum(arr) / arr.length : 0; },
    range: function (n, start) { return Array.from({ length: n }, function (_, i) { return (start || 0) + i; }); },
    sortBy: function (arr, fn, dir) {
      var d = dir === 'desc' ? -1 : 1;
      return (arr || []).slice().sort(function (a, b) {
        var av = fn(a), bv = fn(b);
        if (av < bv) return -1 * d;
        if (av > bv) return 1 * d;
        return 0;
      });
    },
    groupBy: function (arr, fn) {
      var out = Object.create(null);
      (arr || []).forEach(function (item, i) {
        var k = fn(item, i);
        (out[k] || (out[k] = [])).push(item);
      });
      return out;
    },
    uniq: function (arr) { return Array.from(new Set(arr || [])); },
    wait: function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); },
    raf: function (fn) { return requestAnimationFrame(fn); },

    debounce: function (fn, wait) {
      var t;
      var f = function () { var a = arguments, self = this; clearTimeout(t); t = setTimeout(function () { fn.apply(self, a); }, wait || 180); };
      f.cancel = function () { clearTimeout(t); };
      f.flush = function () { clearTimeout(t); fn(); };
      return f;
    },
    throttle: function (fn, wait) {
      var last = 0, t;
      return function () {
        var a = arguments, self = this, now = Date.now(), rem = (wait || 180) - (now - last);
        if (rem <= 0) { last = now; fn.apply(self, a); }
        else { clearTimeout(t); t = setTimeout(function () { last = Date.now(); fn.apply(self, a); }, rem); }
      };
    },

    async copy(text) {
      try { await navigator.clipboard.writeText(text); return true; }
      catch (e) {
        try {
          var ta = document.createElement('textarea');
          ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
          document.body.appendChild(ta); ta.select();
          var ok = document.execCommand('copy'); ta.remove(); return ok;
        } catch (e2) { return false; }
      }
    },

    formatDate: function (d, fmt) {
      d = d || new Date(); fmt = fmt || 'YYYY-MM-DD HH:mm';
      var p = function (n) { return String(n).padStart(2, '0'); };
      return fmt.replace('YYYY', d.getFullYear()).replace('MM', p(d.getMonth() + 1))
        .replace('DD', p(d.getDate())).replace('HH', p(d.getHours()))
        .replace('mm', p(d.getMinutes())).replace('ss', p(d.getSeconds()));
    },
    formatNumber: function (n, opts) {
      try { return new Intl.NumberFormat(undefined, opts || {}).format(n); }
      catch (e) { return String(n); }
    },
    formatCompact: function (n) {
      try { return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(n); }
      catch (e) { return String(n); }
    },
    fromNow: function (ts) {
      var s = Math.floor((Date.now() - ts) / 1000);
      if (s < 60) return '刚刚';
      var m = Math.floor(s / 60); if (m < 60) return m + ' 分钟前';
      var h = Math.floor(m / 60); if (h < 24) return h + ' 小时前';
      return Math.floor(h / 24) + ' 天前';
    },
    deepMerge: function (a, b) {
      var out = Object.assign({}, a || {});
      for (var k in b || {}) {
        if (util.isPlain(out[k]) && util.isPlain(b[k])) out[k] = util.deepMerge(out[k], b[k]);
        else out[k] = b[k];
      }
      return out;
    },
    getPath: function (obj, path, dflt) {
      var cur = obj, parts = String(path).split('.');
      for (var i = 0; i < parts.length; i++) {
        if (cur == null) return dflt;
        cur = cur[parts[i]];
      }
      return cur === undefined ? dflt : cur;
    },
    setPath: function (obj, path, value) {
      var parts = String(path).split('.'), cur = obj;
      for (var i = 0; i < parts.length - 1; i++) { if (!util.isObj(cur[parts[i]])) cur[parts[i]] = {}; cur = cur[parts[i]]; }
      cur[parts[parts.length - 1]] = value;
      return obj;
    },

    /* ---- color ---- */
    parseHex: function (hex) {
      var h = String(hex || '').trim().replace('#', '');
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      if (!/^[0-9a-fA-F]{6}$/.test(h)) return { r: 91, g: 77, b: 240 };
      var n = parseInt(h, 16);
      return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    },
    toHex: function (r, g, b) {
      var f = function (x) { return Math.round(util.clamp(x, 0, 255)).toString(16).padStart(2, '0'); };
      return '#' + f(r) + f(g) + f(b);
    },
    mix: function (hexA, hexB, t) {
      var a = util.parseHex(hexA), b = util.parseHex(hexB);
      return util.toHex(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t);
    },
    rgbToHsl: function (r, g, b) {
      r /= 255; g /= 255; b /= 255;
      var max = Math.max(r, g, b), min = Math.min(r, g, b);
      var h = 0, s = 0, l = (max + min) / 2;
      if (max !== min) {
        var d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h /= 6;
      }
      return { h: h * 360, s: s * 100, l: l * 100 };
    },
    hslToRgb: function (h, s, l) {
      h = ((h % 360) + 360) % 360 / 360; s = util.clamp(s, 0, 100) / 100; l = util.clamp(l, 0, 100) / 100;
      if (s === 0) { var v = Math.round(l * 255); return { r: v, g: v, b: v }; }
      var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      var p = 2 * l - q;
      var hue = function (t) {
        if (t < 0) t += 1; if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      return { r: Math.round(hue(h + 1 / 3) * 255), g: Math.round(hue(h) * 255), b: Math.round(hue(h - 1 / 3) * 255) };
    },
    lighten: function (hex, amt) {
      var c = util.parseHex(hex), hsl = util.rgbToHsl(c.r, c.g, c.b);
      var rgb = util.hslToRgb(hsl.h, hsl.s, util.clamp(hsl.l + amt, 0, 100));
      return util.toHex(rgb.r, rgb.g, rgb.b);
    },
    rgba: function (hex, a) { var c = util.parseHex(hex); return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')'; },
    accentRamp: function (hex, dark) {
      var stops = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
      var out = {};
      if (!dark) {
        var lv = { 50: 0.94, 100: 0.86, 200: 0.72, 300: 0.5, 400: 0.24, 500: 0, 600: -0.12, 700: -0.26, 800: -0.4, 900: -0.52 };
        stops.forEach(function (s) {
          out[s] = lv[s] >= 0 ? util.mix(hex, '#ffffff', lv[s]) : util.mix(hex, '#05060a', -lv[s]);
        });
      } else {
        var ld = { 50: -0.62, 100: -0.5, 200: -0.34, 300: -0.16, 400: -0.02, 500: 0.14, 600: 0.26, 700: 0.38, 800: 0.5, 900: 0.62 };
        stops.forEach(function (s) {
          out[s] = ld[s] >= 0 ? util.mix(hex, '#ffffff', ld[s]) : util.mix(hex, '#05060a', -ld[s]);
        });
      }
      return out;
    },
    contrastOn: function (hex) {
      var c = util.parseHex(hex);
      var lum = (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
      return lum > 0.62 ? '#101319' : '#ffffff';
    },
    debounceUntil: function () {}
  };
  MUI.util = util;

  /* ======================================================================
     semver
     ====================================================================== */
  function parse(v) {
    var m = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(String(v || '').trim());
    if (!m) return null;
    return { major: +m[1], minor: +(m[2] || 0), patch: +(m[3] || 0), pre: m[4] || '' };
  }
  function compare(a, b) {
    a = typeof a === 'string' ? parse(a) : a; b = typeof b === 'string' ? parse(b) : b;
    if (!a || !b) return 0;
    if (a.major !== b.major) return a.major - b.major;
    if (a.minor !== b.minor) return a.minor - b.minor;
    if (a.patch !== b.patch) return a.patch - b.patch;
    if (a.pre === b.pre) return 0;
    if (!a.pre) return 1;
    if (!b.pre) return -1;
    return a.pre < b.pre ? -1 : 1;
  }
  function cmpOp(op, v, target) {
    var c = compare(v, target);
    switch (op) {
      case '>': return c > 0; case '>=': return c >= 0;
      case '<': return c < 0; case '<=': return c <= 0;
      case '=': case '==': return c === 0;
      default: return c === 0;
    }
  }
  function satisfies(version, range) {
    var v = typeof version === 'string' ? parse(version) : version;
    if (!v) return false;
    range = String(range == null ? '*' : range).trim();
    if (!range || range === '*' || range === 'x' || range === 'latest') return true;
    return range.split('||').some(function (clause) {
      clause = clause.trim();
      if (!clause) return true;
      return clause.split(/\s+/).every(function (part) {
        if (!part || part === '*') return true;
        var m;
        if ((m = /^\^(.+)$/.exec(part))) {
          var b = parse(m[1]); if (!b) return false;
          if (compare(v, b) < 0) return false;
          if (b.major > 0) return v.major === b.major;
          if (b.minor > 0) return v.major === 0 && v.minor === b.minor;
          return v.major === 0 && v.minor === 0 && v.patch === b.patch;
        }
        if ((m = /^~(.+)$/.exec(part))) {
          var t = parse(m[1]); if (!t) return false;
          return compare(v, t) >= 0 && v.major === t.major && v.minor === t.minor;
        }
        if ((m = /^(>=|<=|>|<|=|==)\s*(.+)$/.exec(part))) return cmpOp(m[1], v, parse(m[2]) || { major: 0, minor: 0, patch: 0, pre: '' });
        if ((m = /^(\d+)(?:\.(\d+|x|\*))?(?:\.(\d+|x|\*))?$/.exec(part))) {
          if (m[2] == null || m[2] === 'x' || m[2] === '*') return v.major === +m[1];
          if (m[3] == null || m[3] === 'x' || m[3] === '*') return v.major === +m[1] && v.minor === +m[2];
          return v.major === +m[1] && v.minor === +m[2] && v.patch === +m[3];
        }
        return false;
      });
    });
  }
  MUI.semver = { parse: parse, compare: compare, satisfies: satisfies, valid: function (v) { return !!parse(v); } };

  /* ======================================================================
     EventEmitter
     ====================================================================== */
  function Emitter() { this._m = new Map(); this._any = new Set(); }
  Emitter.prototype.on = function (evt, fn, ctx) {
    if (!this._m.has(evt)) this._m.set(evt, new Set());
    var rec = { fn: fn, ctx: ctx };
    this._m.get(evt).add(rec);
    var self = this;
    return function () { var s = self._m.get(evt); if (s) s.delete(rec); };
  };
  Emitter.prototype.once = function (evt, fn, ctx) {
    var off = this.on(evt, function () { off(); fn.apply(ctx || null, arguments); }, ctx);
    return off;
  };
  Emitter.prototype.onAny = function (fn) {
    this._any.add(fn); var self = this;
    return function () { self._any.delete(fn); };
  };
  Emitter.prototype.off = function (evt, fn) {
    var s = this._m.get(evt); if (!s) return;
    if (!fn) { s.clear(); return; }
    s.forEach(function (rec) { if (rec.fn === fn) s.delete(rec); });
  };
  Emitter.prototype.emit = function (evt) {
    var args = Array.prototype.slice.call(arguments, 1);
    var s = this._m.get(evt);
    if (s) s.forEach(function (rec) {
      try { rec.fn.apply(rec.ctx || null, args); }
      catch (e) { console.error('[event:' + evt + ']', e); }
    });
    this._any.forEach(function (fn) {
      try { fn.apply(null, [evt].concat(args)); } catch (e) { console.error('[event:*]', e); }
    });
  };
  Emitter.prototype.listeners = function (evt) { var s = this._m.get(evt); return s ? s.size : 0; };
  MUI.Emitter = Emitter;
  MUI.bus = new Emitter();

  /* ======================================================================
     Hooks: filters (transform) + actions (side effects)
     ====================================================================== */
  function Hooks() { this.filters = new Map(); this.actions = new Map(); }
  Hooks.prototype._add = function (map, name, fn, priority, owner) {
    if (!map.has(name)) map.set(name, []);
    var entry = { fn: fn, priority: priority == null ? 10 : priority, owner: owner };
    var list = map.get(name);
    list.push(entry);
    list.sort(function (a, b) { return a.priority - b.priority; });
    return function () { var i = list.indexOf(entry); if (i > -1) list.splice(i, 1); };
  };
  Hooks.prototype.addFilter = function (name, fn, priority, owner) { return this._add(this.filters, name, fn, priority, owner); };
  Hooks.prototype.addAction = function (name, fn, priority, owner) { return this._add(this.actions, name, fn, priority, owner); };
  Hooks.prototype.applyFilters = function (name, value) {
    var list = this.filters.get(name); if (!list || !list.length) return value;
    var args = Array.prototype.slice.call(arguments, 1);
    for (var i = 0; i < list.length; i++) {
      try { var r = list[i].fn.apply(null, args); if (r !== undefined) value = r; }
      catch (e) { console.error('[filter:' + name + ']', e); }
    }
    return value;
  };
  Hooks.prototype.doAction = function (name) {
    var list = this.actions.get(name); if (!list) return;
    var args = Array.prototype.slice.call(arguments, 1);
    for (var i = 0; i < list.length; i++) {
      try { list[i].fn.apply(null, args); } catch (e) { console.error('[action:' + name + ']', e); }
    }
  };
  Hooks.prototype.has = function (name) { return (this.filters.get(name) || []).length + (this.actions.get(name) || []).length > 0; };
  Hooks.prototype.removeByOwner = function (owner) {
    [this.filters, this.actions].forEach(function (map) {
      map.forEach(function (list) {
        for (var i = list.length - 1; i >= 0; i--) if (list[i].owner === owner) list.splice(i, 1);
      });
    });
  };
  Hooks.prototype.list = function () {
    var out = [];
    this.filters.forEach(function (l, n) { out.push({ type: 'filter', name: n, count: l.length }); });
    this.actions.forEach(function (l, n) { out.push({ type: 'action', name: n, count: l.length }); });
    return out;
  };
  MUI.Hooks = Hooks;
  MUI.hooks = new Hooks();
})(window.MUI = window.MUI || {});
