/* ==========================================================================
   registry.js — component registry + ui facade (Proxy)
   ========================================================================== */
(function (MUI) {
  'use strict';
  var map = new Map();

  function define(name, factory) {
    if (typeof name !== 'string' || typeof factory !== 'function') throw new Error('[components] define(name, factory)');
    map.set(name, factory);
    MUI.bus.emit('component:defined', name);
    return factory;
  }
  function has(name) { return map.has(name); }
  function get(name) { return map.get(name); }
  function use(name, props) {
    var children = Array.prototype.slice.call(arguments, 2);
    var factory = map.get(name);
    var p = Object.assign({}, props || {});
    if (children.length) p.children = (Array.isArray(p.children) ? p.children : (p.children != null ? [p.children] : [])).concat(children);
    if (!('children' in p)) p.children = [];
    if (!factory) {
      console.warn('[components] 未注册的组件: ' + name);
      return MUI.h('div', { class: 'panel', style: 'border-color:var(--danger)', text: '缺失组件: ' + name });
    }
    return factory(p);
  }
  function override(name, factory) {
    var prev = map.get(name);
    map.set(name, factory);
    MUI.bus.emit('component:overridden', name);
    return function restore() { map.set(name, prev); MUI.bus.emit('component:restored', name); };
  }
  function list() { return Array.from(map.keys()); }

  var components = { define: define, has: has, get: get, use: use, override: override, list: list, names: list, registry: map };
  MUI.components = components;
  MUI.defineComponent = define;

  var SPECIAL = {
    h: MUI.h, svg: MUI.svg, fragment: MUI.fragment, icon: MUI.icon, icons: MUI.icons,
    get: get, has: has, use: use, override: override, list: list, define: define,
    registry: map, components: components,
    router: MUI.router, theme: MUI.theme, state: MUI.state, http: MUI.http,
    commands: MUI.commands, keys: MUI.keys, settings: MUI.settings,
    palette: MUI.palette,
    toast: function () { return MUI.overlay.toast.apply(null, arguments); },
    notify: function () { return MUI.overlay.notify.apply(null, arguments); },
    modal: function () { return MUI.overlay.modal.apply(null, arguments); },
    confirm: function () { return MUI.overlay.confirm.apply(null, arguments); },
    prompt: function () { return MUI.overlay.prompt.apply(null, arguments); },
    sheet: function () { return MUI.overlay.sheet.apply(null, arguments); },
    actionSheet: function () { return MUI.overlay.actionSheet.apply(null, arguments); },
    menu: function () { return MUI.overlay.menu.apply(null, arguments); },
    loading: MUI.overlay.loading
  };
  MUI.ui = new Proxy({}, {
    get: function (_, key) {
      if (key in SPECIAL) return SPECIAL[key];
      if (typeof key !== 'string') return undefined;
      if (key === 'then') return undefined; /* avoid promise-like */
      return function () { return use.apply(null, [key].concat(Array.prototype.slice.call(arguments))); };
    },
    has: function (_, key) { return key in SPECIAL || map.has(key); }
  });
  MUI.ui.use = use;
  MUI.ui.list = list;
})(window.MUI = window.MUI || {});
