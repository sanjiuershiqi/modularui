/* ==========================================================================
   views/docs.js — component gallery + API reference
   ========================================================================== */
(function (MUI) {
  'use strict';
  var h = MUI.h, ui = MUI.ui, icon = MUI.icon, router = MUI.router, util = MUI.util;

  function specimen(name, desc, demo) {
    return ui.card({ hover: true, children: [
      h('div', { class: 'row', style: 'justify-content:space-between;gap:10px;margin-bottom:12px' }, [
        h('div', {}, [
          h('div', { style: 'font-family:var(--mono);font-size:var(--fs-sm);font-weight:600', text: name }),
          desc ? h('div', { class: 't-caption', style: 'margin-top:2px', text: desc }) : null
        ]),
        ui.badge({ text: 'component', tone: 'accent' })
      ]),
      h('div', {}, demo)
    ] });
  }

  /* sticky anchor directory (inspired by .hyp-genres-anchor) */
  function tocLayout(items, children) {
    var links = {};
    var sticky = h('div', { class: 'toc__sticky' }, [h('div', { class: 'toc__title', text: 'INDEX' })]);
    items.forEach(function (it) {
      var a = h('a', { class: 'toc__link', href: '#' + it.id, text: it.label });
      a.addEventListener('click', function (e) { e.preventDefault(); jump(it.id); });
      links[it.id] = a; sticky.appendChild(a);
    });
    var root = h('div', { class: 'toc' }, [
      h('nav', { class: 'toc__nav', 'aria-label': '页面目录' }, sticky),
      h('div', { class: 'toc__body' }, children)
    ]);
    function scroller() { return document.getElementById('scroll'); }
    function jump(id) {
      var el = document.getElementById(id); if (!el) return;
      var smooth = MUI.theme.motion() !== 'instant';
      try { el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' }); }
      catch (e) { el.scrollIntoView(); }
    }
    var onScroll = util.throttle(function () {
      var sc = scroller(); if (!sc) return;
      var scTop = sc.getBoundingClientRect().top, best = null, bestDist = Infinity;
      items.forEach(function (it) {
        var el = document.getElementById(it.id); if (!el) return;
        var rel = el.getBoundingClientRect().top - scTop;
        if (rel <= 110) { var d = Math.abs(rel - 16); if (d < bestDist) { bestDist = d; best = it.id; } }
      });
      if (!best) best = items[0] && items[0].id;
      Object.keys(links).forEach(function (k) { links[k].classList.toggle('is-active', k === best); });
    }, 90);
    var sc = scroller();
    if (sc) sc.addEventListener('scroll', onScroll);
    requestAnimationFrame(onScroll);
    root.__cleanup = function () { if (sc) sc.removeEventListener('scroll', onScroll); };
    return root;
  }

  router.register('components', {
    title: '组件', icon: 'grid', order: 10, tab: true,
    nav: { group: '资源', order: 10, label: '组件' },
    render: function () {
      var acc = MUI.theme.accent();
      var switchState = MUI.signal(true);
      var segValue = MUI.signal('日');
      var checkState = MUI.signal(true);
      var radioValue = '标准';
      var sliderValue = 64;
      var disposers = [];
      function scoped(render) { var out; disposers.push(MUI.scope(function () { out = render(); })); return out; }

      var body = [
        ui.banner({ tone: 'accent', title: '39 个内置组件', text: '每个组件都是纯 hyperscript 工厂，可在运行时被模块覆盖或替换。' }),

        ui.section({ id: 'c-buttons', title: '按钮与操作', icon: 'zap', children: ui.masonry({ min: '260px', children: [
          specimen('button', '多种语义与尺寸', h('div', { class: 'buttonrow' }, [
            ui.button({ label: '主要', variant: 'primary' }),
            ui.button({ label: '柔和', variant: 'soft' }),
            ui.button({ label: '描边', variant: 'outline' }),
            ui.button({ label: '幽灵', variant: 'ghost' }),
            ui.button({ label: '危险', variant: 'danger' }),
            ui.button({ label: '禁用', disabled: true }),
            ui.button({ label: '小', size: 'sm', variant: 'primary' }),
            ui.button({ label: '大', size: 'lg' })
          ])),
          specimen('iconButton', '带提示的图标按钮', h('div', { class: 'buttonrow' }, [
            ui.iconButton({ icon: 'refresh', title: '刷新', tip: '刷新数据', onClick: function () { ui.toast('已刷新', 'success'); } }),
            ui.iconButton({ icon: 'copy', title: '复制', tip: '复制', outline: true, onClick: function () { util.copy('ModularUI'); ui.toast('已复制'); } }),
            ui.iconButton({ icon: 'trash', title: '删除', tip: '删除', onClick: function () { ui.confirm({ title: '删除？', danger: true }).then(function (ok) { if (ok) ui.toast('已删除', 'danger'); }); } })
          ])),
          specimen('segmented', '分段控件', ui.segmented({ block: true, value: segValue.get(), items: ['日', '周', '月'], onChange: function (v) { segValue.set(v); ui.toast('视图：' + v); } })),
          specimen('chip', '标签与筛选', h('div', { class: 'row row-wrap', style: 'gap:8px' }, [
            ui.chip({ text: '全部', active: true }),
            ui.chip({ text: '进行中', onClick: function () { ui.toast('筛选：进行中'); } }),
            ui.chip({ text: '已完成' }),
            ui.chip({ text: '标签', icon: 'plus', onRemove: function () { ui.toast('已移除'); } })
          ]))
        ] }) }),

        ui.section({ id: 'c-forms', title: '表单', icon: 'edit', children: ui.masonry({ min: '260px', children: [
          specimen('input / field', '文本输入', h('div', { class: 'stack' }, [
            ui.input({ placeholder: '简单输入框' }),
            ui.field({ label: '用户名', control: ui.input({ value: 'modular', flush: true }), hint: '@modular' })
          ])),
          specimen('select', '自定义下拉（键盘可用）', ui.select({ value: 'zh', options: [
            { label: '简体中文', value: 'zh' }, { label: 'English', value: 'en' }, { label: '日本語', value: 'ja' }
          ], onChange: function (v) { ui.toast('选择：' + v); } })),
          specimen('switch / switchRow', '开关', h('div', { class: 'stack' }, [
            ui.switchRow({ title: '自动保存', subtitle: '编辑后立即写入', checked: switchState.get(), onChange: function (v) { switchState.set(v); } }),
            ui.switchRow({ title: '开发模式', subtitle: '显示调试信息', checked: false })
          ])),
          specimen('checkbox / radio', '复选与单选', h('div', { class: 'stack', style: 'gap:14px' }, [
            ui.checkbox({ label: '接收通知', subtitle: '仅重要更新', checked: checkState.get(), onChange: checkState.set }),
            ui.radioGroup({ value: radioValue, options: [{ label: '标准', value: '标准', subtitle: '均衡' }, { label: '高性能', value: '高性能' }], onChange: function (v) { radioValue = v; } })
          ])),
          specimen('slider / stepper', '数值输入', h('div', { class: 'stack' }, [
            ui.slider({ min: 0, max: 100, value: sliderValue, unit: '%', onInput: function (v) { sliderValue = v; } }),
            h('div', { class: 'row', style: 'justify-content:space-between' }, [
              h('span', { class: 't-caption', text: '副本数' }),
              ui.stepper({ value: 2, min: 0, max: 10 })
            ])
          ])),
          specimen('textarea / searchInput', '多行与搜索', h('div', { class: 'stack' }, [
            ui.searchInput({ placeholder: '搜索组件…', shortcut: '/' }),
            ui.textarea({ value: 'ctx.log("hello modularui")', rows: 3 })
          ]))
        ] }) }),

        ui.section({ id: 'c-data', title: '数据展示', icon: 'barChart', children: ui.masonry({ min: '260px', children: [
          specimen('progress / ring', '进度指标', h('div', { class: 'stack' }, [
            ui.progress({ value: 68, showValue: true, label: '构建进度' }),
            ui.progress({ value: 32, thin: true, label: '存储占用' }),
            h('div', { class: 'row', style: 'gap:18px' }, [ui.ring({ value: 72, label: 'CPU' }), ui.ring({ value: 44, label: '内存', color: 'var(--accent-400)' })])
          ])),
          specimen('sparkline', '迷你趋势', ui.sparkline({ data: [4, 7, 5, 9, 8, 12, 10, 14, 13, 17, 15, 20] })),
          specimen('areaChart', '面积图', ui.areaChart({ data: [20, 32, 28, 44, 38, 52, 48, 64], labels: ['一', '二', '三', '四'], height: 140 })),
          specimen('barChart', '柱状图', ui.barChart({ data: [12, 20, 15, 28, 22, 34], labels: ['A', 'B', 'C', 'D', 'E', 'F'], height: 140 })),
          specimen('donut', '环形分布', ui.donut({ segments: [
            { label: '模块', value: 42, color: 'var(--accent)' },
            { label: '组件', value: 33, color: 'var(--accent-400)' },
            { label: '其他', value: 25, color: 'var(--accent-200)' }
          ], center: '100%', size: 108 })),
          specimen('keyValue', '键值对', ui.keyValue({ items: [{ k: '内核', v: 'ModularUI' }, { k: 'API', v: MUI.mods.API_VERSION }, { k: '主题', v: MUI.theme.resolved() }] }))
        ] }) }),

        ui.section({ id: 'c-table', title: '数据表格与时间线', icon: 'table', children: [
          ui.card({ flush: true, children: ui.table({
            sortable: true,
            columns: [
              { key: 'name', label: '模块' },
              { key: 'version', label: '版本', width: '100px' },
              { key: 'state', label: '状态', render: function (v) { return ui.statusPill({ state: v, label: v }); } },
              { key: 'ms', label: '激活耗时', align: 'right', render: function (v) { return v == null ? '—' : v + 'ms'; } }
            ],
            rows: MUI.mods.list().map(function (m) { return { name: m.name, version: m.version, state: m.state, ms: m.activationMs }; })
          }) }),
          ui.card({ title: '时间线', icon: 'clock', children: ui.timeline({ items: [
            { icon: 'checkCircle', title: '内核启动', time: '00:00', desc: '加载 ' + MUI.components.list().length + ' 个组件' },
            { icon: 'puzzle', title: '激活模块', time: '00:01', desc: MUI.mods.list().length + ' 个模块' },
            { icon: 'palette', title: '应用主题', time: '00:01', desc: MUI.theme.mode() }
          ] }) })
        ] }),

        ui.section({ id: 'c-reactive', title: '响应式绑定', icon: 'activity', children: ui.masonry({ min: '260px', children: [
          specimen('MUI.text / signal', '文本随 signal 更新', scoped(function () {
            var n = MUI.signal(0);
            return h('div', { class: 'stack' }, [
              h('div', { class: 'row', style: 'gap:12px;align-items:center' }, [
                ui.button({ label: '−', size: 'sm', onClick: function () { n.update(function (v) { return v - 1; }); } }),
                h('strong', { class: 'mono', style: 'font-size:var(--fs-xl);min-width:2.4em;text-align:center' }, MUI.text(n)),
                ui.button({ label: '+', size: 'sm', variant: 'primary', onClick: function () { n.update(function (v) { return v + 1; }); } })
              ]),
              h('div', { class: 't-caption', text: '数字是 MUI.text(signal)，只更新该文本节点。' })
            ]);
          })),
          specimen('MUI.bind', '依赖变化时重渲染', scoped(function () {
            var name = MUI.signal('ModularUI');
            return MUI.bind(function () {
              return h('div', { class: 'panel', style: 'font-family:var(--mono)' }, 'hello, ' + name.get());
            });
          })),
          specimen('MUI.list', '响应式列表', scoped(function () {
            var items = MUI.signal([{ t: '模块内核', done: true }, { t: '组件注册表', done: true }, { t: '响应式绑定', done: false }]);
            var host = MUI.list(items, function (it) {
              return h('div', { class: 'row', style: 'gap:8px;padding:4px 0' }, ui.checkbox({
                label: it.t, checked: it.done,
                onChange: function (v) {
                  items.update(function (arr) { return arr.map(function (x) { return x === it ? Object.assign({}, x, { done: v }) : x; }); });
                }
              }));
            });
            return h('div', { class: 'stack' }, [
              host,
              h('button', { class: 'btn btn--outline btn--sm', type: 'button', text: '添加一项', onClick: function () {
                items.update(function (a) { return a.concat([{ t: '新任务 ' + (a.length + 1), done: false }]); });
              } })
            ]);
          }))
        ] }) }),

        ui.section({ id: 'c-nav', title: '导航与折叠', icon: 'layers', children: ui.masonry({ min: '260px', children: [
          specimen('tabs', '标签页', ui.tabs({ items: [
            { label: '概览', render: function () { return h('p', { class: 't-body', text: '标签页内容区域，可放置任意节点。' }); } },
            { label: '配置', render: function () { return ui.input({ value: 'value=1' }); } },
            { label: '日志', render: function () { return ui.codeblock({ code: 'log.info("ready")', lang: 'js' }); } }
          ] })),
          specimen('collapse', '折叠面板', h('div', {}, [
            ui.collapse({ title: '什么是能力权限？', open: true, content: '模块在清单中声明所需能力，未授权的能力调用会抛出 PermissionError。' }),
            ui.collapse({ title: '依赖如何解析？', content: '注册时按 semver 范围解析依赖，激活顺序由依赖图拓扑排序决定。' })
          ]))
        ] }) }),

        ui.section({ id: 'c-feedback', title: '反馈与覆盖层', icon: 'bell', children: ui.masonry({ min: '260px', children: [
          specimen('banner', '行内提示', h('div', { class: 'stack' }, [
            ui.banner({ tone: 'info', title: '信息', text: '普通提示信息。' }),
            ui.banner({ tone: 'success', title: '成功', text: '操作已完成。' }),
            ui.banner({ tone: 'warning', title: '警告', text: '请检查配置。' }),
            ui.banner({ tone: 'danger', title: '错误', text: '请求失败，请重试。' })
          ])),
          specimen('badge / statusPill', '徽标状态', h('div', { class: 'row row-wrap', style: 'gap:8px' }, [
            ui.badge({ text: '默认' }), ui.badge({ text: '强调', tone: 'accent' }), ui.badge({ text: '成功', tone: 'success', dot: true }),
            ui.badge({ text: '警告', tone: 'warning' }), ui.badge({ text: '危险', tone: 'danger' }),
            ui.statusPill({ state: 'active', label: '运行中' }), ui.statusPill({ state: 'inactive', label: '已停用' }), ui.statusPill({ state: 'error', label: '错误' })
          ])),
          specimen('skeleton / empty', '加载与空态', h('div', { class: 'stack' }, [ui.skeleton({ avatar: true, lines: 2 }), ui.empty({ icon: 'box', title: '暂无数据', desc: '创建一个模块即可看到内容。' })])),
          specimen('toast / notify / modal', '覆盖层', h('div', { class: 'buttonrow' }, [
            ui.button({ label: 'Toast', size: 'sm', onClick: function () { ui.toast({ title: '已保存', text: '更改已写入本地存储', type: 'success' }); } }),
            ui.button({ label: 'Notify', size: 'sm', onClick: function () { ui.notify({ type: 'warning', title: '配额不足', text: '剩余空间 12%' }); } }),
            ui.button({ label: 'Modal', size: 'sm', onClick: function () { ui.modal({ title: '确认操作', desc: '此操作不可撤销。', icon: 'alert', actions: [{ label: '取消' }, { label: '确定', tone: 'primary' }] }); } }),
            ui.button({ label: 'Prompt', size: 'sm', onClick: function () { ui.prompt({ title: '重命名', value: 'modular' }).then(function (v) { if (v != null) ui.toast('新名称：' + v); }); } }),
            ui.button({ label: 'Sheet', size: 'sm', onClick: function () { ui.sheet({ title: '底部抽屉', content: h('p', { class: 't-body', text: '从底部弹出的面板。' }) }); } }),
            ui.button({ label: 'Menu', size: 'sm', onClick: function (e) { var r = e.currentTarget.getBoundingClientRect(); ui.menu([{ label: '重命名', icon: 'edit' }, { label: '复制', icon: 'copy' }, { sep: true }, { label: '删除', icon: 'trash', danger: true }], { x: r.left, y: r.bottom + 6 }); } })
          ]))
        ] }) }),

        ui.section({ id: 'c-type', title: '排版', icon: 'book', children: ui.card({ children: h('div', { class: 'stack' }, [
          h('div', { class: 't-display', text: 'Display' }),
          h('div', { class: 't-h1 t-outline', text: '标题 Heading' }),
          h('p', { class: 't-lead', text: 'Lead 段落用于页面开场，保持在一行的 60 字符以内。' }),
          h('p', { class: 't-body', text: '正文段落使用可变字重与舒适的行高，适合较长的阅读内容。' }),
          h('div', { class: 'row row-wrap', style: 'gap:10px' }, [h('span', { class: 't-caption', text: 'Caption' }), h('span', { class: 't-eyebrow', text: 'EYEBROW' }), h('span', { class: 'mono', text: 'mono · 0123' })]),
          ui.codeblock({ lang: 'js', code: 'const c = MUI.signal(0)\nMUI.effect(() => console.log(c.get()))\nc.set(1)' })
        ]) }) })
      ];
      var toc = tocLayout([
        { id: 'c-buttons', label: '按钮与操作' },
        { id: 'c-forms', label: '表单' },
        { id: 'c-data', label: '数据展示' },
        { id: 'c-table', label: '表格与时间线' },
        { id: 'c-reactive', label: '响应式绑定' },
        { id: 'c-nav', label: '导航与折叠' },
        { id: 'c-feedback', label: '反馈与覆盖层' },
        { id: 'c-type', label: '排版' }
      ], body);
      var view = h('div', { class: 'view' }, [toc]);
      view.__cleanup = function () {
        if (toc.__cleanup) toc.__cleanup();
        disposers.forEach(function (d) { try { d(); } catch (e) {} });
      };
      return view;
    }
  });

  router.register('api', {
    title: 'API 参考', icon: 'book', order: 12,
    nav: { group: '资源', order: 12, label: 'API 参考' },
    render: function () {
      var refs = [
        { title: '内核', icon: 'cpu', rows: [
          ['MUI.mods.define(manifest, setup)', '定义并注册模块'],
          ['MUI.mods.enable/disable/reload/uninstall(id)', '生命周期控制'],
          ['MUI.mods.load(url)', '从 URL 远程加载模块'],
          ['MUI.mods.list()/info(id)/diagnostics()', '查询模块状态'],
          ['MUI.mods.graph()', '依赖图（节点与边）']
        ] },
        { title: '响应式状态', icon: 'activity', rows: [
          ['MUI.signal(init)', '细粒度信号：get/set/update/subscribe'],
          ['MUI.computed(fn)', '派生信号，依赖变化时重算'],
          ['MUI.effect(fn)', '副作用，返回停止函数'],
          ['MUI.reactive(obj)', '深层代理，自动依赖追踪'],
          ['MUI.batch(fn)', '批处理，合并调度']
        ] },
        { title: '视图与路由', icon: 'link', rows: [
          ['MUI.router.register(name, def)', '注册页面，def 支持 nav/tab/beforeEnter'],
          ['MUI.router.navigate(name, params)', '跳转（带 View Transition）'],
          ['MUI.router.back()', '返回上一页'],
          ['MUI.router.params()', '当前路由参数']
        ] },
        { title: '界面', icon: 'grid', rows: [
          ['MUI.ui.<component>(props)', '调用任意已注册组件'],
          ['MUI.components.define/override/use', '注册、覆盖、调用组件'],
          ['MUI.slots.register(name, render, opt)', '向插槽注入界面'],
          ['MUI.overlay.toast/notify/modal/sheet/menu', '命令式覆盖层'],
          ['MUI.palette.open()', '命令面板']
        ] },
        { title: '平台', icon: 'settings', rows: [
          ['MUI.theme.setMode/setAccent/setDensity', '主题控制'],
          ['MUI.i18n.register(locale, dict)', '语言包'],
          ['MUI.http.get/post/request', '带拦截器与重试的 HTTP 客户端'],
          ['MUI.keys.register(combo, fn, {scope})', '作用域快捷键'],
          ['MUI.commands.register(cmd)', '命令注册表'],
          ['MUI.settings.register(owner, item)', '设置项注册']
        ] },
        { title: '模块上下文 ctx', icon: 'puzzle', rows: [
          ['ctx.config / getConfig / setConfig', '带 schema 的配置'],
          ['ctx.slot(name, render, opt)', '注入界面（ui.slot 权限）'],
          ['ctx.view(def) / page(def)', '注册页面（ui.view 权限）'],
          ['ctx.style(css)', '注入作用域样式'],
          ['ctx.on/emit/hook/action', '事件与钩子'],
          ['ctx.http / setTimeout', '需要 http / timers 权限'],
          ['ctx.expose(obj) / require(id)', '模块间通信'],
          ['ctx.setting(item) / command(cmd) / hotkey(k, fn)', '注册扩展点']
        ] },
        { title: '响应式绑定', icon: 'activity', rows: [
          ['MUI.scope(fn) / MUI.Scope', '作用域，统一回收副作用（返回 dispose）'],
          ['MUI.text(signal)', '绑定到 signal 的文本节点'],
          ['MUI.bind(render)', '响应式容器：依赖的 signal 变化时重渲染'],
          ['MUI.list(source, renderItem)', '响应式列表'],
          ['MUI.persist(signal, key, ns)', 'signal ↔ 本地存储双向绑定'],
          ['MUI.resource(fetcher)', '异步资源：loading / data / error / reload()'],
          ['ctx.bind / ctx.list / ctx.resource', '模块内等价方法（随停用自动回收）']
        ] },
        { title: 'DOM 工具', icon: 'grid', rows: [
          ['MUI.observer(el, cb)', 'ResizeObserver 封装'],
          ['MUI.intersect(el, cb, opt)', 'IntersectionObserver 封装'],
          ['MUI.drag(el, { start, move, end })', '指针拖拽'],
          ['MUI.autoDispose(fn)', '把清理器登记到当前作用域'],
          ['MUI.h / MUI.svg / MUI.icon', 'hyperscript / SVG / 图标']
        ] }
      ];
      var body = [
        ui.banner({ tone: 'accent', title: 'API ' + MUI.mods.API_VERSION, text: '完整接口清单与用法示例。命令面板（⌘/Ctrl + K）可快速跳转。' }),
        ui.masonry({ min: '280px', children: refs.map(function (group, i) {
          return ui.card({ id: 'api-' + i, title: group.title, icon: group.icon, children: ui.keyValue({ items: group.rows.map(function (r) { return { k: h('code', { class: 'inline', text: r[0] }), v: r[1] }; }) }) });
        }) }),
        ui.section({ id: 'api-try', title: '在控制台试用', icon: 'terminal', children: ui.card({ children: h('div', { class: 'buttonrow' }, [
          ui.button({ label: '查看内核对象', size: 'sm', icon: 'code', onClick: function () { console.log(MUI); ui.toast('已输出 MUI 到控制台'); } }),
          ui.button({ label: '打印依赖图', size: 'sm', icon: 'gitBranch', onClick: function () { console.log(MUI.mods.graph()); ui.toast('已输出依赖图'); } }),
          ui.button({ label: '重新渲染插槽', size: 'sm', icon: 'layers', onClick: function () { MUI.slots.renderAll(); ui.toast('插槽已刷新'); } }),
          ui.button({ label: '切换主题', size: 'sm', icon: 'palette', onClick: function () { MUI.theme.toggle(); } })
        ]) }) })
      ];
      var toc = tocLayout(refs.map(function (g, i) { return { id: 'api-' + i, label: g.title }; }).concat([{ id: 'api-try', label: '控制台试用' }]), body);
      var view = h('div', { class: 'view' }, [toc]);
      view.__cleanup = toc.__cleanup;
      return view;
    }
  });
})(window.MUI = window.MUI || {});
