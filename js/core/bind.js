/* ==========================================================================
   bind.js — reactive DOM bindings, scopes and DOM helpers
   MUI.scope · text · bind · list · persist · resource · observer · intersect · drag
   ========================================================================== */
(function (MUI) {
  'use strict';
  var util = MUI.util;

  /* ---------------------------------------------------------------- scope */
  function Scope(owner) { this.owner = owner || null; this.disposers = []; this.disposed = false; }
  Scope.prototype.add = function (fn) {
    if (typeof fn !== 'function') return fn;
    if (this.disposed) { try { fn(); } catch (e) {} return fn; }
    this.disposers.push(fn);
    return fn;
  };
  Scope.prototype.dispose = function () {
    this.disposed = true;
    while (this.disposers.length) {
      var fn = this.disposers.pop();
      try { fn(); } catch (e) { console.error('[scope]', e); }
    }
  };
  var scopeStack = [];
  function register(fn) { var s = scopeStack[scopeStack.length - 1]; if (s) s.add(fn); return fn; }
  function pushScope(s) { scopeStack.push(s); }
  function popScope() { scopeStack.pop(); }

  /** run fn inside a scope; returns a dispose function */
  function scope(fn) {
    var s = new Scope();
    pushScope(s);
    try { fn(s); } finally { popScope(); }
    return function () { s.dispose(); };
  }
  /** add a disposer to the current scope (if any) */
  function autoDispose(fn) { return register(fn); }

  /* ------------------------------------------------------ reactive nodes */
  function readSource(source) {
    if (typeof source === 'function') return source();
    if (source && typeof source.get === 'function') return source.get();
    return source;
  }
  function appendOut(host, out) {
    if (out == null || out === false || out === true) return;
    if (Array.isArray(out)) { out.forEach(function (o) { appendOut(host, o); }); return; }
    if (util.isNode(out)) { host.appendChild(out); return; }
    host.appendChild(document.createTextNode(String(out)));
  }

  /** a text node bound to a signal or getter */
  function text(source) {
    var node = document.createTextNode('');
    register(MUI.effect(function () {
      var v = readSource(source);
      node.data = v == null ? '' : String(v);
    }));
    return node;
  }

  /** a container that re-renders whenever signals read inside `render` change */
  function bind(render) {
    var host = MUI.h('div', { class: 'bind' });
    register(MUI.effect(function () {
      MUI.clear(host);
      appendOut(host, render());
    }));
    return host;
  }

  /** a reactive list: re-renders on source change */
  function list(source, renderItem) {
    var host = MUI.h('div', { class: 'bind-list' });
    register(MUI.effect(function () {
      MUI.clear(host);
      var items = readSource(source) || [];
      for (var i = 0; i < items.length; i++) appendOut(host, renderItem(items[i], i));
    }));
    return host;
  }

  /** bind a signal to a namespaced store key (two-way, persisted) */
  function persist(sig, key, ns) {
    var store = ns ? MUI.createStore(ns) : MUI.store;
    var saved = store.get(key);
    if (saved !== undefined) sig.set(saved);
    register(sig.subscribe(function (v) { store.set(key, v); }));
    return sig;
  }

  /** async resource with reactive loading/data/error and reload() */
  function resource(fetcher) {
    var data = MUI.signal(null), error = MUI.signal(null), loading = MUI.signal(true);
    var token = 0;
    function reload() {
      var my = ++token;
      loading.set(true); error.set(null);
      Promise.resolve().then(fetcher).then(function (d) {
        if (my !== token) return; data.set(d); loading.set(false);
      }, function (e) {
        if (my !== token) return; error.set(e); loading.set(false);
      });
      return api;
    }
    var api = { data: data, error: error, loading: loading, reload: reload, value: function () { return data.get(); } };
    register(function () { token++; });
    reload();
    return api;
  }

  /* --------------------------------------------------------- DOM helpers */
  function observer(el, cb) {
    if (!window.ResizeObserver) return function () {};
    var ro = new ResizeObserver(function (entries) {
      var r = el.getBoundingClientRect();
      cb({ width: r.width, height: r.height, el: el, entries: entries });
    });
    ro.observe(el);
    return register(function () { ro.disconnect(); });
  }
  function intersect(el, cb, opt) {
    if (!('IntersectionObserver' in window)) return function () {};
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { cb(e.isIntersecting, e); });
    }, opt || {});
    io.observe(el);
    return register(function () { io.disconnect(); });
  }
  function drag(el, handlers) {
    handlers = handlers || {};
    var start = null;
    function move(e) {
      if (!start) return;
      if (handlers.move) handlers.move({ dx: e.clientX - start.x, dy: e.clientY - start.y, x: e.clientX, y: e.clientY, event: e });
    }
    function up(e) {
      if (start && handlers.end) handlers.end({ x: e.clientX, y: e.clientY, event: e });
      start = null;
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
    }
    function down(e) {
      if (handlers.filter && !handlers.filter(e)) return;
      start = { x: e.clientX, y: e.clientY };
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
      if (handlers.start) handlers.start(e);
      if (handlers.preventDefault !== false) e.preventDefault();
    }
    el.addEventListener('pointerdown', down);
    return register(function () { el.removeEventListener('pointerdown', down); document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); });
  }

  MUI.Scope = Scope;
  MUI.scope = scope;
  MUI.autoDispose = autoDispose;
  MUI.scopeHelpers = { pushScope: pushScope, popScope: popScope, register: register };
  MUI.text = text;
  MUI.bind = bind;
  MUI.list = list;
  MUI.persist = persist;
  MUI.resource = resource;
  MUI.observer = observer;
  MUI.intersect = intersect;
  MUI.drag = drag;
})(window.MUI = window.MUI || {});
