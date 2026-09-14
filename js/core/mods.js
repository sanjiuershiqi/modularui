/* ==========================================================================
   mods.js — module kernel
   manifest · semver dependency graph · capability permissions · lifecycle
   scoped disposal · config schema · storage migrations · remote loading
   ========================================================================== */
(function (MUI) {
  'use strict';
  var util = MUI.util, semver = MUI.semver, h = MUI.h, icon = MUI.icon;

  var API_VERSION = '2.0.0';
  var DEFAULT_TIMEOUT = 6000;

  /* capability defaults: true = granted without asking, false = must declare */
  var CAP_DEFAULT = {
    'ui.slot': true, 'ui.view': true, 'ui.component': true, 'ui.style': true,
    'ui.theme': true, 'ui.overlay': true, 'ui.settings': true, 'ui.commands': true,
    'ui.hotkeys': true, 'ui.notifications': true,
    'events': true, 'hooks': true, 'storage': true, 'i18n': true,
    'http': false, 'timers': false, 'clipboard': false
  };
  var CAP_LABEL = {
    'ui.slot': '注入界面插槽', 'ui.view': '注册页面', 'ui.component': '注册/覆盖组件',
    'ui.style': '注入样式', 'ui.theme': '读写主题', 'ui.overlay': '弹窗与遮罩',
    'ui.settings': '注册设置项', 'ui.commands': '注册命令', 'ui.hotkeys': '注册快捷键',
    'ui.notifications': '系统通知', 'events': '事件总线', 'hooks': '钩子系统',
    'storage': '本地存储', 'i18n': '语言包', 'http': '网络请求', 'timers': '定时器',
    'clipboard': '剪贴板'
  };

  function PermissionError(cap, id) {
    var e = new Error('模块 "' + id + '" 未获得能力授权: ' + cap);
    e.name = 'PermissionError';
    e.capability = cap;
    e.moduleId = id;
    return e;
  }
  function isGranted(manifest, cap) {
    if (CAP_DEFAULT[cap] === true) return true;
    return (manifest.permissions || []).indexOf(cap) > -1;
  }

  /* ---------------------------------------------------------------- Scope */
  function Scope(owner) { this.owner = owner; this.disposers = []; this.disposed = false; }
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
      try { fn(); } catch (e) { console.error('[scope:' + this.owner + ']', e); }
    }
  };

  /* ---------------------------------------------------------------- config */
  function normalizeSchema(schema) {
    var out = {};
    for (var k in schema || {}) {
      var v = schema[k];
      out[k] = (util.isPlain(v) && ('default' in v || 'type' in v || 'label' in v))
        ? Object.assign({ type: 'string' }, v)
        : { type: typeof v === 'number' ? 'number' : typeof v === 'boolean' ? 'boolean' : 'string', default: v };
    }
    return out;
  }
  function coerce(def, v) {
    if (v == null) return def.default;
    switch (def.type) {
      case 'number': var n = Number(v); return isFinite(n) ? n : def.default;
      case 'boolean': return !!v;
      case 'select': return (!def.options || def.options.some(function (o) { return (o.value != null ? o.value : o) === v; })) ? v : def.default;
      default: return String(v);
    }
  }
  function defaultsOf(schema) {
    var out = {};
    for (var k in schema) out[k] = schema[k].default;
    return out;
  }
  function validateConfig(schema, values) {
    var out = {};
    for (var k in schema) out[k] = coerce(schema[k], Object.prototype.hasOwnProperty.call(values, k) ? values[k] : undefined);
    return out;
  }

  /* ---------------------------------------------------------------- modules */
  var modules = new Map();
  var activationChain = [];

  function makeLogger(id) {
    var tag = '%c' + id + '%c';
    var styles = ['color:#7b6cff;font-weight:700', 'color:inherit'];
    function out(level, method, styled) {
      return function () {
        var a = Array.prototype.slice.call(arguments);
        try { MUI.logs.push(level, id, a); } catch (e) {}
        console.__muiLogger = id;
        try {
          if (styled) (console[method] || console.log).apply(console, [tag].concat(styles, a));
          else (console[method] || console.log).apply(console, ['[' + id + ']'].concat(a));
        } finally { console.__muiLogger = null; }
      };
    }
    return { debug: out('debug', 'log', true), log: out('log', 'log', true), warn: out('warn', 'warn', false), error: out('error', 'error', false) };
  }

  function injectCSS(css, owner) {
    var el = document.createElement('style');
    el.dataset.owner = owner || 'anonymous';
    el.textContent = css;
    document.head.appendChild(el);
    return function () { el.remove(); };
  }

  function moduleInfo(m) {
    var perms = (m.manifest.permissions || []);
    return {
      id: m.id, name: m.name, version: m.version, apiVersion: m.manifest.apiVersion || '*',
      description: m.description, author: m.author, homepage: m.homepage, license: m.license,
      icon: m.icon || 'puzzle', state: m.state, enabled: m.state === 'active',
      error: m.error ? (m.error.message || String(m.error)) : null,
      requires: m.manifest.requires || {}, optional: m.manifest.optional || {},
      permissions: perms.map(function (c) { return { id: c, label: CAP_LABEL[c] || c, granted: isGranted(m.manifest, c), kind: CAP_DEFAULT[c] === false ? 'sensitive' : 'normal' }; }),
      denied: perms.filter(function (c) { return !isGranted(m.manifest, c); }),
      configSchema: m.configSchema || {},
      builtin: !!m.manifest.builtin,
      activatedAt: m.activatedAt || null,
      activationMs: m.activationMs != null ? m.activationMs : null,
      hasExports: !!m.exports,
      remote: !!m.remote
    };
  }
  function list() { return Array.from(modules.values()); }
  function publicList() { return list().map(moduleInfo); }

  function setState(m, state) {
    m.state = state;
    MUI.bus.emit('mod:state', moduleInfo(m));
    MUI.bus.emit('mods:changed');
  }
  function dependsOn(other, depId) {
    var r = other.manifest.requires || {}, o = other.manifest.optional || {};
    return Object.prototype.hasOwnProperty.call(r, depId) || Object.prototype.hasOwnProperty.call(o, depId);
  }
  function withTimeout(p, ms, label, id) {
    if (!p) return Promise.resolve();
    return Promise.race([
      Promise.resolve(p),
      new Promise(function (_, rej) { setTimeout(function () { rej(new Error('[' + id + '] ' + label + ' 超时 (' + ms + 'ms)')); }, ms); })
    ]);
  }

  /* ---------------------------------------------------------------- ctx */
  function createCtx(m, scope) {
    var id = m.id, manifest = m.manifest;
    var logger = makeLogger(id);
    var own = function (fn) { return scope.add(fn); };
    function guard(cap) {
      if (!isGranted(manifest, cap)) throw PermissionError(cap, id);
    }

    /* config */
    var schema = m.configSchema = normalizeSchema(manifest.config);
    var stored = m.store.get('config', {});
    var values = validateConfig(schema, Object.assign(defaultsOf(schema), stored));
    m.configValues = MUI.reactive(values);
    own(MUI.effect(function () {
      m.store.set('config', JSON.parse(JSON.stringify(m.configValues)));
    }));

    var ctx = {
      id: id, name: m.name, version: m.version, apiVersion: API_VERSION,
      manifest: manifest,
      log: logger.log, debug: logger.debug, warn: logger.warn, error: logger.error,

      /* config */
      config: m.configValues,
      configSchema: schema,
      getConfig: function (k) { return m.configValues[k]; },
      setConfig: function (k, v) {
        if (!(k in schema)) { logger.warn('未知配置项: ' + k); return; }
        m.configValues[k] = coerce(schema[k], v);
        MUI.bus.emit('mod:config', id, k, m.configValues[k]);
      },
      resetConfig: function () { var d = defaultsOf(schema); for (var k in d) m.configValues[k] = d[k]; },

      /* capability info */
      permissions: {
        has: function (cap) { return isGranted(manifest, cap); },
        list: function () { return (manifest.permissions || []).slice(); }
      },

      /* slots */
      slot: function (name, render, opt) { guard('ui.slot'); return own(MUI.slots.register(name, render, Object.assign({ owner: id }, opt || {}))); },
      slots: function () { return MUI.slots.names(); },

      /* views */
      view: function (name, def) {
        guard('ui.view');
        if (util.isPlain(name)) { def = name; name = def.name; }
        return own(MUI.router.register(name, Object.assign({ owner: id }, def || {})));
      },
      page: function (name, def) {
        guard('ui.view');
        if (util.isPlain(name)) { def = name; name = def.name; }
        return own(MUI.router.register(name, Object.assign({ owner: id, tab: true }, def || {})));
      },
      go: function (name, params) { return MUI.router.navigate(name, params); },
      back: function () { return MUI.router.back(); },

      /* components */
      component: {
        define: function (name, factory) { guard('ui.component'); return own(MUI.components.define(name, factory)); },
        override: function (name, factory) { guard('ui.component'); return own(MUI.components.override(name, factory)); },
        get: function (name) { return MUI.components.get(name); },
        use: function (name, props) { return MUI.components.use(name, props); },
        has: function (name) { return MUI.components.has(name); },
        list: function () { return MUI.components.list(); }
      },
      define: function (name, factory) { guard('ui.component'); return own(MUI.components.define(name, factory)); },
      override: function (name, factory) { guard('ui.component'); return own(MUI.components.override(name, factory)); },

      /* styles */
      style: function (css) { guard('ui.style'); return own(injectCSS(css, id)); },

      /* theme */
      theme: {
        mode: function () { return MUI.theme.mode(); },
        resolved: function () { return MUI.theme.resolved(); },
        setMode: function (v) { guard('ui.theme'); MUI.theme.setMode(v); },
        toggle: function () { guard('ui.theme'); MUI.theme.toggle(); },
        accent: function () { return MUI.theme.accent(); },
        setAccent: function (v) { guard('ui.theme'); MUI.theme.setAccent(v); },
        setVar: function (k, v) { guard('ui.theme'); MUI.theme.setVar(k, v); },
        getVar: function (k) { return MUI.theme.getVar(k); },
        subscribe: function (cb) { guard('ui.theme'); return own(MUI.bus.on('theme:mode', cb)); }
      },

      /* events */
      on: function (evt, fn) { guard('events'); return own(MUI.bus.on(evt, fn)); },
      once: function (evt, fn) { guard('events'); return own(MUI.bus.once(evt, fn)); },
      emit: function (evt) { guard('events'); MUI.bus.emit.apply(MUI.bus, arguments); },

      /* hooks */
      hook: function (name, fn, priority) { guard('hooks'); return own(MUI.hooks.addFilter(name, fn, priority, id)); },
      action: function (name, fn, priority) { guard('hooks'); return own(MUI.hooks.addAction(name, fn, priority, id)); },

      /* storage */
      store: m.store,

      /* http */
      get http() { guard('http'); return MUI.http; },
      fetch: function (url, opt) { guard('http'); return MUI.http.request(url, opt); },

      /* timers */
      setInterval: function (fn, ms) { guard('timers'); var t = setInterval(fn, ms); own(function () { clearInterval(t); }); return t; },
      setTimeout: function (fn, ms) { guard('timers'); var t = setTimeout(fn, ms); own(function () { clearTimeout(t); }); return t; },
      clearInterval: function (t) { clearInterval(t); },
      clearTimeout: function (t) { clearTimeout(t); },

      /* clipboard */
      copy: function (text) { guard('clipboard'); return util.copy(text); },

      /* overlays */
      toast: function () { guard('ui.overlay'); return MUI.overlay.toast.apply(null, arguments); },
      notify: function () { guard('ui.notifications'); return MUI.overlay.notify.apply(null, arguments); },
      modal: function () { guard('ui.overlay'); return MUI.overlay.modal.apply(null, arguments); },
      confirm: function () { guard('ui.overlay'); return MUI.overlay.confirm.apply(null, arguments); },
      prompt: function () { guard('ui.overlay'); return MUI.overlay.prompt.apply(null, arguments); },
      sheet: function () { guard('ui.overlay'); return MUI.overlay.sheet.apply(null, arguments); },
      actionSheet: function () { guard('ui.overlay'); return MUI.overlay.actionSheet.apply(null, arguments); },
      menu: function () { guard('ui.overlay'); return MUI.overlay.menu.apply(null, arguments); },
      loading: { show: function () { guard('ui.overlay'); return MUI.overlay.loading.show.apply(null, arguments); }, hide: function () { MUI.overlay.loading.hide(); } },

      /* settings */
      setting: function (item) { guard('ui.settings'); return own(MUI.settings.register(id, item)); },

      /* commands + hotkeys */
      command: function (cmd) { guard('ui.commands'); return own(MUI.commands.register(Object.assign({ owner: id }, cmd))); },
      hotkey: function (combo, fn, opt) { guard('ui.hotkeys'); return own(MUI.keys.register(combo, fn, Object.assign({ owner: id }, opt || {}))); },

      /* i18n */
      i18n: { register: function (locale, map) { MUI.i18n.register(locale, map); }, t: function (k, v) { return MUI.i18n.t(k, v); }, locale: function () { return MUI.i18n.locale(); } },

      /* inter-module */
      expose: function (obj) { m.exports = obj; MUI.bus.emit('mod:exports', id, obj); return obj; },
      require: function (other) {
        var o = modules.get(other);
        if (!o) throw new Error('依赖模块不存在: ' + other);
        if (o.state !== 'active') throw new Error('依赖模块未激活: ' + other);
        return o.exports;
      },

      /* reactive bindings — scoped to the module, auto-disposed on deactivate */
      scope: function (fn) { var d = MUI.scope(fn); own(d); return d; },
      text: function (source) { var n; own(MUI.scope(function () { n = MUI.text(source); })); return n; },
      bind: function (render) { var n; own(MUI.scope(function () { n = MUI.bind(render); })); return n; },
      list: function (source, item) { var n; own(MUI.scope(function () { n = MUI.list(source, item); })); return n; },
      resource: function (fetcher) { var r; own(MUI.scope(function () { r = MUI.resource(fetcher); })); return r; },
      persist: function (sig, key) { return MUI.persist(sig, key, 'mod:' + id); },
      observer: function (el, cb) { var off = MUI.observer(el, cb); own(off); return off; },
      intersect: function (el, cb, opt) { var off = MUI.intersect(el, cb, opt); own(off); return off; },
      drag: function (el, hh) { var off = MUI.drag(el, hh); own(off); return off; },

      /* misc */
      onDispose: own,
      dispose: own,
      ui: MUI.ui, h: h, icon: icon, utils: util, components: MUI.components,
      signals: MUI.state
    };

    /* timers must be reported even if never used, keep getter lazy above */
    return ctx;
  }

  /* ---------------------------------------------------------------- lifecycle */
  function doActivate(m) {
    if (m.state === 'active') return Promise.resolve(true);
    if (m._activating) return m._activating;
    m._activating = (async function () {
      m.activatingAt = Date.now();
      setState(m, 'resolving');
      m.error = null;
      var manifest = m.manifest;

      if (manifest.apiVersion && !semver.satisfies(API_VERSION, manifest.apiVersion)) {
        m.error = new Error('需要内核 API ' + manifest.apiVersion + '，当前 ' + API_VERSION);
        setState(m, 'inactive');
        MUI.bus.emit('mod:error', moduleInfo(m));
        return false;
      }

      var requires = manifest.requires || {};
      var problems = [];
      for (var depId in requires) {
        var dep = modules.get(depId);
        if (!dep) { problems.push(depId + '@' + requires[depId] + '（未安装）'); continue; }
        if (!semver.satisfies(dep.version, requires[depId])) { problems.push(depId + '@' + requires[depId] + '（当前 ' + dep.version + '）'); continue; }
        if ((dep.state === 'resolving' || dep.state === 'activating') && dep._activating) {
          problems.push(depId + '（循环依赖）');
          continue;
        }
        if (dep.state !== 'active') {
          var ok = await doActivate(dep);
          if (!ok) problems.push(depId + '（未能激活）');
        }
      }
      if (problems.length) {
        m.error = new Error('依赖未满足：' + problems.join('、'));
        setState(m, 'inactive');
        MUI.bus.emit('mod:error', moduleInfo(m));
        return false;
      }
      for (var od in (manifest.optional || {})) {
        var odep = modules.get(od);
        if (odep && odep.state !== 'active') { try { await doActivate(odep); } catch (e) {} }
      }

      setState(m, 'activating');
      activationChain.push(m.id);
      if (activationChain.length > 64) { m.error = new Error('依赖链过深，可能存在循环依赖'); setState(m, 'error'); activationChain.pop(); return false; }

      var scope = new Scope(m.id);
      var ctx = createCtx(m, scope);
      m.scope = scope; m.ctx = ctx;
      ctx = MUI.hooks.applyFilters('mod:context', ctx, moduleInfo(m)) || ctx;
      m.ctx = ctx;

      var timeout = manifest.timeout || DEFAULT_TIMEOUT;
      try {
        if (manifest.preload) await withTimeout(manifest.preload(ctx), timeout, 'preload', m.id);
        if (!m.installed) { if (manifest.install) await withTimeout(manifest.install(ctx), timeout, 'install', m.id); m.installed = true; }
        if (manifest.activate) await withTimeout(manifest.activate(ctx), timeout, 'activate', m.id);
      } catch (err) {
        m.error = err;
        scope.dispose(); m.scope = null; m.ctx = null;
        setState(m, 'error');
        console.error('[mod:' + m.id + '] 激活失败', err);
        MUI.bus.emit('mod:error', moduleInfo(m));
        activationChain.pop();
        return false;
      }
      activationChain.pop();

      m.enabled = true;
      m.activatedAt = Date.now();
      m.activationMs = m.activatedAt - m.activatingAt;
      setState(m, 'active');
      MUI.bus.emit('mod:enabled', moduleInfo(m));
      MUI.bus.emit('mod:activated', moduleInfo(m));

      /* activate dependents that were waiting */
      list().forEach(function (other) {
        if (other !== m && other.state === 'inactive' && dependsOn(other, m.id)) {
          Promise.resolve().then(function () { doActivate(other); });
        }
      });
      return true;
    })().then(function (r) { m._activating = null; return r; }, function (e) { m._activating = null; m.error = e; setState(m, 'error'); return false; });
    return m._activating;
  }

  function doDeactivate(m) {
    if (m.state !== 'active') return Promise.resolve(true);
    setState(m, 'deactivating');
    var dependents = list().filter(function (o) { return o.state === 'active' && dependsOn(o, m.id); });
    return Promise.all(dependents.map(doDeactivate)).then(function () {
      var timeout = m.manifest.timeout || DEFAULT_TIMEOUT;
      return withTimeout(
        m.manifest.deactivate ? m.manifest.deactivate(m.ctx) : null, timeout, 'deactivate', m.id
      ).catch(function (e) { console.error('[mod:' + m.id + '] deactivate', e); });
    }).then(function () {
      disposeModule(m);
      m.enabled = false;
      setState(m, 'inactive');
      MUI.bus.emit('mod:disabled', moduleInfo(m));
      return true;
    });
  }

  function disposeModule(m) {
    MUI.hooks.removeByOwner(m.id);
    MUI.slots.removeByOwner(m.id);
    MUI.commands.removeByOwner(m.id);
    MUI.keys.removeByOwner(m.id);
    MUI.settings.removeByOwner(m.id);
    if (m.scope) { m.scope.dispose(); m.scope = null; }
    m.ctx = null;
  }

  /* ---------------------------------------------------------------- public */
  function define(manifest, setup) {
    if (!manifest || !manifest.id) throw new Error('[mods] manifest.id 为必填项');
    if (modules.has(manifest.id)) { console.warn('[mods] 重复注册:', manifest.id); return modules.get(manifest.id); }
    manifest = Object.assign({}, manifest);
    if (setup && !manifest.activate) manifest.activate = setup;
    if (manifest.version && !semver.valid(manifest.version)) throw new Error('[mods] 非法版本号: ' + manifest.version);
    var m = {
      id: manifest.id,
      manifest: manifest,
      name: manifest.name || manifest.id,
      version: manifest.version || '0.0.0',
      description: manifest.description || '',
      author: typeof manifest.author === 'object' ? (manifest.author.name || '') : (manifest.author || ''),
      icon: manifest.icon,
      homepage: manifest.homepage, license: manifest.license,
      state: 'registered', enabled: false, installed: false, exports: null, error: null,
      remote: !!manifest.remote,
      store: MUI.createStore('mod:' + manifest.id, {
        version: manifest.storageVersion || 1,
        migrate: manifest.migrate
      }),
      _activating: null
    };
    modules.set(m.id, m);
    MUI.bus.emit('mod:registered', moduleInfo(m));
    MUI.bus.emit('mods:changed');
    if (manifest.autoEnable !== false) Promise.resolve().then(function () { doActivate(m); });
    return m;
  }

  var kernel = {
    API_VERSION: API_VERSION,
    capabilities: CAP_DEFAULT, capabilityLabels: CAP_LABEL,
    define: define,
    register: define,
    enable: function (id) { var m = modules.get(id); return m ? doActivate(m) : Promise.resolve(false); },
    disable: function (id) { var m = modules.get(id); return m ? doDeactivate(m) : Promise.resolve(false); },
    reload: function (id) {
      var m = modules.get(id); if (!m) return Promise.resolve(false);
      return doDeactivate(m).then(function () { m.installed = false; return doActivate(m); });
    },
    uninstall: function (id) {
      var m = modules.get(id); if (!m) return Promise.resolve(false);
      return doDeactivate(m).then(function () {
        if (m.manifest.uninstall && m.ctx) { try { m.manifest.uninstall(m.ctx); } catch (e) {} }
        modules.delete(id);
        MUI.bus.emit('mods:changed');
        return true;
      });
    },
    get: function (id) { return modules.get(id); },
    info: function (id) { var m = modules.get(id); return m ? moduleInfo(m) : null; },
    has: function (id) { return modules.has(id); },
    list: publicList,
    require: function (id) { var m = modules.get(id); return m && m.state === 'active' ? m.exports : null; },
    load: function (url, opt) {
      opt = opt || {};
      var before = new Set(modules.keys());
      return new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = url; s.async = true;
        var to = setTimeout(function () { cleanup(); reject(new Error('加载超时: ' + url)); }, opt.timeout || 12000);
        function cleanup() { clearTimeout(to); s.onload = null; s.onerror = null; }
        s.onload = function () {
          cleanup();
          var added = [];
          modules.forEach(function (m, id) { if (!before.has(id)) { m.remote = true; added.push(moduleInfo(m)); } });
          resolve(added);
        };
        s.onerror = function () { cleanup(); reject(new Error('加载失败: ' + url)); };
        document.head.appendChild(s);
      });
    },
    graph: function () {
      var nodes = list().map(function (m) {
        return { id: m.id, version: m.version, state: m.state, requires: Object.keys(m.manifest.requires || {}), optional: Object.keys(m.manifest.optional || {}) };
      });
      var edges = [];
      list().forEach(function (m) {
        Object.keys(m.manifest.requires || {}).forEach(function (d) { edges.push({ from: m.id, to: d, kind: 'requires' }); });
        Object.keys(m.manifest.optional || {}).forEach(function (d) { edges.push({ from: m.id, to: d, kind: 'optional' }); });
      });
      return { nodes: nodes, edges: edges };
    },
    diagnostics: function () {
      return publicList().map(function (i) {
        return {
          id: i.id, state: i.state, error: i.error, version: i.version,
          dependencies: Object.keys(i.requires).length, dependents: list().filter(function (m) { return dependsOn(m, i.id); }).length,
          permissions: i.permissions
        };
      });
    },
    onChange: function (cb) { return MUI.bus.on('mods:changed', cb); }
  };
  MUI.mods = kernel;
  MUI.defineModule = define;
})(window.MUI = window.MUI || {});
