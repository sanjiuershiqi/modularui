/* ==========================================================================
   ui-core.js — slots, router, overlays, tooltips, command palette
   ========================================================================== */
(function (MUI) {
  'use strict';
  var util = MUI.util, h = MUI.h, icon = MUI.icon, renderIcon = MUI.renderIcon;
  var $ = function (id) { return document.getElementById(id); };
  var layer = $('layer'), overlay = $('overlay'), toastStack = $('toast-stack'), notifyStack = $('notify-stack');
  var escapeStack = [];

  /* ======================================================================
     Slots
     ====================================================================== */
  var slotMap = new Map();
  var slotStamp = 0;
  function registerSlot(name, render, opt) {
    opt = opt || {};
    if (typeof render !== 'function') throw new Error('[slots] render must be a function');
    if (!slotMap.has(name)) slotMap.set(name, []);
    var entry = { name: name, render: render, priority: opt.priority == null ? 10 : opt.priority, id: opt.id || util.uid('slot'), owner: opt.owner || null };
    var list = slotMap.get(name);
    list.push(entry); list.sort(function (a, b) { return a.priority - b.priority; });
    slotStamp++; renderSlot(name);
    MUI.bus.emit('slot:mount', name, entry);
    return function dispose() {
      var l = slotMap.get(name); if (!l) return;
      var i = l.indexOf(entry); if (i > -1) l.splice(i, 1);
      if (!l.length) slotMap.delete(name);
      slotStamp++; renderSlot(name);
      MUI.bus.emit('slot:unmount', name, entry);
    };
  }
  function renderSlot(name) {
    var list = (slotMap.get(name) || []).slice();
    document.querySelectorAll('[data-slot="' + name + '"]').forEach(function (host) {
      if (host.__muiStamp === slotStamp && host.__muiCount === list.length) return;
      MUI.clear(host);
      list.forEach(function (entry) {
        try { var node = entry.render(); if (node) host.appendChild(node); }
        catch (e) { console.error('[slot:' + name + ']', e); }
      });
      host.__muiStamp = slotStamp; host.__muiCount = list.length;
    });
  }
  function renderAllSlots() { slotMap.forEach(function (_, name) { renderSlot(name); }); }
  function removeSlotsByOwner(owner) {
    var changed = false;
    Array.from(slotMap.entries()).forEach(function (pair) {
      var name = pair[0], list = pair[1];
      for (var i = list.length - 1; i >= 0; i--) if (list[i].owner === owner) { list.splice(i, 1); changed = true; }
      if (!list.length) slotMap.delete(name);
    });
    if (changed) { slotStamp++; renderAllSlots(); }
  }
  new MutationObserver(function (muts) {
    var names = new Set();
    muts.forEach(function (m) {
      Array.prototype.forEach.call(m.addedNodes, function (n) {
        if (n.nodeType !== 1) return;
        if (n.dataset && n.dataset.slot) names.add(n.dataset.slot);
        if (n.querySelectorAll) n.querySelectorAll('[data-slot]').forEach(function (e) { names.add(e.dataset.slot); });
      });
    });
    names.forEach(renderSlot);
  }).observe(document.body, { childList: true, subtree: true });

  MUI.slots = { register: registerSlot, render: renderSlot, renderAll: renderAllSlots, names: function () { return Array.from(slotMap.keys()); }, removeByOwner: removeSlotsByOwner };

  /* ======================================================================
     Router
     ====================================================================== */
  var routes = new Map();
  var current = null, currentParams = {};

  function registerRoute(name, def) {
    routes.set(name, Object.assign({ name: name }, def));
    MUI.bus.emit('router:changed');
    MUI.hooks.doAction('route:registered', name, def);
    return function unregister() {
      routes.delete(name);
      MUI.bus.emit('router:changed');
      if (current === name) navigate('home');
    };
  }
  function navInfo(def) {
    var n = def.nav === true ? {} : (def.nav || {});
    var t = def.tab === true ? {} : (def.tab || {});
    return {
      label: (n.label || t.label || def.title || def.name),
      icon: n.icon || t.icon || def.icon || 'box',
      group: n.group || '导航',
      order: n.order != null ? n.order : (def.order != null ? def.order : 100),
      tab: !!def.tab,
      tabOrder: t.order != null ? t.order : (n.order != null ? n.order : 100),
      hidden: n.hidden === true,
      badge: n.badge != null ? n.badge : def.badge
    };
  }
  function navigate(name, params, opts) {
    opts = opts || {};
    var def = routes.get(name);
    if (!def) { console.warn('[router] unknown route:', name); toast('页面不存在：' + name, 'danger'); return false; }
    if (def.beforeEnter) {
      var verdict = def.beforeEnter({ name: name, params: params || {}, app: MUI.app });
      if (verdict === false) return false;
    }
    if (CMDK.close) CMDK.close();
    var prev = current ? routes.get(current) : null;
    if (prev && prev.onLeave) { try { prev.onLeave({ name: current, app: MUI.app }); } catch (e) { console.error(e); } }

    MUI.hooks.doAction('route:beforeRender', name, params, def);
    var ctx = { name: name, params: params || {}, app: MUI.app, ui: MUI.ui, h: h, icon: icon, hooks: MUI.hooks, bus: MUI.bus, router: api };
    var node;
    try {
      node = typeof def.render === 'function' ? def.render(ctx) : def.render;
      node = MUI.hooks.applyFilters('route:render', node, ctx, def);
    } catch (err) {
      console.error('[route:' + name + '] 渲染失败', err);
      node = h('div', { class: 'view' }, MUI.ui.banner({
        tone: 'danger', title: '页面渲染失败：' + name,
        text: (err && err.message) || String(err),
        children: [h('pre', { class: 'codeblock', style: 'margin:0;padding:12px', text: (err && err.stack) || '' })]
      }));
    }

    function swap() {
      var host = $('view-root');
      MUI.clear(host);
      if (node) host.appendChild(node);
      current = name; currentParams = params || {};
      var titleSlot = (slotMap.get('header.title') || []).length;
      var title = $('view-title');
      if (!titleSlot) { title.textContent = MUI.hooks.applyFilters('route:title', def.title || name, def); }
      var badge = $('view-badge');
      badge.textContent = def.badge ? (typeof def.badge === 'function' ? def.badge() : def.badge) : '';
      badge.className = 'topbar__badge badge' + (def.badgeTone ? ' badge--' + def.badgeTone : '');
      badge.style.display = badge.textContent ? '' : 'none';
      renderBreadcrumb(def);
      $('scroll').scrollTop = 0;
      renderAllSlots();
    }

    if (!opts.replace && !opts.noTransition && document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches && current) {
      try { document.startViewTransition(swap); } catch (e) { swap(); }
    } else swap();

    if (def.onEnter) { try { def.onEnter(ctx); } catch (e) { console.error(e); } }
    MUI.hooks.doAction('route:afterRender', name, currentParams, def);
    MUI.hooks.doAction('route:mounted', name, $('view-root'), ctx);
    MUI.bus.emit('router:navigate', name, currentParams);
    try { if (location.hash !== '#' + name) history[opts.replace ? 'replaceState' : 'replaceState'](null, '', '#' + name); } catch (e) {}
    closeSidebar();
    return true;
  }
  function renderBreadcrumb(def) {
    var bc = $('breadcrumb'); MUI.clear(bc);
    var info = navInfo(def);
    var group = def.breadcrumbGroup || 'ModularUI';
    bc.appendChild(h('span', { class: 'breadcrumb__item', text: group }));
    bc.appendChild(h('span', { class: 'breadcrumb__sep', text: '/' }));
    bc.appendChild(h('span', { class: 'breadcrumb__item breadcrumb__item--current', text: info.label }));
  }
  function back() { if (history.length > 1) history.back(); else navigate('home'); }
  var api = {
    register: registerRoute,
    navigate: navigate,
    go: navigate,
    back: back,
    current: function () { return current; },
    params: function () { return currentParams; },
    routes: function () { return Array.from(routes.values()); },
    get: function (n) { return routes.get(n); },
    info: navInfo,
    onChange: function (cb) { return MUI.bus.on('router:navigate', cb); }
  };
  MUI.router = api;

  /* ======================================================================
     Sidebar helpers (mobile)
     ====================================================================== */
  function openSidebar() { $('sidebar').classList.add('is-open'); $('scrim').classList.add('is-on'); }
  function closeSidebar() { $('sidebar').classList.remove('is-open'); $('scrim').classList.remove('is-on'); }
  MUI.openSidebar = openSidebar; MUI.closeSidebar = closeSidebar;

  /* ======================================================================
     Overlays
     ====================================================================== */
  function pushEsc(fn) { escapeStack.push(fn); }
  function popEsc(fn) { var i = escapeStack.indexOf(fn); if (i > -1) escapeStack.splice(i, 1); }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && escapeStack.length) { var fn = escapeStack[escapeStack.length - 1]; e.preventDefault(); fn(); }
  });

  function iconFor(type) { return { success: 'checkCircle', danger: 'xCircle', warning: 'alert', info: 'info' }[type] || 'info'; }

  function toast(input, type, opt) {
    var o = typeof input === 'object' ? input : Object.assign({ title: String(input) }, typeof type === 'string' ? {} : (type || {}));
    var tone = typeof type === 'string' ? type : (o.type || 'info');
    var el = h('div', { class: 'toast toast--' + tone, role: 'status' }, [
      h('span', { class: 'toast__icon' }, icon(o.icon || iconFor(tone), 15)),
      h('div', { class: 'toast__body' }, [
        h('div', { class: 'toast__title', text: o.title != null ? o.title : '' }),
        o.text ? h('div', { class: 'toast__text', text: o.text }) : null
      ]),
      h('span', { class: 'toast__close', onClick: function () { close(); } }, icon('x', 14))
    ]);
    while (toastStack.children.length >= 4) { var old = toastStack.firstElementChild; if (old) old.remove(); else break; }
    toastStack.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('is-in'); });
    var timer, closed = false;
    function close() {
      if (closed) return; closed = true;
      clearTimeout(timer); popEsc(close);
      el.classList.remove('is-in');
      setTimeout(function () { el.remove(); }, 220);
    }
    pushEsc(close);
    function arm() { if (o.duration !== 0) timer = setTimeout(close, o.duration || 2600); }
    arm();
    el.addEventListener('mouseenter', function () { clearTimeout(timer); });
    el.addEventListener('mouseleave', function () { clearTimeout(timer); timer = setTimeout(close, 1200); });
    return close;
  }

  function notify(o) {
    o = typeof o === 'string' ? { title: o } : (o || {});
    var tone = o.type || 'info';
    var el = h('div', { class: 'notify notify--' + tone, role: 'alert' }, [
      h('span', { class: 'notify__icon' }, icon(o.icon || iconFor(tone), 15)),
      h('div', { class: 'notify__body' }, [
        h('div', { class: 'notify__title', text: o.title || '' }),
        o.text ? h('div', { class: 'notify__text', text: o.text }) : null,
        o.action ? h('div', { style: 'margin-top:9px' }, o.action) : null
      ]),
      h('span', { class: 'notify__close', onClick: function () { close(); } }, icon('x', 14))
    ]);
    notifyStack.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('is-in'); });
    var timer, closed = false;
    function close() { if (closed) return; closed = true; clearTimeout(timer); popEsc(close); el.classList.remove('is-in'); setTimeout(function () { el.remove(); }, 220); }
    pushEsc(close);
    if (o.duration !== 0) timer = setTimeout(close, o.duration || 4200);
    return close;
  }

  function createMask(kind, onClose, dismissible) {
    var mask = h('div', { class: 'mask mask--' + kind });
    var closed = false, release = null;
    function close(value) {
      if (closed) return; closed = true;
      popEsc(close);
      mask.classList.remove('is-in');
      if (release) release();
      setTimeout(function () { mask.remove(); }, 240);
      if (onClose) onClose(value);
    }
    mask.addEventListener('mousedown', function (e) { if (dismissible !== false && e.target === mask) close(undefined); });
    overlay.appendChild(mask);
    requestAnimationFrame(function () { mask.classList.add('is-in'); });
    pushEsc(function () { if (dismissible !== false) close(undefined); });
    return { mask: mask, close: close };
  }

  function modal(opt) {
    opt = opt || {};
    var o = typeof opt === 'string' ? { title: opt } : opt;
    var actions = o.actions && o.actions.length ? o.actions : [{ label: '确定', tone: 'primary' }];
    var hasBody = !!(o.body || o.content || o.message);
    var alert = o.alert != null ? o.alert : !hasBody;
    var ctl = createMask('center', o.onClose, o.dismissible);
    var box = h('div', { class: 'modal' + (alert ? ' modal--alert' : ''), role: 'dialog', 'aria-modal': 'true' }, [
      (o.icon || o.title) ? h('div', { class: 'modal__head' }, [
        o.icon ? h('span', { class: 'modal__icon modal__icon--' + (o.iconTone || 'accent') }, icon(o.icon, 18)) : null,
        h('div', { class: 'modal__headtext' }, [
          o.title ? h('div', { class: 'modal__title', text: o.title }) : null,
          o.desc ? h('div', { class: 'modal__desc', text: o.desc }) : null
        ])
      ]) : null,
      hasBody ? h('div', { class: 'modal__body' + (o.center ? ' modal__body--center' : '') },
        o.body || o.content || (o.message ? String(o.message) : null)) : null,
      h('div', { class: 'modal__foot' }, actions.map(function (a) {
        var b = h('button', { class: 'btn btn--' + (a.tone || 'default'), type: 'button', text: a.label });
        b.addEventListener('click', function () {
          var r = a.onClick ? a.onClick() : undefined;
          if (a.close !== false) ctl.close(r !== undefined ? r : a.value);
        });
        return b;
      }))
    ]);
    ctl.mask.appendChild(box);
    ctl.mask.__card = box;
    ctl.release = MUI.trapFocus(box);
    return ctl;
  }

  function confirm(opt) {
    var o = typeof opt === 'string' ? { title: opt } : (opt || {});
    return new Promise(function (resolve) {
      modal({
        title: o.title || '请确认', desc: o.desc || o.message, icon: o.icon || 'alert', body: o.body,
        center: true, dismissible: o.dismissible,
        iconTone: o.danger ? 'danger' : (o.iconTone || 'accent'),
        actions: [
          { label: o.cancelText || '取消', onClick: function () { resolve(false); } },
          { label: o.okText || '确定', tone: o.danger ? 'danger' : 'primary', onClick: function () { resolve(true); } }
        ],
        onClose: function () { resolve(false); }
      });
    });
  }

  function prompt(opt) {
    var o = typeof opt === 'string' ? { title: opt } : (opt || {});
    return new Promise(function (resolve) {
      var input = h('input', { class: 'modal__input', type: o.type || 'text', placeholder: o.placeholder || '', value: o.value || '', 'data-autofocus': 'true' });
      var ctl = modal({
        title: o.title || '输入内容', desc: o.desc, body: [o.body || null, input],
        actions: [
          { label: o.cancelText || '取消', onClick: function () { resolve(null); } },
          { label: o.okText || '确定', tone: 'primary', close: false, onClick: function () { var v = input.value; ctl.close(); resolve(v); } }
        ],
        onClose: function () { resolve(null); }
      });
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { var v = input.value; ctl.close(); resolve(v); } });
    });
  }

  function sheet(opt) {
    var o = opt || {};
    var ctl = createMask('sheet', o.onClose, o.dismissible);
    var box = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' }, [
      h('div', { class: 'sheet__handle' }),
      o.title ? h('div', { class: 'sheet__title', text: o.title }) : null,
      h('div', { class: 'sheet__body' }, o.content)
    ]);
    ctl.mask.appendChild(box);
    ctl.release = MUI.trapFocus(box);
    return ctl;
  }

  function actionSheet(opt) {
    o = opt || {};
    var ctl;
    var list = h('div', { class: 'list' }, (o.items || []).map(function (it) {
      return h('div', { class: 'listitem listitem--tap' + (it.danger ? ' listitem--danger' : ''), onClick: function () { ctl.close(); if (it.onClick) it.onClick(); } }, [
        it.icon ? h('span', { class: 'listitem__icon' }, renderIcon(it.icon, 17)) : null,
        h('div', { class: 'listitem__main' }, h('div', { class: 'listitem__title', text: it.title })),
        it.danger ? null : h('span', { class: 'chevron' })
      ]);
    }));
    ctl = sheet({ title: o.title, content: [list, h('div', { style: 'height:10px' }), h('button', { class: 'btn btn--block', text: '取消', onClick: function () { ctl.close(); } })] });
    return ctl;
  }

  function menu(items, opt) {
    opt = opt || {};
    var el = h('div', { class: 'menu', role: 'menu' });
    var activeIndex = -1;
    function rows() { return Array.prototype.slice.call(el.querySelectorAll('.menu__item')); }
    function setActive(i) {
      var r = rows(); if (!r.length) return;
      activeIndex = (i + r.length) % r.length;
      r.forEach(function (n, idx) { n.classList.toggle('is-active', idx === activeIndex); });
    }
    (items || []).forEach(function (it) {
      if (it.sep) { el.appendChild(h('div', { class: 'menu__sep' })); return; }
      var row = h('div', { class: 'menu__item' + (it.danger ? ' menu__item--danger' : ''), role: 'menuitem', tabindex: '-1' }, [
        h('span', { class: 'menu__icon' }, it.icon ? renderIcon(it.icon, 16) : null),
        h('span', { class: 'menu__label', text: it.label }),
        it.hint ? h('span', { class: 'kbd', text: it.hint }) : null
      ]);
      row.addEventListener('click', function () { close(); if (it.onClick) it.onClick(); });
      row.addEventListener('mouseenter', function () { setActive(rows().indexOf(row)); });
      el.appendChild(row);
    });
    overlay.appendChild(el);
    function place(x, y) {
      var r = el.getBoundingClientRect();
      el.style.left = util.clamp(x, 8, innerWidth - r.width - 8) + 'px';
      el.style.top = util.clamp(y, 8, innerHeight - r.height - 8) + 'px';
    }
    if (opt.at) {
      var a = opt.at.getBoundingClientRect();
      el.style.left = a.left + 'px';
      el.style.top = (a.bottom + 6) + 'px';
      requestAnimationFrame(function () { place(a.left, a.bottom + 6); });
    } else place(opt.x || 0, opt.y || 0);
    requestAnimationFrame(function () { el.classList.add('is-in'); setActive(0); });
    function onDoc(e) { if (!el.contains(e.target)) close(); }
    function onKey(e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(activeIndex + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(activeIndex - 1); }
      else if (e.key === 'Enter') { e.preventDefault(); var r = rows()[activeIndex]; if (r) r.click(); }
    }
    setTimeout(function () { document.addEventListener('pointerdown', onDoc, true); }, 0);
    document.addEventListener('keydown', onKey);
    var closed = false;
    function close() { if (closed) return; closed = true; el.classList.remove('is-in'); popEsc(close); document.removeEventListener('pointerdown', onDoc, true); document.removeEventListener('keydown', onKey); setTimeout(function () { el.remove(); }, 180); }
    pushEsc(close);
    return { el: el, close: close };
  }

  var loading = {
    _el: null,
    show: function (text) {
      if (!loading._el) {
        loading._el = h('div', { class: 'layer-loading' }, [h('span', { class: 'spinner' }), h('span', { text: text || '处理中…' })]);
        layer.appendChild(loading._el);
      } else loading._el.lastChild.textContent = text || '处理中…';
      return function () { loading.hide(); };
    },
    hide: function () { if (loading._el) { loading._el.remove(); loading._el = null; } }
  };

  MUI.overlay = { toast: toast, notify: notify, modal: modal, confirm: confirm, prompt: prompt, sheet: sheet, actionSheet: actionSheet, menu: menu, loading: loading };

  /* ======================================================================
     Tooltips (delegated)
     ====================================================================== */
  var tipEl = $('tooltip'), tipTimer, tipTarget;
  function showTip(target) {
    var text = target.getAttribute('data-tip'); if (!text) return;
    tipTarget = target;
    tipEl.textContent = text;
    tipEl.hidden = false;
    var r = target.getBoundingClientRect(), tr = tipEl.getBoundingClientRect();
    var side = target.getAttribute('data-tip-side') || 'top';
    var top = side === 'bottom' ? r.bottom + 8 : r.top - tr.height - 8;
    var left = util.clamp(r.left + r.width / 2 - tr.width / 2, 8, innerWidth - tr.width - 8);
    tipEl.style.left = left + 'px';
    tipEl.style.top = util.clamp(top, 8, innerHeight - tr.height - 8) + 'px';
    requestAnimationFrame(function () { tipEl.classList.add('is-in'); });
  }
  function hideTip() { clearTimeout(tipTimer); tipTarget = null; tipEl.classList.remove('is-in'); setTimeout(function () { if (!tipTarget) tipEl.hidden = true; }, 140); }
  document.addEventListener('mouseover', function (e) {
    var t = e.target.closest && e.target.closest('[data-tip]');
    if (!t || t === tipTarget) return;
    clearTimeout(tipTimer);
    tipTimer = setTimeout(function () { showTip(t); }, 260);
  });
  document.addEventListener('mouseout', function (e) {
    var t = e.target.closest && e.target.closest('[data-tip]');
    if (t) hideTip();
  });
  document.addEventListener('focusin', function (e) { var t = e.target.closest && e.target.closest('[data-tip]'); if (t) showTip(t); });
  document.addEventListener('focusout', hideTip);
  document.addEventListener('scroll', hideTip, true);

  /* ======================================================================
     Command palette
     ====================================================================== */
  var CMDK = {
    el: null,
    open: function () {
      if (CMDK.el) return;
      var input = h('input', { class: 'palette__input', placeholder: '搜索页面、命令或操作…', 'aria-label': '命令搜索', spellcheck: 'false' });
      var list = h('div', { class: 'palette__list' });
      var mask = h('div', { class: 'palette-mask', onClick: function (e) { if (e.target === mask) close(); } },
        h('div', { class: 'palette', role: 'dialog' }, [
          h('div', { class: 'palette__bar' }, [h('span', { class: 'faint' }, icon('search', 18)), input, h('span', { class: 'kbd', text: 'Esc' })]),
          list
        ]));
      document.body.appendChild(mask);
      CMDK.el = mask;
      requestAnimationFrame(function () { mask.classList.add('is-in'); });
      var release = MUI.trapFocus(mask);
      input.focus();
      var results = [], active = 0;
      function paint() {
        MUI.clear(list);
        if (!results.length) { list.appendChild(h('div', { class: 'palette__empty', text: '没有匹配的结果' })); return; }
        var lastGroup = null;
        results.forEach(function (cmd, i) {
          var group = cmd.group || '通用';
          if (group !== lastGroup) { list.appendChild(h('div', { class: 'palette__group', text: group })); lastGroup = group; }
          var row = h('div', { class: 'palette__item' + (i === active ? ' is-active' : ''), onClick: function () { run(cmd); }, onPointermove: function () { if (active !== i) { active = i; paint(); } } }, [
            h('span', { class: 'palette__icon' }, renderIcon(cmd.icon, 18)),
            h('div', { class: 'palette__main' }, [
              h('div', { class: 'palette__title', text: cmd.title }),
              cmd.subtitle ? h('div', { class: 'palette__sub', text: cmd.subtitle }) : null
            ]),
            cmd.keybinding ? h('span', { class: 'kbd', text: MUI.keys.format(cmd.keybinding) }) : null
          ]);
          list.appendChild(row);
        });
      }
      function update(q) {
        var res = MUI.commands.search(q);
        if (!String(q || '').trim()) {
          var seen = {};
          var recents = MUI.commands.recent().map(function (c) {
            seen[c.id] = 1;
            return Object.assign({}, c, { group: '最近', keywords: (c.keywords || '') + ' recent' });
          });
          res = recents.concat(res.filter(function (c) { return !seen[c.id]; }));
        }
        results = res.slice(0, 60);
        active = 0; paint();
      }
      function run(cmd) { close(); setTimeout(function () { MUI.commands.run(cmd); }, 50); }
      input.addEventListener('input', function () { update(input.value); });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, results.length - 1); paint(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(active - 1, 0); paint(); }
        else if (e.key === 'Enter') { e.preventDefault(); if (results[active]) run(results[active]); }
      });
      function close() { popEsc(close); release(); mask.classList.remove('is-in'); setTimeout(function () { mask.remove(); }, 180); CMDK.el = null; }
      pushEsc(close);
      update('');
    },
    close: function () { if (CMDK.el) { CMDK.el.click(); } }
  };
  MUI.palette = CMDK;

  MUI.uiCore = { toast: toast, notify: notify, modal: modal, confirm: confirm, prompt: prompt, sheet: sheet, menu: menu };
})(window.MUI = window.MUI || {});
