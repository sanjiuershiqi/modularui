/* ==========================================================================
   boot.js — app facade, navigation chrome, built-in commands, startup
   ========================================================================== */
(function (MUI) {
  'use strict';
  var h = MUI.h, icon = MUI.icon, renderIcon = MUI.renderIcon;
  var router = MUI.router, theme = MUI.theme, util = MUI.util;
  var $ = function (id) { return document.getElementById(id); };

  MUI.version = '2.0.0';

  /* ---------------------------------------------------------------- facade */
  MUI.app = {
    version: MUI.version, apiVersion: MUI.mods.API_VERSION,
    MUI: MUI, h: h, ui: MUI.ui, icon: icon,
    mods: MUI.mods, router: router, theme: theme, i18n: MUI.i18n, http: MUI.http,
    keys: MUI.keys, commands: MUI.commands, slots: MUI.slots, components: MUI.components,
    overlay: MUI.overlay, settings: MUI.settings, state: MUI.state, util: util,
    toast: function () { return MUI.overlay.toast.apply(null, arguments); },
    notify: function () { return MUI.overlay.notify.apply(null, arguments); },
    modal: function () { return MUI.overlay.modal.apply(null, arguments); },
    confirm: function () { return MUI.overlay.confirm.apply(null, arguments); },
    sheet: function () { return MUI.overlay.sheet.apply(null, arguments); },
    menu: function () { return MUI.overlay.menu.apply(null, arguments); },
    navigate: function (name, params) { return router.navigate(name, params); },
    ready: function (fn) { if (booted) fn(MUI.app); else MUI.bus.once('app:ready', function () { fn(MUI.app); }); },
    on: function (e, f) { return MUI.bus.on(e, f); },
    emit: function () { return MUI.bus.emit.apply(MUI.bus, arguments); }
  };

  /* ---------------------------------------------------------------- chrome */
  function infoOf(route) { return router.info(route); }

  function renderNav() {
    var routes = router.routes().filter(function (r) { return !infoOf(r).hidden; });
    var groups = [];
    var seen = {};
    routes.slice().sort(function (a, b) { return infoOf(a).order - infoOf(b).order; }).forEach(function (r) {
      var info = infoOf(r);
      if (!seen[info.group]) { seen[info.group] = []; groups.push(info.group); }
      seen[info.group].push({ route: r, info: info });
    });

    var nav = $('sidebar-nav');
    MUI.clear(nav);
    groups.forEach(function (g) {
      nav.appendChild(h('div', { class: 'nav-group', text: g }));
      seen[g].forEach(function (entry) {
        var badge = entry.info.badge;
        if (typeof badge === 'function') badge = badge();
        var el = h('div', { class: 'nav-item', dataset: { route: entry.route.name }, role: 'link', tabindex: '0', onClick: function () { router.navigate(entry.route.name); } }, [
          h('span', { class: 'nav-item__icon' }, renderIcon(entry.info.icon, 18)),
          h('span', { class: 'nav-item__label', text: entry.info.label }),
          badge != null && badge !== '' ? h('span', { class: 'nav-item__badge', text: String(badge) }) : null
        ]);
        el.addEventListener('keydown', function (e) { if (e.key === 'Enter') router.navigate(entry.route.name); });
        nav.appendChild(el);
      });
    });

    /* tab bar */
    var tabs = routes.filter(function (r) { return infoOf(r).tab; })
      .sort(function (a, b) { return infoOf(a).tabOrder - infoOf(b).tabOrder; });
    var tabbar = $('tabbar');
    MUI.clear(tabbar);
    if (tabs.length) {
      tabbar.classList.add('is-on');
      tabs.forEach(function (r) {
        var info = infoOf(r);
        var el = h('div', { class: 'tab', dataset: { route: r.name }, onClick: function () { router.navigate(r.name); } }, [
          h('span', { class: 'tab__icon' }, renderIcon(info.icon, 20)),
          h('span', { text: info.label })
        ]);
        tabbar.appendChild(el);
      });
    } else tabbar.classList.remove('is-on');

    updateActive();
  }
  function updateActive() {
    var cur = router.current();
    document.querySelectorAll('.nav-item').forEach(function (n) { n.classList.toggle('is-active', n.dataset.route === cur); });
    document.querySelectorAll('.tab').forEach(function (n) { n.classList.toggle('is-active', n.dataset.route === cur); });
  }

  function updateThemeBtn() {
    var btn = $('theme-btn'); if (!btn) return;
    MUI.clear(btn); btn.appendChild(icon(theme.resolved() === 'dark' ? 'sun' : 'moon', 17));
    var mobile = $('theme-btn-mobile');
    if (mobile) { MUI.clear(mobile); mobile.appendChild(icon(theme.resolved() === 'dark' ? 'sun' : 'moon', 18)); }
  }
  function updateDensityBtn() {
    var btn = $('density-btn'); if (!btn) return;
    MUI.clear(btn); btn.appendChild(icon('sliders', 17));
  }
  function renderStatus() {
    var el = $('sidebar-status'); if (!el) return;
    MUI.clear(el);
    var mods = MUI.mods.list();
    var rows = [
      ['模块', mods.filter(function (m) { return m.state === 'active'; }).length + '/' + mods.length],
      ['组件', String(MUI.components.list().length)],
      ['路由', String(router.routes().length)],
      ['插槽', String(MUI.slots.names().length)]
    ];
    rows.forEach(function (r) { el.appendChild(h('div', { class: 'sys-cell' }, [h('span', { text: r[0] }), h('b', { text: r[1] })])); });
  }

  function renderFooter() {
    var f = $('app-footer'); if (!f) return;
    MUI.clear(f);
    f.appendChild(MUI.ui.rail());
    var links = router.routes().filter(function (r) { return !router.info(r).hidden; }).slice(0, 6).map(function (r) {
      var a = h('a', { text: router.info(r).label });
      a.addEventListener('click', function () { router.navigate(r.name); });
      return a;
    });
    f.appendChild(h('div', { class: 'app-footer__main' }, [
      h('div', { class: 'app-footer__brand' }, [
        h('span', { class: 'app-footer__mark' }, icon('layers', 15, 2)),
        h('span', {}, [h('b', { text: 'ModularUI' }), h('span', { class: 'faint', text: ' · 可扩展应用内核' })])
      ]),
      h('div', { class: 'app-footer__links' }, links),
      h('div', { class: 'app-footer__meta' }, [
        h('span', { text: 'v' + MUI.version }),
        h('span', { text: 'API ' + MUI.mods.API_VERSION }),
        h('span', { text: 'no-bundler' })
      ])
    ]));
    f.appendChild(MUI.ui.stripeBar());
  }

  function openHelp() {
    var rows = [
      ['命令面板', 'mod+k'],
      ['打开 / 关闭侧栏', 'mod+b'],
      ['切换主题', 'mod+shift+l'],
      ['快捷键帮助', 'mod+/'],
      ['关闭弹层 / 抽屉', 'escape']
    ];
    var seen = {};
    rows.forEach(function (r) { seen[r[0]] = 1; });
    var extra = MUI.commands.list().filter(function (c) { return c.keybinding && c.id !== 'help.shortcuts' && !seen[c.title]; })
      .map(function (c) { return [c.title, c.keybinding]; });
    function row(label, combo) {
      return h('div', { class: 'listitem' }, [
        h('div', { class: 'listitem__main' }, h('div', { class: 'listitem__title', text: label })),
        h('span', { class: 'kbd', text: MUI.keys.format(combo) })
      ]);
    }
    MUI.overlay.sheet({
      title: '键盘快捷键',
      content: h('div', { class: 'list' }, rows.map(function (r) { return row(r[0], r[1]); })
        .concat(extra.map(function (r) { return row(r[0], r[1]); })))
    });
  }

  function wire() {
    $('theme-btn').addEventListener('click', function () { theme.toggle(); });
    $('theme-btn-mobile').addEventListener('click', function () { theme.toggle(); });
    $('density-btn').addEventListener('click', function () { theme.setDensity(theme.density() === 'cozy' ? 'compact' : 'cozy'); MUI.overlay.toast('密度：' + (theme.density() === 'cozy' ? '舒适' : '紧凑')); });
    $('command-trigger').addEventListener('click', function () { MUI.palette.open(); });
    $('command-trigger-mobile').addEventListener('click', function () { MUI.palette.open(); });
    $('menu-btn').addEventListener('click', function () { $('sidebar').classList.contains('is-open') ? MUI.closeSidebar() : MUI.openSidebar(); });
    $('scrim').addEventListener('click', MUI.closeSidebar);
    $('content').addEventListener('click', function () { if ($('sidebar').classList.contains('is-open')) MUI.closeSidebar(); });

    $('command-trigger').querySelector('[data-ct-icon]').appendChild(icon('search', 16));
    $('command-trigger').querySelector('[data-ct-kbd]').textContent = util.isMac ? '⌘ K' : 'Ctrl K';
    document.querySelector('[data-brand-mark]').appendChild(icon('layers', 19, 2));
    document.querySelector('[data-brand-ver]').textContent = 'v' + MUI.version;
    var build = document.querySelector('[data-build]'); if (build) build.textContent = 'build 2.0.0';
    $('menu-btn').appendChild(icon('menu', 18));
    $('command-trigger-mobile').appendChild(icon('search', 18));
  }

  /* ---------------------------------------------------------------- commands */
  function registerBuiltins() {
    router.routes().forEach(function (r) {
      var info = infoOf(r);
      MUI.commands.register({
        id: 'nav.' + r.name, title: '前往：' + info.label, subtitle: 'route / ' + r.name,
        icon: info.icon, group: '页面', keywords: r.name + ' ' + info.label,
        run: function () { router.navigate(r.name); }
      });
    });
    MUI.commands.register({ id: 'theme.toggle', title: '切换主题', subtitle: 'theme.toggle()', icon: 'moon', group: '外观', keybinding: 'mod+shift+l', run: function () { theme.toggle(); } });
    MUI.commands.register({ id: 'theme.accent', title: '更换配色方案', subtitle: 'theme.setPalette()', icon: 'palette', group: '外观', run: function () {
      var grid = h('div', { style: 'display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:4px 2px 10px' });
      theme.palettes.forEach(function (p) {
        var active = theme.palette() === p.name;
        var sw = h('button', { type: 'button', title: p.name, style: 'border:0;background:transparent;cursor:pointer;display:flex;flex-direction:column;gap:6px;align-items:center;padding:0' }, [
          h('span', { style: 'width:100%;height:38px;display:flex;overflow:hidden;border:1px solid ' + (active ? 'var(--text)' : 'var(--border-strong)') + ';box-shadow:' + (active ? 'var(--hard-sm)' : 'none') }, [
            h('span', { style: 'flex:1;background:' + p.a1 }),
            h('span', { style: 'flex:1;background:' + p.a2 })
          ]),
          h('span', { style: 'font-size:var(--fs-2xs);color:var(--text-2);white-space:nowrap;text-transform:uppercase;letter-spacing:.04em;width:100%;text-align:center;overflow:hidden;text-overflow:ellipsis', text: p.name })
        ]);
        sw.addEventListener('click', function () { theme.setPalette(p.name); MUI.overlay.toast('配色：' + p.name); });
        grid.appendChild(sw);
      });
      MUI.overlay.sheet({ title: '配色方案', content: grid });
    } });
    MUI.commands.register({ id: 'density.toggle', title: '切换界面密度', subtitle: 'theme.setDensity()', icon: 'sliders', group: '外观', run: function () { theme.setDensity(theme.density() === 'cozy' ? 'compact' : 'cozy'); } });
    MUI.commands.register({ id: 'mods.reloadAll', title: '重载全部模块', subtitle: 'mods.reload()', icon: 'refresh', group: '模块', run: function () {
      var mods = MUI.mods.list();
      Promise.all(mods.map(function (m) { return MUI.mods.reload(m.id); })).then(function () { MUI.overlay.toast('已重载 ' + mods.length + ' 个模块', 'success'); });
    } });
    MUI.commands.register({ id: 'help.shortcuts', title: '键盘快捷键', subtitle: 'help.shortcuts', icon: 'command', group: '帮助', keybinding: 'mod+/', run: openHelp });
    MUI.commands.register({ id: 'debug.log', title: '在控制台打印内核', subtitle: 'console.log(MUI)', icon: 'terminal', group: '调试', run: function () { console.log(MUI); MUI.overlay.toast('已输出 MUI'); } });
    MUI.commands.register({ id: 'debug.graph', title: '打印模块依赖图', subtitle: 'mods.graph()', icon: 'gitBranch', group: '调试', run: function () { console.log(MUI.mods.graph()); MUI.overlay.toast('已输出依赖图'); } });
  }

  /* ---------------------------------------------------------------- boot */
  var booted = false;
  function boot() {
    if (booted) return;
    booted = true;

    theme.init();
    wire();
    renderNav();
    renderStatus();
    renderFooter();
    registerBuiltins();
    updateThemeBtn(); updateDensityBtn();

    MUI.keys.register('mod+k', function () { MUI.palette.open(); });
    MUI.keys.register('mod+/', openHelp);
    MUI.keys.register('mod+shift+l', function () { theme.toggle(); });
    MUI.keys.register('mod+b', function () { $('sidebar').classList.contains('is-open') ? MUI.closeSidebar() : MUI.openSidebar(); });
    MUI.keys.register('escape', function () { MUI.closeSidebar(); }, { preventDefault: false });

    MUI.bus.on('router:navigate', function () { updateActive(); renderStatus(); });
    MUI.bus.on('router:changed', function () { renderNav(); renderStatus(); renderFooter(); });
    MUI.bus.on('mods:changed', function () { renderStatus(); renderNav(); });
    MUI.bus.on('theme:mode', updateThemeBtn);
    MUI.bus.on('component:defined', function () { renderStatus(); renderNav(); });

    MUI.hooks.addAction('mod:error', function (info) {
      MUI.overlay.notify({ type: 'danger', title: '模块错误：' + info.name, text: info.error || '', duration: 0 });
    });

    var _viewCleanup = null;
    MUI.hooks.addAction('route:beforeRender', function () {
      if (_viewCleanup) { try { _viewCleanup(); } catch (e) { console.error(e); } _viewCleanup = null; }
    }, 999);
    MUI.hooks.addAction('route:mounted', function (name, root) {
      var c = root && root.firstElementChild;
      _viewCleanup = c && typeof c.__cleanup === 'function' ? c.__cleanup : null;
    }, 100);

    var hash = (location.hash || '').replace('#', '').split('?')[0];
    var def = router.get(hash) ? hash : 'home';
    router.navigate(def, null, { noTransition: true, replace: true });

    window.addEventListener('hashchange', function () {
      var n = location.hash.replace('#', '').split('?')[0];
      if (n && n !== router.current() && router.get(n)) router.navigate(n);
    });
    window.addEventListener('resize', util.debounce(function () { if (innerWidth >= 900) MUI.closeSidebar(); }, 150));

    document.getElementById('app').removeAttribute('data-booting');
    document.body.classList.add('is-ready');
    MUI.bus.emit('app:ready', MUI.app);
    MUI.hooks.doAction('app:ready', MUI.app);
    console.log('%cMODULARUI%c v' + MUI.version + ' · API ' + MUI.mods.API_VERSION,
      'background:#7b6cff;color:#fff;padding:2px 8px;font-weight:800;letter-spacing:.06em',
      'color:#8b93a5;margin-left:6px');
    console.log('%c▸%c 试试 MUI.mods.graph() · MUI.palette.open() · MUI.logs.list()',
      'color:#12b5a5;font-weight:800', 'color:inherit');
    MUI.logs.push('log', 'kernel', ['内核就绪 · API ' + MUI.mods.API_VERSION + ' · ' + MUI.mods.list().length + ' 个模块']);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.MUI = window.MUI || {});
