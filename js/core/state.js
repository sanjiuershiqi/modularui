/* ==========================================================================
   state.js — reactivity (signal / computed / effect / reactive) + stores
   ========================================================================== */
(function (MUI) {
  'use strict';
  var util = MUI.util;

  /* ---- scheduler ---- */
  var queue = new Set();
  var scheduled = false;
  var flushing = false;
  var depth = 0;

  function schedule(job) {
    queue.add(job);
    if (scheduled || flushing || depth > 0) return;
    scheduled = true;
    Promise.resolve().then(function () { scheduled = false; flush(); });
  }
  function flush() {
    if (flushing) return;
    flushing = true;
    var jobs = Array.from(queue); queue.clear();
    for (var i = 0; i < jobs.length; i++) { try { jobs[i](); } catch (e) { console.error('[state]', e); } }
    flushing = false;
    if (queue.size) schedule(function () {});
  }
  function batch(fn) { depth++; try { return fn(); } finally { depth--; if (depth === 0 && queue.size) schedule(function () {}); } }

  /* ---- signal ---- */
  function signal(initial) {
    var value = initial;
    var subs = new Set();
    var self = {
      get value() { return value; },
      get: function () { return value; },
      peek: function () { return value; },
      set: function (next) {
        var v = typeof next === 'function' ? next(value) : next;
        if (Object.is(v, value)) return value;
        value = v;
        subs.forEach(function (fn) { schedule(function () { try { fn(value); } catch (e) { console.error('[signal]', e); } }); });
        return value;
      },
      update: function (fn) { return self.set(fn); },
      subscribe: function (fn, immediate) {
        subs.add(fn);
        if (immediate) fn(value);
        return function () { subs.delete(fn); };
      },
      unsubscribe: function (fn) { subs.delete(fn); }
    };
    return self;
  }

  /* ---- reactive graph ---- */
  var targetMap = new WeakMap();
  var activeEffect = null;

  function track(target, key) {
    if (!activeEffect) return;
    var deps = targetMap.get(target);
    if (!deps) { deps = new Map(); targetMap.set(target, deps); }
    var dep = deps.get(key);
    if (!dep) { dep = new Set(); deps.set(key, dep); }
    dep.add(activeEffect);
    activeEffect.deps.push(dep);
  }
  function trigger(target, key) {
    var deps = targetMap.get(target); if (!deps) return;
    var dep = deps.get(key); if (!dep) return;
    dep.forEach(function (job) { schedule(function () { if (job.active) job.run(); }); });
  }
  function reactive(obj) {
    var seen = new WeakMap();
    function wrap(o) {
      if (typeof o !== 'object' || o === null) return o;
      if (seen.has(o)) return seen.get(o);
      var proxy = new Proxy(o, {
        get: function (t, k, recv) {
          var v = Reflect.get(t, k, recv);
          if (k === '__raw') return t;
          if (typeof v === 'object' && v !== null && !(v instanceof Node)) return wrap(v);
          track(t, k);
          return v;
        },
        set: function (t, k, v) {
          var old = t[k], ok = Reflect.set(t, k, v);
          if (ok && !Object.is(old, v)) trigger(t, k);
          return ok;
        },
        deleteProperty: function (t, k) { delete t[k]; trigger(t, k); return true; }
      });
      seen.set(o, proxy);
      return proxy;
    }
    return wrap(obj);
  }
  function effect(fn) {
    var job = {
      active: true, deps: [],
      run: function () {
        job.deps.forEach(function (dep) { dep.delete(job); }); job.deps = [];
        activeEffect = job;
        try { fn(); } finally { activeEffect = null; }
      }
    };
    job.run();
    return function stop() { job.active = false; job.deps.forEach(function (dep) { dep.delete(job); }); job.deps = []; };
  }
  function computed(fn) {
    var s = signal(undefined);
    effect(function () { s.set(fn()); });
    return { get: function () { return s.get(); }, get value() { return s.get(); }, subscribe: s.subscribe, peek: s.peek };
  }
  function watch(source, fn) {
    if (Array.isArray(source)) {
      return effect(function () {
        var vals = source.map(function (s) { return typeof s === 'function' ? s() : s.get(); });
        fn(vals);
      });
    }
    return effect(function () {
      var v = typeof source === 'function' ? source() : source.get();
      fn(v);
    });
  }
  function derive(obj) { return reactive(obj); }

  /* ---- namespaced persistent store with migrations ---- */
  var SCHEMA_VERSION = 1;
  function createStore(ns, options) {
    options = options || {};
    var KEY = 'mui:' + ns;
    var version = options.version || SCHEMA_VERSION;
    var data = {};
    var meta = { version: version };
    try {
      var raw = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (raw && typeof raw === 'object' && raw.__data) {
        data = raw.__data; meta.version = raw.__version || version;
      } else if (raw && typeof raw === 'object') {
        data = raw; /* legacy plain object */
      }
    } catch (e) { data = {}; }

    if (meta.version !== version && typeof options.migrate === 'function') {
      try { data = options.migrate(data, meta.version, version) || data; } catch (e) { console.error('[store:' + ns + '] migrate', e); }
      meta.version = version;
    }

    var api = {
      ns: ns,
      version: version,
      get: function (k, dflt) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : dflt; },
      set: function (k, v) { data[k] = v; flush(); MUI.bus.emit('store:set', ns, k, v); return v; },
      update: function (k, fn) { return api.set(k, fn(api.get(k))); },
      remove: function (k) { delete data[k]; flush(); MUI.bus.emit('store:set', ns, k, undefined); },
      all: function () { return Object.assign({}, data); },
      keys: function () { return Object.keys(data); },
      clear: function () { data = {}; flush(); MUI.bus.emit('store:changed', ns); },
      watch: function (cb) {
        return MUI.bus.on('store:set', function (n, k, v) { if (n === ns) cb(k, v); });
      },
      snapshot: function () { return { __data: data, __version: version }; }
    };
    function flush() {
      try { localStorage.setItem(KEY, JSON.stringify(api.snapshot())); } catch (e) { /* quota/private mode */ }
    }
    return api;
  }

  MUI.state = { signal: signal, reactive: reactive, effect: effect, computed: computed, watch: watch, derive: derive, batch: batch, flush: flush };
  MUI.signal = signal;
  MUI.computed = computed;
  MUI.effect = effect;
  MUI.reactive = reactive;
  MUI.batch = batch;
  MUI.watch = watch;
  MUI.createStore = createStore;
  MUI.store = createStore('core', {
    version: 2,
    migrate: function (data, from, to) {
      /* v1 → v2: normalize theme key */
      if (from < 2) { data.themeMode = data.themeMode || data.theme || 'system'; delete data.theme; }
      return data;
    }
  });
})(window.MUI = window.MUI || {});
