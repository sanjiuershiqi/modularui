/* ==========================================================================
   widgets.js — forms, data display, charts, navigation
   ========================================================================== */
(function (MUI) {
  'use strict';
  var h = MUI.h, svg = MUI.svg, icon = MUI.icon, renderIcon = MUI.renderIcon, def = MUI.defineComponent;
  var cn = MUI.classNames, util = MUI.util;
  var kids = function (p) { return p.children || []; };

  /* ======================================================================
     Forms
     ====================================================================== */
  def('field', function (p) {
    return h('label', { class: cn('field', p.className) }, [
      p.label ? h('span', { class: 'field__label', text: p.label }) : null,
      h('span', { class: 'field__control' }, p.control || p.children),
      p.hint ? h('span', { class: 'field__hint', text: p.hint }) : null
    ]);
  });
  def('input', function (p) {
    var el = h('input', {
      class: cn('input', p.flush && 'input--flush', p.className), type: p.type || 'text',
      value: p.value != null ? p.value : '', placeholder: p.placeholder || '',
      'aria-label': p.label || p.placeholder || '输入', autocomplete: p.autocomplete || 'off',
      inputmode: p.inputmode, spellcheck: 'false'
    });
    if (p.onInput) el.addEventListener('input', function (e) { p.onInput(e.target.value, e); });
    if (p.onChange) el.addEventListener('change', function (e) { p.onChange(e.target.value, e); });
    if (p.onEnter) el.addEventListener('keydown', function (e) { if (e.key === 'Enter') p.onEnter(el.value, e); });
    return el;
  });
  def('textarea', function (p) {
    var el = h('textarea', { class: cn('textarea', p.className), rows: p.rows || 4, placeholder: p.placeholder || '', 'aria-label': p.label || '文本' });
    el.value = p.value != null ? p.value : '';
    if (p.onInput) el.addEventListener('input', function (e) { p.onInput(e.target.value, e); });
    return el;
  });
  def('searchInput', function (p) {
    var input = h('input', { value: p.value || '', placeholder: p.placeholder || '搜索…', 'aria-label': p.placeholder || '搜索' });
    if (p.onInput) input.addEventListener('input', function (e) { p.onInput(e.target.value, e); });
    return h('div', { class: cn('searchbox', p.className) }, [icon('search', 15), input, p.shortcut ? h('span', { class: 'kbd', text: p.shortcut }) : null]);
  });

  function openListbox(trigger, options, value, onSelect) {
    var valOf = function (o) { return o.value != null ? o.value : o; };
    var el = h('div', { class: 'listbox', role: 'listbox' });
    var rowEls = [];
    var active = 0;
    options.forEach(function (o, i) { if (valOf(o) === value) active = i; });

    function paint() {
      MUI.clear(el); rowEls = [];
      if (!options.length) { el.appendChild(h('div', { class: 'listbox__empty', text: '无可选项' })); return; }
      var lastGroup = null;
      options.forEach(function (opt, i) {
        if (opt.group && opt.group !== lastGroup) { el.appendChild(h('div', { class: 'listbox__opt-group', text: opt.group })); lastGroup = opt.group; }
        var row = h('div', { class: 'listbox__opt', role: 'option', 'aria-selected': String(valOf(opt) === value) }, [
          opt.icon ? renderIcon(opt.icon, 15) : null,
          h('span', { style: 'flex:1', text: opt.label != null ? opt.label : String(opt) }),
          valOf(opt) === value ? h('span', { class: 'listbox__opt-check' }, icon('check', 14)) : null
        ]);
        row.addEventListener('mouseenter', function () { active = i; mark(); });
        row.addEventListener('click', function () { close(); onSelect(valOf(opt)); });
        el.appendChild(row); rowEls.push(row);
      });
      mark();
    }
    function mark() {
      rowEls.forEach(function (n, i) {
        n.classList.toggle('is-active', i === active);
        n.classList.toggle('is-selected', valOf(options[i]) === value);
      });
      if (rowEls[active] && rowEls[active].scrollIntoView) rowEls[active].scrollIntoView({ block: 'nearest' });
    }

    document.body.appendChild(el);
    paint();
    el.style.minWidth = Math.max(200, trigger.getBoundingClientRect().width) + 'px';
    var r = trigger.getBoundingClientRect();
    var ew = el.offsetWidth, eh = el.offsetHeight;
    var left = util.clamp(r.left, 8, Math.max(8, window.innerWidth - ew - 8));
    var top = (r.bottom + 6 + eh > window.innerHeight - 8 && r.top - eh - 6 > 8) ? (r.top - eh - 6) : (r.bottom + 6);
    el.style.left = left + 'px';
    el.style.top = util.clamp(top, 8, Math.max(8, window.innerHeight - eh - 8)) + 'px';
    requestAnimationFrame(function () { el.classList.add('is-in'); });

    function onKey(e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, options.length - 1); mark(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(active - 1, 0); mark(); }
      else if (e.key === 'Home') { e.preventDefault(); active = 0; mark(); }
      else if (e.key === 'End') { e.preventDefault(); active = options.length - 1; mark(); }
      else if (e.key === 'Enter') { e.preventDefault(); if (options[active]) { close(); onSelect(valOf(options[active])); } }
    }
    function onDoc(e) { if (!el.contains(e.target) && e.target !== trigger) close(); }
    document.addEventListener('keydown', onKey);
    setTimeout(function () { document.addEventListener('pointerdown', onDoc, true); }, 0);
    var closed = false;
    function close() { if (closed) return; closed = true; el.classList.remove('is-in'); document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onDoc, true); setTimeout(function () { el.remove(); }, 160); }
    return { close: close };
  }

  def('select', function (p) {
    var options = (p.options || []).map(function (o) { return typeof o === 'string' ? { label: o, value: o } : o; });
    var current = p.value;
    var valueEl = h('span', { class: 'select-trigger__value' });
    function labelFor(v) {
      var f = options.filter(function (o) { return o.value === v; })[0];
      return f ? f.label : (p.placeholder || '请选择');
    }
    valueEl.textContent = String(labelFor(current));
    var trigger = h('button', {
      class: cn('select-trigger', p.className), type: 'button', 'aria-haspopup': 'listbox', 'aria-expanded': 'false'
    }, [
      p.icon ? h('span', { style: 'display:flex;color:var(--text-3)' }, renderIcon(p.icon, 15)) : null,
      valueEl,
      h('span', { class: 'select-trigger__chev' }, icon('chevronDown', 14))
    ]);
    trigger.addEventListener('click', function () {
      trigger.setAttribute('aria-expanded', 'true');
      var lb = openListbox(trigger, options, current, function (v) {
        current = v; trigger.setAttribute('aria-expanded', 'false'); valueEl.textContent = String(labelFor(v));
        if (p.onChange) p.onChange(v);
      });
      var origClose = lb.close;
      lb.close = function () { trigger.setAttribute('aria-expanded', 'false'); origClose(); };
    });
    return trigger;
  });

  def('switch', function (p) {
    var on = !!p.checked;
    var el = h('span', { class: 'switch' + (on ? ' is-on' : ''), role: 'switch', tabindex: '0', 'aria-checked': String(on) },
      h('span', { class: 'switch__knob' }));
    function toggle() { on = !on; el.classList.toggle('is-on', on); el.setAttribute('aria-checked', String(on)); if (p.onChange) p.onChange(on); }
    el.addEventListener('click', toggle);
    el.addEventListener('keydown', function (e) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(); } });
    return el;
  });
  def('switchRow', function (p) {
    return h('div', { class: cn('listitem', p.className) }, [
      p.icon ? h('span', { class: 'listitem__icon' }, renderIcon(p.icon, 16)) : null,
      h('div', { class: 'listitem__main' }, [
        h('div', { class: 'listitem__title', text: p.title || '' }),
        p.subtitle ? h('div', { class: 'listitem__sub', text: p.subtitle }) : null
      ]),
      MUI.ui.switch({ checked: p.checked, onChange: p.onChange })
    ]);
  });
  def('checkbox', function (p) {
    var on = !!p.checked;
    var el = h('div', { class: 'check' + (on ? ' is-on' : ''), role: 'checkbox', tabindex: '0' }, [
      h('span', { class: 'check__box' }, icon('check', 13, 2.6)),
      h('span', { class: 'check__main' }, [
        h('span', { text: p.label || p.title || '' }),
        p.subtitle ? h('span', { class: 'check__sub', text: p.subtitle }) : null
      ])
    ]);
    function toggle() { on = !on; el.classList.toggle('is-on', on); if (p.onChange) p.onChange(on); }
    el.addEventListener('click', toggle);
    el.addEventListener('keydown', function (e) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(); } });
    return el;
  });
  def('radioGroup', function (p) {
    var rows = [];
    (p.options || []).forEach(function (opt) {
      var val = typeof opt === 'string' ? opt : opt.value;
      var label = typeof opt === 'string' ? opt : (opt.label || opt.value);
      var row = h('div', { class: 'check check--radio' + (String(val) === String(p.value) ? ' is-on' : ''), role: 'radio', tabindex: '0' }, [
        h('span', { class: 'check__box' }, h('span', { class: 'check__dot' })),
        h('span', { class: 'check__main' }, [
          h('span', { text: String(label) }),
          (typeof opt === 'object' && opt.subtitle) ? h('span', { class: 'check__sub', text: opt.subtitle }) : null
        ])
      ]);
      function select() {
        rows.forEach(function (r) { r.classList.remove('is-on'); });
        row.classList.add('is-on');
        if (p.onChange) p.onChange(val);
      }
      row.addEventListener('click', select);
      row.addEventListener('keydown', function (e) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); select(); } });
      rows.push(row);
    });
    return h('div', { class: 'stack', style: 'gap:11px' }, rows);
  });
  def('slider', function (p) {
    var unit = p.unit || '';
    var val = h('span', { class: 'slider__value', text: String(p.value != null ? p.value : 0) + unit });
    var input = h('input', {
      type: 'range', min: p.min != null ? p.min : 0, max: p.max != null ? p.max : 100,
      step: p.step != null ? p.step : 1, value: p.value != null ? p.value : 0, 'aria-label': p.label || '滑块'
    });
    input.addEventListener('input', function (e) { val.textContent = e.target.value + unit; if (p.onInput) p.onInput(Number(e.target.value)); });
    return h('div', { class: 'slider' }, [input, val]);
  });
  def('stepper', function (p) {
    var value = Number(p.value) || 0;
    var min = p.min != null ? p.min : -Infinity, max = p.max != null ? p.max : Infinity, step = p.step || 1;
    var label = h('span', { class: 'stepper__value', text: String(value) });
    function set(v) { value = util.clamp(v, min, max); label.textContent = String(value); if (p.onChange) p.onChange(value); }
    var dec = h('button', { type: 'button', text: '−' }), inc = h('button', { type: 'button', text: '+' });
    dec.addEventListener('click', function () { set(value - step); });
    inc.addEventListener('click', function () { set(value + step); });
    return h('span', { class: 'stepper' }, [dec, label, inc]);
  });

  /* ======================================================================
     Data
     ====================================================================== */
  def('table', function (p) {
    var columns = p.columns || [];
    var rows = (p.rows || []).slice();
    var sortKey = p.defaultSort || null, sortDir = 1;
    var tbody = h('tbody');
    var table = h('table', { class: 'table' });
    var thead = h('thead');
    function buildHead() {
      MUI.clear(thead);
      var tr = h('tr');
      columns.forEach(function (c) {
        var canSort = p.sortable !== false && c.sortable !== false;
        var th = h('th', { class: canSort ? 'sortable' : '' }, [
          h('span', { text: c.label }),
          canSort ? h('span', { class: 'table__sort' }, icon(sortKey === c.key ? (sortDir > 0 ? 'chevronUp' : 'chevronDown') : 'chevronsUpDown', 12)) : null
        ]);
        if (c.width) th.style.width = c.width;
        if (canSort) th.addEventListener('click', function () {
          if (sortKey === c.key) sortDir *= -1; else { sortKey = c.key; sortDir = 1; }
          applySort(); buildHead(); paint();
        });
        tr.appendChild(th);
      });
      thead.appendChild(tr);
    }
    function value(row, c) { return Array.isArray(row) ? row[columns.indexOf(c)] : util.getPath(row, c.key); }
    function applySort() {
      if (!sortKey) return;
      var col = columns.filter(function (c) { return c.key === sortKey; })[0];
      if (!col) return;
      rows.sort(function (a, b) {
        var av = value(a, col), bv = value(b, col);
        if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * sortDir;
        return String(av).localeCompare(String(bv), 'zh') * sortDir;
      });
    }
    function paint() {
      MUI.clear(tbody);
      if (!rows.length) {
        tbody.appendChild(h('tr', {}, h('td', { colspan: columns.length, style: 'padding:0' }, MUI.ui.empty({ icon: 'table', title: '暂无数据' }))));
        return;
      }
      rows.forEach(function (row) {
        var tr = h('tr');
        columns.forEach(function (c) {
          var v = value(row, c);
          var td = h('td', { style: c.align ? 'text-align:' + c.align : null });
          if (c.render) { var r = c.render(v, row); td.appendChild(util.isNode(r) ? r : h('span', { text: String(r == null ? '' : r) })); }
          else if (util.isNode(v)) td.appendChild(v);
          else td.textContent = v == null ? '' : String(v);
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
    }
    applySort(); buildHead(); paint();
    table.appendChild(thead); table.appendChild(tbody);
    return h('div', { class: cn('tablewrap', p.className) }, table);
  });

  def('progress', function (p) {
    var max = p.max || 100;
    var pct = util.clamp(Math.round(((p.value || 0) / max) * 100), 0, 100);
    return h('div', { class: 'progress' + (p.thin ? ' progress--thin' : '') }, [
      (p.label || p.showValue) ? h('div', { class: 'progress__meta' }, [h('span', { text: p.label || '' }), p.showValue !== false ? h('span', { text: pct + '%' }) : null]) : null,
      h('div', { class: 'progress__track' }, h('div', { class: 'progress__bar', style: 'width:' + pct + '%' }))
    ]);
  });

  def('ring', function (p) {
    var size = p.size || 72, sw = p.stroke || 6, r = size / 2 - sw / 2 - 1, c = 2 * Math.PI * r;
    var pct = util.clamp(p.value || 0, 0, 100);
    var el = svg('svg', { width: size, height: size, viewBox: '0 0 ' + size + ' ' + size });
    var track = svg('circle', { cx: size / 2, cy: size / 2, r: r, 'stroke-width': sw, style: 'fill:none;stroke:var(--surface-3)' });
    var bar = svg('circle', {
      cx: size / 2, cy: size / 2, r: r, 'stroke-width': sw,
      'stroke-linecap': 'round', 'stroke-dasharray': c, 'stroke-dashoffset': c * (1 - pct / 100),
      transform: 'rotate(-90 ' + size / 2 + ' ' + size / 2 + ')',
      style: 'fill:none;stroke:' + (p.color || 'var(--accent)')
    });
    el.appendChild(track); el.appendChild(bar);
    return h('div', { class: 'ring' }, [el, h('span', { class: 'ring__value', text: p.label != null ? p.label : pct + '%' })]);
  });

  def('sparkline', function (p) {
    var data = p.data || [], w = 120, hgt = 34, max = Math.max.apply(null, data.concat([1])), min = Math.min.apply(null, data.concat([0]));
    var span = max - min || 1;
    var pts = data.map(function (v, i) { return (i / Math.max(1, data.length - 1)) * w + ',' + (hgt - 3 - ((v - min) / span) * (hgt - 6)); }).join(' ');
    var el = svg('svg', { class: 'sparkline', viewBox: '0 0 ' + w + ' ' + hgt, preserveAspectRatio: 'none' });
    el.appendChild(svg('polyline', { points: pts, 'stroke-width': 1.8, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'vector-effect': 'non-scaling-stroke', style: 'fill:none;stroke:' + (p.color || 'var(--accent)') }));
    return el;
  });

  def('areaChart', function (p) {
    var data = p.data || [], labels = p.labels || [], w = 600, hgt = p.height || 180, pad = 8;
    var max = Math.max.apply(null, data.concat([1])), min = Math.min.apply(null, data.concat([0]));
    var span = max - min || 1;
    var uid = util.uid('grad');
    function x(i) { return pad + (i / Math.max(1, data.length - 1)) * (w - pad * 2); }
    function y(v) { return hgt - pad - ((v - min) / span) * (hgt - pad * 2); }
    var line = data.map(function (v, i) { return x(i) + ',' + y(v); });
    var area = line.concat([x(data.length - 1) + ',' + (hgt - pad), x(0) + ',' + (hgt - pad)]);
    var el = svg('svg', { class: 'chart', viewBox: '0 0 ' + w + ' ' + hgt, preserveAspectRatio: 'none', style: 'height:' + hgt + 'px' });
    var defs = svg('defs');
    var grad = svg('linearGradient', { id: uid, x1: 0, y1: 0, x2: 0, y2: 1 });
    grad.appendChild(svg('stop', { offset: '0%', 'stop-opacity': .34, style: 'stop-color:var(--accent)' }));
    grad.appendChild(svg('stop', { offset: '100%', 'stop-opacity': 0, style: 'stop-color:var(--accent)' }));
    defs.appendChild(grad); el.appendChild(defs);
    for (var g = 0; g <= 3; g++) el.appendChild(svg('line', { class: 'chart__grid', x1: 0, x2: w, y1: pad + g * ((hgt - pad * 2) / 3), y2: pad + g * ((hgt - pad * 2) / 3), 'vector-effect': 'non-scaling-stroke' }));
    el.appendChild(svg('polygon', { points: area.join(' '), fill: 'url(#' + uid + ')' }));
    el.appendChild(svg('polyline', { class: 'chart__line', points: line.join(' '), 'vector-effect': 'non-scaling-stroke' }));
    if (data.length) el.appendChild(svg('circle', { class: 'chart__dot', cx: x(data.length - 1), cy: y(data[data.length - 1]), r: 3.4, 'vector-effect': 'non-scaling-stroke' }));
    return h('div', { style: 'width:100%' }, [el, labels.length ? h('div', { class: 'row', style: 'justify-content:space-between;margin-top:6px' }, labels.map(function (l) { return h('span', { class: 'faint', style: 'font-family:var(--mono);font-size:var(--fs-2xs)', text: l }); })) : null]);
  });

  def('barChart', function (p) {
    var data = p.data || [], labels = p.labels || [], w = 600, hgt = p.height || 170, gap = 8, pad = 6;
    var max = Math.max.apply(null, data.concat([1]));
    var bw = (w - pad * 2 - gap * (data.length - 1)) / Math.max(1, data.length);
    var el = svg('svg', { class: 'chart', viewBox: '0 0 ' + w + ' ' + hgt, preserveAspectRatio: 'none', style: 'height:' + hgt + 'px' });
    data.forEach(function (v, i) {
      var bh = Math.max(2, (v / max) * (hgt - pad * 2));
      var x = pad + i * (bw + gap), y = hgt - pad - bh;
      el.appendChild(svg('rect', { class: 'chart__bar' + (p.highlight != null && i !== p.highlight ? ' chart__bar--muted' : ''), x: x, y: y, width: bw, height: bh, rx: Math.min(4, bw / 2) }));
    });
    return h('div', { style: 'width:100%' }, [el, labels.length ? h('div', { class: 'row', style: 'justify-content:space-between;margin-top:6px' }, labels.map(function (l) { return h('span', { class: 'faint', style: 'font-family:var(--mono);font-size:var(--fs-2xs)', text: l }); })) : null]);
  });

  def('donut', function (p) {
    var segments = p.segments || [], size = p.size || 120, sw = p.stroke || 13, r = size / 2 - sw / 2 - 1, c = 2 * Math.PI * r;
    var total = util.sum(segments.map(function (s) { return s.value; })) || 1;
    var el = svg('svg', { width: size, height: size, viewBox: '0 0 ' + size + ' ' + size, style: 'transform:rotate(-90deg)' });
    el.appendChild(svg('circle', { cx: size / 2, cy: size / 2, r: r, 'stroke-width': sw, style: 'fill:none;stroke:var(--surface-3)' }));
    var offset = 0;
    segments.forEach(function (s) {
      var len = (s.value / total) * c;
      el.appendChild(svg('circle', {
        cx: size / 2, cy: size / 2, r: r, 'stroke-width': sw,
        'stroke-dasharray': len + ' ' + (c - len), 'stroke-dashoffset': -offset, 'stroke-linecap': 'round',
        style: 'fill:none;stroke:' + (s.color || 'var(--accent)')
      }));
      offset += len;
    });
    return h('div', { class: 'row', style: 'gap:18px' }, [
      h('div', { class: 'ring' }, [el, p.center ? h('span', { class: 'ring__value', text: p.center }) : null]),
      h('div', { class: 'legend', style: 'flex-direction:column;gap:8px' }, segments.map(function (s) {
        return h('div', { class: 'legend__item' }, [
          h('span', { class: 'legend__swatch', style: { background: s.color || 'var(--accent)' } }),
          h('span', { text: s.label }),
          h('span', { class: 'faint', style: 'margin-left:auto;font-family:var(--mono)', text: s.value })
        ]);
      }))
    ]);
  });

  def('timeline', function (p) {
    return h('div', { class: 'timeline' }, (p.items || []).map(function (it) {
      return h('div', { class: 'timeline__item' }, [
        h('span', { class: 'timeline__dot' }, renderIcon(it.icon || 'dot', 13)),
        h('div', { class: 'timeline__body' }, [
          h('div', { class: 'row', style: 'justify-content:space-between;gap:10px' }, [
            h('div', { class: 'timeline__title', text: it.title }),
            it.time ? h('div', { class: 'timeline__time', text: it.time }) : null
          ]),
          it.desc ? h('div', { class: 't-caption', style: 'margin-top:2px', text: it.desc }) : null
        ])
      ]);
    }));
  });

  /* ======================================================================
     Navigation
     ====================================================================== */
  def('tabs', function (p) {
    var items = p.items || [];
    function val(it) { return it.value != null ? it.value : it.label; }
    var active = p.value != null ? p.value : (items[0] ? val(items[0]) : null);
    var strip = h('div', { class: 'tabs__strip' });
    var pane = h('div', { class: 'tabs__pane' });
    function paint() {
      MUI.clear(strip); MUI.clear(pane);
      items.forEach(function (it) {
        var tab = h('div', { class: 'tabs__tab' + (val(it) === active ? ' is-active' : ''), text: it.label });
        tab.addEventListener('click', function () { active = val(it); paint(); if (p.onChange) p.onChange(active); });
        strip.appendChild(tab);
      });
      var cur = items.filter(function (it) { return val(it) === active; })[0] || items[0];
      if (cur) { var content = typeof cur.render === 'function' ? cur.render() : cur.content; if (content) pane.appendChild(util.isNode(content) ? content : h('div', {}, content)); }
    }
    paint();
    return h('div', { class: cn('tabs', p.className), id: p.id }, [strip, pane]);
  });

  def('collapse', function (p) {
    var inner = h('div', { class: 'collapse__content' }, p.content || kids(p));
    var body = h('div', { class: 'collapse__body' }, h('div', { class: 'collapse__inner' }, inner));
    var el = h('div', { class: 'collapse' + (p.open ? ' is-open' : '') }, [
      h('div', { class: 'collapse__head' }, [
        p.icon ? h('span', { class: 'listitem__icon' }, renderIcon(p.icon, 15)) : null,
        h('div', { class: 'collapse__title' }, [
          h('div', { text: p.title || '' }),
          p.subtitle ? h('div', { class: 'listitem__sub', text: p.subtitle }) : null
        ]),
        h('span', { class: 'collapse__chev' }, icon('chevronRight', 16))
      ]),
      body
    ]);
    el.firstChild.addEventListener('click', function () {
      var open = el.classList.toggle('is-open');
      if (p.onChange) p.onChange(open);
    });
    return el;
  });
})(window.MUI = window.MUI || {});
