/* ==========================================================================
   primitives.js — layout, typography, buttons, badges, surfaces, lists
   ========================================================================== */
(function (MUI) {
  'use strict';
  var h = MUI.h, icon = MUI.icon, renderIcon = MUI.renderIcon, def = MUI.defineComponent;
  var cn = MUI.classNames;
  var kids = function (p) { var c = p.children; return c == null ? [] : (Array.isArray(c) ? c : [c]); };

  /* ---------------------------------------------------------------- layout */
  def('stack', function (p) {
    return h('div', { class: cn('stack', p.className), style: Object.assign({ gap: p.gap }, p.style) }, kids(p));
  });
  def('row', function (p) {
    return h('div', { class: cn('row', p.wrap && 'row-wrap', p.className), style: Object.assign({ gap: p.gap, justifyContent: p.justify, alignItems: p.align }, p.style) }, kids(p));
  });
  def('grid', function (p) {
    var style = Object.assign({ gap: p.gap }, p.style);
    if (p.min) style.gridTemplateColumns = 'repeat(auto-fit,minmax(' + p.min + ',1fr))';
    else if (p.cols) style.gridTemplateColumns = 'repeat(' + p.cols + ',minmax(0,1fr))';
    return h('div', { class: cn('grid', p.className), style: style }, kids(p));
  });
  def('masonry', function (p) {
    var min = parseInt(p.min, 10) || 300;
    var el = h('div', { class: cn('masonry', p.className), style: p.style });
    var cols = [];
    function width() {
      var n = el;
      while (n && !n.clientWidth) n = n.parentElement;
      return (n && n.clientWidth) || 1000;
    }
    function count() { return Math.max(1, Math.min(4, Math.floor((width() + 12) / (min + 12)))); }
    function build(n) {
      MUI.clear(el); cols = [];
      for (var i = 0; i < n; i++) cols.push(el.appendChild(h('div', { class: 'masonry__col' })));
      /* round-robin so nothing piles up while detached */
      kids(p).forEach(function (item, idx) { cols[idx % n].appendChild(item); });
    }
    var lastW = 0;
    /* once attached we can measure real heights and pack by shortest column */
    function distribute() {
      if (!el.isConnected || cols.length < 2) return;
      var items = kids(p).filter(function (x) { return x && x.remove; });
      items.forEach(function (it) { it.remove(); });
      items.forEach(function (it) {
        var shortest = cols.reduce(function (a, b) { return a.scrollHeight <= b.scrollHeight ? a : b; });
        shortest.appendChild(it);
      });
    }
    function relayout() {
      if (!el.isConnected) return;
      lastW = Math.round(width());
      var n = count();
      if (n !== cols.length) build(n);
      distribute();
    }
    build(count());
    requestAnimationFrame(relayout);
    setTimeout(relayout, 60);
    if (window.ResizeObserver) {
      var raf = 0;
      var ro = new ResizeObserver(function () {
        if (!el.isConnected) { ro.disconnect(); return; }
        if (Math.round(width()) === lastW) return; /* ignore height-only changes */
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(relayout);
      });
      ro.observe(el);
    }
    return el;
  });
  def('rail', function (p) {
    return h('div', { class: cn('rail', p.className), style: Object.assign({ height: (p.height || 3) + 'px' }, p.style) });
  });
  def('stripeBar', function (p) {
    return h('div', { class: cn('stripebar', p.className) }, [
      h('span', { class: 'stripebar__hatch' }),
      h('span', { class: 'stripebar__line' }),
      h('span', { class: 'stripebar__nodes' }, [h('i'), h('i'), h('i')])
    ]);
  });
  def('spacer', function () { return h('div', { class: 'spacer' }); });
  def('divider', function (p) { return h('hr', { class: cn('divider', p.className), style: p.style }); });
  def('rule', function (p) {
    return h('div', { class: cn('rule', p.tight && 'rule--tight', p.className), style: p.style }, [
      h('span', { class: 'rule__node' + (p.tone ? ' rule__node--' + p.tone : '') }),
      h('span', { class: 'rule__line' }),
      h('span', { class: 'rule__node' + (p.tone2 ? ' rule__node--' + p.tone2 : (p.tone ? '' : '')) })
    ]);
  });
  def('box', function (p) { return h('div', { class: p.className, style: p.style }, kids(p)); });

  /* ---------------------------------------------------------------- type */
  def('heading', function (p) {
    return h(p.level === 1 ? 'h1' : p.level === 2 ? 'h2' : 'h3', { class: p.className || ('t-h' + (p.level || 2)), text: p.text }, kids(p));
  });
  def('text', function (p) {
    var cls = p.className || (p.variant === 'lead' ? 't-lead' : p.variant === 'body' ? 't-body' : p.variant === 'caption' ? 't-caption' : p.variant === 'eyebrow' ? 't-eyebrow' : p.variant === 'mono' ? 'mono' : p.muted ? 'dim' : '');
    var el = p.as || 'div';
    return h(el, { class: cls, style: p.style, text: p.text != null ? String(p.text) : undefined }, p.text == null ? kids(p) : []);
  });
  def('kbd', function (p) { return h('span', { class: 'kbd', text: p.text }); });
  def('code', function (p) { return h('code', { class: 'inline', text: p.text != null ? String(p.text) : '' }); });
  def('codeblock', function (p) {
    var raw = String(p.code || '');
    var copy = h('button', { class: 'codeblock__copy', type: 'button' }, [icon('copy', 12), h('span', { text: '复制' })]);
    copy.addEventListener('click', function () {
      MUI.util.copy(raw).then(function (ok) {
        copy.lastChild.textContent = ok ? '已复制' : '失败';
        setTimeout(function () { copy.lastChild.textContent = '复制'; }, 1200);
      });
    });
    return h('div', { class: 'codeblock' }, [
      h('div', { class: 'codeblock__head' }, [h('span', { class: 'codeblock__lang', text: p.lang || 'js' }), copy]),
      h('pre', {}, h('code', { html: MUI.util.escapeHtml(raw) }))
    ]);
  });

  /* ---------------------------------------------------------------- buttons */
  def('button', function (p) {
    var el = h('button', {
      class: cn('btn', 'btn--' + (p.variant || 'default'), p.size && 'btn--' + p.size, p.block && 'btn--block', p.iconOnly && 'btn--icon-only', p.className),
      type: p.type || 'button', disabled: !!p.disabled, title: p.title, style: p.style
    }, [
      p.icon ? h('span', { style: 'display:flex' }, renderIcon(p.icon, p.size === 'sm' ? 13 : 15)) : null,
      p.label != null ? h('span', { text: String(p.label) }) : (p.text != null ? String(p.text) : ''),
      p.iconRight ? h('span', { style: 'display:flex' }, renderIcon(p.iconRight, 14)) : null
    ]);
    if (p.onClick) el.addEventListener('click', p.onClick);
    return el;
  });
  def('iconButton', function (p) {
    var el = h('button', {
      class: cn('iconbutton', p.outline && 'iconbutton--outline', p.className), type: 'button',
      title: p.title, 'aria-label': p.title || p.label, 'data-tip': p.tip, 'data-tip-side': p.tipSide, disabled: !!p.disabled
    }, renderIcon(p.icon || p.name, p.size || 18));
    if (p.onClick) el.addEventListener('click', p.onClick);
    return el;
  });
  def('buttonRow', function (p) { return h('div', { class: cn('buttonrow', p.className) }, kids(p)); });
  def('segmented', function (p) {
    var el = h('div', { class: cn('segmented', p.block && 'segmented--block', p.className) });
    (p.items || []).forEach(function (it) {
      var val = typeof it === 'string' ? it : (it.value != null ? it.value : it.label);
      var label = typeof it === 'string' ? it : (it.label != null ? it.label : it.value);
      var item = h('div', { class: 'segmented__item' + (val === p.value ? ' is-active' : '') }, [
        typeof it === 'object' && it.icon ? renderIcon(it.icon, 14) : null,
        h('span', { text: String(label) })
      ]);
      item.addEventListener('click', function () {
        el.querySelectorAll('.segmented__item').forEach(function (n) { n.classList.remove('is-active'); });
        item.classList.add('is-active');
        if (p.onChange) p.onChange(val);
      });
      el.appendChild(item);
    });
    return el;
  });

  /* ---------------------------------------------------------------- badges */
  def('badge', function (p) {
    return h('span', { class: cn('badge', 'badge--' + (p.tone || 'default'), p.className) }, [
      p.dot ? h('span', { class: 'badge__dot' }) : null,
      h('span', { text: String(p.text != null ? p.text : p.label != null ? p.label : '') })
    ]);
  });
  var STATE_TONE = { active: 'active', enabled: 'active', inactive: 'inactive', disabled: 'inactive', error: 'error', failed: 'error', warning: 'warning', pending: 'warning', loading: 'loading', resolving: 'loading', activating: 'loading', deactivating: 'warning', registered: 'inactive', resolving_: 'loading' };
  def('statusPill', function (p) {
    var tone = p.tone || STATE_TONE[p.state] || 'inactive';
    return h('span', { class: 'status-pill status-pill--' + tone }, [
      p.dot !== false ? h('span', { class: 'status-pill__dot' }) : null,
      h('span', { text: p.label || p.state || '' })
    ]);
  });
  def('chip', function (p) {
    var el = h('span', { class: cn('chip', p.active && 'is-active', p.onClick && 'chip--tap', p.className) }, [
      p.icon ? renderIcon(p.icon, 13) : null,
      h('span', { text: String(p.text || '') }),
      p.onRemove ? h('span', { class: 'chip__x', onClick: function (e) { e.stopPropagation(); p.onRemove(); } }, icon('x', 12)) : null
    ]);
    if (p.onClick) el.addEventListener('click', p.onClick);
    return el;
  });

  /* ---------------------------------------------------------------- surfaces */
  def('card', function (p) {
    var cls = cn('card', p.pad && 'card--pad', p.hover && 'card--hover', p.accent && 'card--accent', p.className);
    var hasHead = p.title || p.subtitle || p.actions;
    if (p.flush && !hasHead && !p.footer) {
      var only = h('div', { class: cls, style: p.style, id: p.id });
      kids(p).forEach(function (c) { only.appendChild(c); });
      return only;
    }
    var body = h('div', { class: cn('card__body', p.flush && 'card__body--flush') }, kids(p));
    return h('div', { class: cls, style: p.style, id: p.id }, [
      hasHead ? h('div', { class: 'card__head' }, [
        h('div', { style: 'flex:1;min-width:0' }, [
          p.title ? h('div', { class: 'card__title' }, [p.icon ? renderIcon(p.icon, 15) : null, h('span', { text: p.title })]) : null,
          p.subtitle ? h('div', { class: 'card__sub', text: p.subtitle }) : null
        ]),
        p.actions ? h('div', { class: 'row', style: 'gap:8px' }, p.actions) : null
      ]) : null,
      body,
      p.footer ? h('div', { class: 'card__foot' }, p.footer) : null
    ]);
  });
  def('section', function (p) {
    return h('section', { class: cn('section', p.className), id: p.id }, [
      (p.title || p.actions) ? h('div', { class: 'section__head' }, [
        h('div', {}, [
          h('div', { class: 'section__title' }, [p.icon ? renderIcon(p.icon, 15) : null, h('span', { text: p.title })]),
          p.desc ? h('div', { class: 'section__desc', text: p.desc }) : null
        ]),
        p.actions ? h('div', { class: 'row', style: 'gap:8px' }, p.actions) : null
      ]) : null,
      p.children,
      p.footer ? h('div', { class: 'section__foot', text: p.footer }) : null
    ]);
  });
  def('panel', function (p) { return h('div', { class: cn('panel', p.className), style: p.style }, kids(p)); });
  def('event', function (p) {
    var el = h('div', {
      class: cn('event', p.variant === 'ink' && 'event--ink', p.variant === 'accent2' && 'event--accent2', p.flat && 'event--flat', p.className),
      role: p.onClick ? 'button' : undefined, tabindex: p.onClick ? '0' : undefined
    }, [
      h('span', { class: 'event__icon' }, renderIcon(p.icon || 'sparkles', 26)),
      h('span', { class: 'event__body' }, [
        p.eyebrow ? h('span', { class: 'event__eyebrow', text: p.eyebrow }) : null,
        h('span', { class: 'event__title', text: p.title || '' }),
        p.text ? h('span', { class: 'event__text', text: p.text }) : null
      ]),
      p.cta === false ? null : h('span', { class: 'event__cta' }, renderIcon(p.ctaIcon || 'arrowRight', 20))
    ]);
    if (p.onClick) {
      el.addEventListener('click', p.onClick);
      el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); p.onClick(e); } });
    }
    return el;
  });

  /* ---------------------------------------------------------------- lists */
  def('list', function (p) {
    return h('div', { class: cn('list', p.plain && 'list--plain', p.className) },
      (p.items || []).map(function (it) { return MUI.ui.listItem(it); }).concat(kids(p)));
  });
  def('listItem', function (p) {
    var tap = !!p.onClick;
    return h('div', {
      class: cn('listitem', tap && 'listitem--tap', p.danger && 'listitem--danger', p.className),
      onClick: p.onClick, role: tap ? 'button' : undefined, tabindex: tap ? '0' : undefined
    }, [
      p.icon ? h('span', { class: 'listitem__icon' }, renderIcon(p.icon, 16)) : (p.avatar ? p.avatar : null),
      h('div', { class: 'listitem__main' }, [
        h('div', { class: 'listitem__title', text: p.title != null ? String(p.title) : '' }),
        p.subtitle ? h('div', { class: 'listitem__sub', text: String(p.subtitle) }) : null
      ]),
      p.right ? h('div', { class: 'listitem__trail' }, p.right)
        : (p.value != null ? h('div', { class: 'listitem__trail', text: String(p.value) }) : null),
      (p.chevron != null ? p.chevron : tap) ? h('span', { class: 'chevron' }) : null
    ]);
  });
  def('keyValue', function (p) {
    return h('div', {}, (p.items || []).map(function (it) {
      var k = MUI.util.isNode(it.k) ? it.k : h('span', { class: 'kv__k', text: String(it.k) });
      if (!MUI.util.isNode(it.k)) k.className = 'kv__k';
      var v = MUI.util.isNode(it.v) ? it.v : h('span', { class: 'kv__v', text: String(it.v) });
      if (!MUI.util.isNode(it.v)) v.className = 'kv__v';
      return h('div', { class: 'kv' }, [k, v]);
    }));
  });

  /* ---------------------------------------------------------------- avatars */
  def('avatar', function (p) {
    var el = h('span', { class: cn('avatar', p.size === 'sm' && 'avatar--sm', p.size === 'lg' && 'avatar--lg', p.className), style: p.color ? { background: p.color } : p.style });
    if (p.src) el.appendChild(h('img', { src: p.src, alt: p.name || '' }));
    else el.textContent = (p.name || '?').trim().slice(0, 2).toUpperCase();
    return el;
  });
  def('avatars', function (p) {
    return h('div', { class: 'avatars' }, (p.items || []).map(function (a) { return MUI.ui.avatar(a); }));
  });

  /* ---------------------------------------------------------------- feedback */
  def('spinner', function (p) { return h('span', { class: 'spinner' + (p.size === 'sm' ? ' spinner--sm' : '') }); });
  def('skeleton', function (p) {
    var lines = p.lines || 2;
    var rows = [];
    if (p.avatar) rows.push(h('div', { class: 'row' }, [
      h('div', { class: 'skeleton', style: 'width:38px;height:38px;border-radius:12px' }),
      h('div', { class: 'stack', style: 'flex:1;gap:7px' }, [h('div', { class: 'skeleton', style: 'height:11px;width:42%' }), h('div', { class: 'skeleton', style: 'height:11px;width:68%' })])
    ]));
    for (var i = 0; i < lines; i++) rows.push(h('div', { class: 'skeleton', style: 'height:' + (p.height || 12) + 'px;width:' + (i === lines - 1 ? '62%' : '100%') }));
    return h('div', { class: 'stack', style: p.style }, rows);
  });
  def('empty', function (p) {
    return h('div', { class: 'empty' }, [
      h('span', { class: 'empty__icon' }, renderIcon(p.icon || 'box', 24)),
      h('div', { class: 'empty__title', text: p.title || '暂无内容' }),
      p.desc ? h('div', { class: 'empty__desc', text: p.desc }) : null,
      p.action ? h('div', { style: 'margin-top:10px' }, p.action) : null
    ]);
  });
  def('banner', function (p) {
    var tone = p.tone || p.type || 'info';
    var iconName = p.icon || { success: 'checkCircle', warning: 'alert', danger: 'xCircle', info: 'info', accent: 'sparkles' }[tone] || 'info';
    return h('div', { class: cn('banner', 'banner--' + tone, p.className) }, [
      h('span', { class: 'banner__icon' }, renderIcon(iconName, 14)),
      h('div', { class: 'banner__body' }, [
        p.title ? h('div', { class: 'banner__title', text: p.title }) : null,
        p.text ? h('div', { class: 'banner__text', text: p.text }) : null,
        p.children && p.children.length ? h('div', { style: 'margin-top:8px' }, p.children) : null
      ]),
      p.action || null
    ]);
  });
})(window.MUI = window.MUI || {});
