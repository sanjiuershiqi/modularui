/* ==========================================================================
   views/main.js — home + dashboard
   ========================================================================== */
(function (MUI) {
  'use strict';
  var h = MUI.h, ui = MUI.ui, icon = MUI.icon, router = MUI.router;
  var util = MUI.util;

  function kernelPanel() {
    var list = h('div', { class: 'stack', style: 'gap:9px' });
    function paint() {
      MUI.clear(list);
      MUI.mods.list().forEach(function (m) {
        list.appendChild(h('div', { class: 'row', style: 'gap:9px' }, [
          h('span', { style: 'display:flex;color:var(--text-3)' }, icon(m.icon || 'puzzle', 15)),
          h('span', { class: 'truncate', style: 'flex:1;font-size:var(--fs-sm)', text: m.name }),
          h('span', { class: 'mono faint', text: 'v' + m.version }),
          ui.statusPill({ state: m.state, label: ({ active: '运行中', inactive: '已停用', error: '错误', resolving: '解析中', activating: '激活中', deactivating: '停用中' })[m.state] || m.state })
        ]));
      });
    }
    paint();
    var off = MUI.bus.on('mods:changed', paint);
    var card = ui.card({
      title: '内核运行时', icon: 'cpu', subtitle: 'kernel · live',
      actions: [ui.badge({ text: 'API ' + MUI.mods.API_VERSION, tone: 'accent' })],
      children: [
        h('div', { class: 'stack', style: 'gap:9px' }, [
          list,
          h('hr', { class: 'divider' }),
          h('div', { class: 'grid', style: 'grid-template-columns:1fr 1fr;gap:8px' }, [
            ui.keyValue({ items: [{ k: '模块', v: MUI.mods.list().length }, { k: '已激活', v: MUI.mods.list().filter(function (m) { return m.state === 'active'; }).length }] }),
            ui.keyValue({ items: [{ k: '组件', v: MUI.components.list().length }, { k: '插槽', v: MUI.slots.names().length }] })
          ])
        ])
      ]
    });
    card.__cleanup = off;
    return card;
  }

  router.register('home', {
    title: '总览', icon: 'home', order: 0, tab: true,
    nav: { group: '工作区', order: 0, label: '总览' },
    render: function () {
      return h('div', { class: 'view' }, [
        h('div', { class: 'split split--hero' }, [
          h('section', { class: 'stack hero-copy', style: 'gap:16px' }, [
            ui.chip({ icon: 'sparkles', text: '单页应用内核 · 无构建依赖' }),
            h('h1', { class: 't-display', style: 'max-width:16ch' }, [
              h('span', { text: '把应用拆成' }),
              h('br'),
              h('span', { class: 't-outline', text: '可插拔的模块' })
            ]),
            h('p', { class: 't-lead', text: 'ModularUI 把页面、组件、插槽、主题与命令全部交给模块系统。模块声明能力、解析依赖、按生命周期激活，停用时资源自动回收。' }),
            h('div', { class: 'buttonrow' }, [
              ui.button({ label: '打开命令面板', icon: 'command', variant: 'primary', onClick: function () { MUI.palette.open(); } }),
              ui.button({ label: '模块管理', icon: 'cpu', variant: 'outline', onClick: function () { router.navigate('modules'); } }),
              ui.button({ label: 'API 参考', icon: 'book', variant: 'ghost', onClick: function () { router.navigate('api'); } })
            ]),
            h('div', { class: 'row row-wrap', style: 'gap:8px' }, [
              ui.badge({ text: 'Semver 依赖图', tone: 'accent' }),
              ui.badge({ text: '能力权限' }),
              ui.badge({ text: '作用域回收' }),
              ui.badge({ text: 'View Transitions' }),
              ui.badge({ text: '响应式状态' })
            ])
          ]),
          kernelPanel()
        ]),

        ui.event({
          icon: 'puzzle', eyebrow: 'QUICK START', title: '用三分钟写一个模块',
          text: '声明清单、挂载插槽、注册命令、申请权限 —— 全部在运行时完成，停用时资源自动回收。',
          onClick: function () { router.navigate('api'); }
        }),

        h('div', { 'data-slot': 'home.hero' }),

        ui.rule({ tone: 'accent' }),

        ui.grid({ min: '150px', gap: 14, children: [
          kpi('模块', MUI.mods.list().length, 'cpu', '已注册的模块数'),
          kpi('组件', MUI.components.list().length, 'grid', '可组合的 UI 组件'),
          kpi('路由', MUI.router.routes().length, 'link', '已注册的页面'),
          kpi('插槽', MUI.slots.names().length, 'layers', '可注入界面位置')
        ] }),

        h('div', { 'data-slot': 'home.feed' }),

        ui.section({
          title: '能力一览', icon: 'zap',
          desc: '内核提供的平台能力，模块通过声明的权限访问。',
          children: ui.grid({ min: '240px', gap: 14, children: [
            feature('模块系统', 'puzzle', 'Semver 依赖解析、拓扑激活、循环检测、远程加载与热重载。'),
            feature('能力权限', 'shield', '每个敏感 API 由能力门控；未声明的调用会抛出 PermissionError。'),
            feature('响应式状态', 'activity', 'signal / computed / effect / reactive，带批处理调度。'),
            feature('主题引擎', 'palette', '由强调色生成色阶，深浅模式、密度、圆角、字号实时切换。'),
            feature('数据组件', 'barChart', '表格、进度、环形图、面积图、柱状图与迷你图，全部零依赖。'),
            feature('命令面板', 'command', '命令注册表 + 快捷键作用域 + 模糊搜索。')
          ] })
        }),

        ui.section({
          title: '快速开始', icon: 'play',
          desc: '一个模块就是一个对象：声明清单，导出生命周期。',
          children: ui.codeblock({
            lang: 'js',
            code: "MUI.defineModule({\n  id: 'acme.analytics',\n  version: '1.2.0',\n  apiVersion: '^2.0.0',\n  requires: { 'acme.core': '^1.0.0' },\n  permissions: ['http', 'timers'],\n  config: { sampleRate: { type: 'number', default: 0.5 } },\n  async activate(ctx) {\n    const { data } = await ctx.http.get('/api/stats')\n    ctx.slot('dashboard.top', () => ctx.ui.card({ title: '实时指标', children: [data.value] }))\n    ctx.command({ id: 'analytics.refresh', title: '刷新指标', run: () => { /* ... */ } })\n  },\n  deactivate(ctx) { /* 资源已在作用域中自动回收 */ }\n})"
          })
        })
      ]);
    },
    onEnter: function () { }
  });

  function kpi(label, value, iconName, foot) {
    var s = MUI.signal(value);
    return h('div', { class: 'kpi' }, [
      h('div', { class: 'kpi__top' }, [
        h('span', { class: 'kpi__label', text: label }),
        h('span', { class: 'kpi__icon' }, icon(iconName, 16))
      ]),
      h('div', { class: 'kpi__value', text: String(value) }),
      h('div', { class: 'kpi__foot', text: foot })
    ]);
  }
  function feature(title, iconName, desc) {
    return ui.card({ hover: true, children: [
      h('span', { style: 'display:inline-flex;width:34px;height:34px;border-radius:10px;align-items:center;justify-content:center;background:var(--accent-50);color:var(--accent-700);margin-bottom:10px' }, icon(iconName, 17)),
      h('div', { class: 't-h3', text: title }),
      h('div', { class: 't-caption', style: 'margin-top:4px', text: desc })
    ] });
  }

  router.register('dashboard', {
    title: '仪表盘', icon: 'gauge', order: 1, tab: true,
    nav: { group: '工作区', order: 1, label: '仪表盘' },
    render: function () {
      var traffic = [42, 58, 50, 76, 64, 88, 72, 96, 84, 110, 98, 124];
      var months = ['1月', '3月', '5月', '7月', '9月', '11月'];
      var dist = [
        { label: '桌面端', value: 48, color: 'var(--accent)' },
        { label: '移动端', value: 32, color: 'var(--accent-400)' },
        { label: '平板', value: 20, color: 'var(--accent-200)' }
      ];
      return h('div', { class: 'view' }, [
        h('div', { class: 'kpi-grid' }, [
          dashKpi('活跃用户', '12,480', '+18.2%', 'up', [4, 8, 6, 10, 9, 13, 12, 16]),
          dashKpi('会话时长', '4m 12s', '+3.4%', 'up', [9, 8, 10, 9, 11, 10, 12, 13]),
          dashKpi('转化率', '3.86%', '-0.8%', 'down', [14, 12, 13, 11, 12, 10, 11, 9]),
          dashKpi('错误率', '0.21%', '-12%', 'up', [8, 7, 6, 6, 5, 4, 4, 3])
        ]),

        ui.event({
          variant: 'ink', icon: 'activity', eyebrow: 'THIS WEEK', title: '实时采样已开启',
          text: 'Insights 模块正在以固定间隔采集指标并写入本地存储。点击前往模块管理查看配置。',
          onClick: function () { router.navigate('modules'); }
        }),

        h('div', { 'data-slot': 'dashboard.top' }),

        h('div', { class: 'split split--2-1' }, [
          ui.card({ title: '流量趋势', subtitle: '近 12 周', actions: [ui.badge({ text: '+18.2%', tone: 'success', dot: true })],
            children: ui.areaChart({ data: traffic, labels: months, height: 200 }) }),
          ui.card({ title: '设备分布', subtitle: 'session', children: ui.donut({ segments: dist, center: '100%' }) })
        ]),

        h('div', { class: 'split split--2-1' }, [
          ui.card({ title: '最近活动', icon: 'activity', flush: true, actions: [ui.button({ label: '导出', size: 'sm', variant: 'outline', icon: 'download', onClick: function () { MUI.overlay.toast('已开始导出', 'success'); } })],
            children: ui.table({
              sortable: true,
              columns: [
                { key: 'id', label: '事件', width: '120px' },
                { key: 'module', label: '来源' },
                { key: 'latency', label: '耗时', align: 'right', render: function (v) { return ui.badge({ text: v + 'ms', tone: v > 120 ? 'warning' : 'success' }); } },
                { key: 'status', label: '状态', render: function (v) { return ui.statusPill({ state: v, label: v === 'active' ? '成功' : '重试' }); } }
              ],
              rows: [
                { id: 'render.home', module: 'acme.core', latency: 32, status: 'active' },
                { id: 'http.fetch', module: 'acme.analytics', latency: 148, status: 'pending' },
                { id: 'theme.apply', module: 'kernel', latency: 8, status: 'active' },
                { id: 'mod.activate', module: 'demo.lab', latency: 64, status: 'active' },
                { id: 'slot.render', module: 'demo.status', latency: 91, status: 'pending' }
              ]
            }) }),
          ui.card({ title: '系统事件', icon: 'clock', children: ui.timeline({ items: [
            { icon: 'checkCircle', title: '内核就绪', time: util.formatDate(new Date(), 'HH:mm'), desc: 'API ' + MUI.mods.API_VERSION },
            { icon: 'puzzle', title: '读取模块清单', time: '刚刚', desc: MUI.mods.list().length + ' 个模块' },
            { icon: 'layers', title: '挂载插槽', time: '刚刚', desc: MUI.slots.names().length + ' 个位置' },
            { icon: 'palette', title: '应用主题', time: '刚刚', desc: MUI.theme.resolved() }
          ] }) })
        ]),

        h('div', { 'data-slot': 'dashboard.feed' })
      ]);
    }
  });

  function dashKpi(label, value, delta, dir, spark) {
    return h('div', { class: 'kpi' }, [
      h('div', { class: 'kpi__top' }, [h('span', { class: 'kpi__label', text: label })]),
      h('div', { class: 'row', style: 'align-items:flex-end;gap:10px' }, [
        h('div', { class: 'kpi__value', text: value }),
        ui.badge({ text: delta, tone: dir === 'up' ? 'success' : 'danger', dot: true })
      ]),
      ui.sparkline({ data: spark, color: dir === 'up' ? 'var(--success)' : 'var(--danger)' })
    ]);
  }
})(window.MUI = window.MUI || {});
