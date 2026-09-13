/* ==========================================================================
   dom.js — hyperscript, svg helper, icons, focus trap, tiny DOM utils
   ========================================================================== */
(function (MUI) {
  'use strict';
  var util = MUI.util;
  var SVGNS = 'http://www.w3.org/2000/svg';
  var SVG_ONLY = new Set(['svg', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon',
    'ellipse', 'g', 'defs', 'linearGradient', 'radialGradient', 'stop', 'clipPath', 'mask',
    'use', 'pattern', 'filter']);
  var RESERVED = { key: 1, children: 1, ref: 1 };

  function appendChildren(parent, children) {
    for (var i = 0; i < children.length; i++) {
      var c = children[i];
      if (c == null || c === false || c === true || c === '') continue;
      if (Array.isArray(c)) { appendChildren(parent, c); continue; }
      if (util.isNode(c)) parent.appendChild(c);
      else parent.appendChild(document.createTextNode(String(c)));
    }
  }

  function applyProps(el, props, isSvg) {
    if (!props) return;
    for (var k in props) {
      if (RESERVED[k]) continue;
      var v = props[k];
      if (v == null || v === false) continue;

      if (k === 'style') {
        if (typeof v === 'string') el.style.cssText = v;
        else for (var s in v) { try { el.style[s] = v[s]; } catch (e) {} }
      } else if (k === 'class' || k === 'className') {
        var cls = Array.isArray(v) ? v.filter(Boolean).join(' ') : String(v);
        if (isSvg) el.setAttribute('class', cls); else el.className = cls;
      } else if (k === 'dataset') {
        for (var d in v) el.dataset[d] = v[d];
      } else if (k === 'html') {
        el.innerHTML = v;
      } else if (k === 'text') {
        el.textContent = v;
      } else if (k.charCodeAt(0) === 111 && k.charCodeAt(1) === 110 && typeof v === 'function' && k.length > 2) {
        el.addEventListener(k.slice(2).toLowerCase(), v);
      } else if (k.indexOf('aria-') === 0 || k.indexOf('data-') === 0) {
        el.setAttribute(k, v === true ? 'true' : v);
      } else if (!isSvg && k in el && !util.isObj(v) && !util.isFn(v) && k !== 'list' && k !== 'form') {
        try { el[k] = v; } catch (e) { el.setAttribute(k, v); }
      } else {
        el.setAttribute(k, v === true ? '' : v);
      }
    }
  }

  function h(tag, props) {
    var children = Array.prototype.slice.call(arguments, 2);
    if (typeof tag === 'function') {
      var p = Object.assign({}, props || {});
      p.children = children;
      return tag(p);
    }
    var isSvg = SVG_ONLY.has(tag);
    var el = isSvg ? document.createElementNS(SVGNS, tag) : document.createElement(tag);
    if (props && props.ref) {
      if (typeof props.ref === 'function') props.ref(el);
      else props.ref.current = el;
    }
    applyProps(el, props, isSvg);
    appendChildren(el, children);
    return el;
  }

  function svg(tag, props) {
    var children = Array.prototype.slice.call(arguments, 2);
    var el = document.createElementNS(SVGNS, tag);
    applyProps(el, props, true);
    appendChildren(el, children);
    return el;
  }

  function fragment() {
    var frag = document.createDocumentFragment();
    appendChildren(frag, Array.prototype.slice.call(arguments));
    return frag;
  }

  function icon(name, size, stroke) {
    var el = document.createElementNS(SVGNS, 'svg');
    el.setAttribute('viewBox', '0 0 24 24');
    el.setAttribute('width', size || 20);
    el.setAttribute('height', size || 20);
    el.setAttribute('fill', 'none');
    el.setAttribute('stroke', 'currentColor');
    el.setAttribute('stroke-width', stroke || 1.7);
    el.setAttribute('stroke-linecap', 'round');
    el.setAttribute('stroke-linejoin', 'round');
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = MUI.icons[name] || MUI.icons.dot;
    return el;
  }

  function renderIcon(x, size) {
    if (x == null || x === false || x === '') return null;
    if (util.isNode(x)) return x;
    if (typeof x === 'string') return MUI.icons[x] ? icon(x, size || 18) : h('span', { class: 'emoji', text: x });
    return null;
  }

  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); return node; }
  function mount(parent, node) { clear(parent); if (node) parent.appendChild(node); return node; }
  function classNames() {
    var out = [];
    for (var i = 0; i < arguments.length; i++) {
      var a = arguments[i];
      if (!a) continue;
      if (typeof a === 'string') out.push(a);
      else if (Array.isArray(a)) out.push(classNames.apply(null, a));
      else if (typeof a === 'object') for (var k in a) if (a[k]) out.push(k);
    }
    return out.join(' ');
  }

  var FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  function trapFocus(container) {
    var prev = document.activeElement;
    function onKey(e) {
      if (e.key !== 'Tab') return;
      var nodes = Array.prototype.slice.call(container.querySelectorAll(FOCUSABLE)).filter(function (n) { return n.offsetParent !== null; });
      if (!nodes.length) return;
      var first = nodes[0], last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    container.addEventListener('keydown', onKey);
    setTimeout(function () {
      var auto = container.querySelector('[data-autofocus]') || container.querySelector(FOCUSABLE);
      if (auto) auto.focus();
    }, 30);
    return function release() {
      container.removeEventListener('keydown', onKey);
      if (prev && prev.focus) prev.focus();
    };
  }

  function offsetParentRect(el) { return el.getBoundingClientRect(); }

  MUI.h = h;
  MUI.svg = svg;
  MUI.fragment = fragment;
  MUI.icon = icon;
  MUI.renderIcon = renderIcon;
  MUI.clear = clear;
  MUI.mount = mount;
  MUI.classNames = classNames;
  MUI.trapFocus = trapFocus;
  MUI.dom = { SVGNS: SVGNS, isSvgTag: function (t) { return SVG_ONLY.has(t); }, offsetParentRect: offsetParentRect };
})(window.MUI = window.MUI || {});
