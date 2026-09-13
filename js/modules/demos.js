/* ==========================================================================
   modules/demos.js — reference modules built on the public API
   ========================================================================== */
(function (MUI) {
  'use strict';
  var h = MUI.h, ui = MUI.ui;

  /* ---------------------------------------------------------------- base */
  MUI.defineModule({
    id: 'demo.foundation',
    name: 'Foundation',
    version: '1.4.0',
    apiVersion: '^2.0.0',
    author: { name: 'ModularUI', url: 'https://example.com' },
    description: '基础模块：暴露共享 API、注入首页插槽、注册命令、快捷键与设置项。',
    icon: 'layers',
    homepage: 'https://example.com/foundation',
    license: 'MIT',
    permissions: [],
    config: {
      greeting: { type: 'string', label: '问候语', default: 'Hello, ModularUI' },
      showCard: { type: 'boolean', label: '在首页显示卡片', default: true }
    },

    activate: function (ctx) {
      var clicks = MUI.signal(0);

      /* share an API with dependent modules */
      ctx.expose({
        visits: clicks,
        greet: function (who) { return ctx.getConfig('greeting') + (who ? '，' + who : ''); },
        bump: function () { clicks.update(function (v) { return v + 1; }); }
      });

      ctx.style('.df-card__pulse{width:7px;height:7px;border-radius:50%;background:var(--success);box-shadow:0 0 0 3px var(--success-soft)}');

      /* invert into the home hero slot */
      ctx.slot('home.hero', function () {
        if (!ctx.getConfig('showCard')) return null;
        var count = h('span', { class: 'mono', style: 'font-weight:700;font-size:var(--fs-lg)' });
        var off = clicks.subscribe(function (v) { count.textContent = String(v); }, true);
        var card = ui.card({
          accent: true,
          title: 'Foundation 模块已注入', subtitle: 'demo.foundation · home.hero',
          actions: [h('span', { class: 'df-card__pulse' })],
          children: [
            ui.banner({ tone: 'accent', title: ctx.getConfig('greeting'), text: '这张卡片由模块通过插槽挂载，停用模块后自动移除。' }),
            h('div', { class: 'row', style: 'margin-top:12px;gap:12px' }, [
              ui.button({ label: '打招呼', icon: 'sparkles', variant: 'primary', size: 'sm', onClick: function () { ctx.notify({ type: 'success', title: ctx.getConfig('greeting'), text: '来自 Foundation 模块' }); } }),
              ui.button({ label: '+1', size: 'sm', variant: 'outline', onClick: function () { clicks.update(function (v) { return v + 1; }); } }),
              h('span', { class: 't-caption' }, ['调用次数 ', count])
            ])
          ]
        });
        card.__dispose = off;
        return card;
      }, { priority: 5 });

      ctx.command({
        id: 'foundation.greet', title: 'Foundation 打招呼', subtitle: 'demo.foundation',
        icon: 'sparkles', group: '模块', keywords: 'greet hello',
        run: function () { ctx.notify({ type: 'success', title: ctx.getConfig('greeting'), text: '命令面板触发的问候' }); }
      });
      ctx.hotkey('mod+shift+g', function () { ctx.toast(ctx.getConfig('greeting')); });

      ctx.setting({
        order: 20,
        render: function () {
          return h('div', { class: 'listitem' }, [
            h('div', { class: 'listitem__main' }, [
              h('div', { class: 'listitem__title', text: 'Foundation 问候语' }),
              h('div', { class: 'listitem__sub', text: '由 demo.foundation 注入，修改后立即生效' })
            ]),
            h('div', { style: 'width:170px;flex:0 0 auto' }, ui.input({ value: ctx.getConfig('greeting'), flush: true, onInput: function (v) { ctx.setConfig('greeting', v); } }))
          ]);
        }
      });

      ctx.on('router:navigate', function (name) { ctx.log('路由切换 →', name); });
    }
  });

  /* ---------------------------------------------------------------- insights (depends on foundation) */
  MUI.defineModule({
    id: 'demo.insights',
    name: 'Insights',
    version: '2.1.0',
    apiVersion: '^2.0.0',
    author: { name: 'ModularUI' },
    description: '依赖 Foundation 的示例模块：申请 timers 权限、消费依赖模块的导出、带存储迁移。',
    icon: 'activity',
    requires: { 'demo.foundation': '^1.0.0' },
    permissions: ['timers'],
    storageVersion: 2,
    migrate: function (store, from) {
      if (from < 2) {
        store.samples = store.samples || [18, 22, 26, 24, 30, 34, 31, 38];
        store.ticks = store.ticks || 0;
      }
      return store;
    },
    config: {
      interval: { type: 'number', label: '采样间隔 (ms)', default: 1500 },
      live: { type: 'boolean', label: '实时采样', default: true },
      mode: { type: 'select', label: '数据源', default: 'simulated', options: [{ label: '模拟', value: 'simulated' }, { label: '实时', value: 'live' }] }
    },

    activate: function (ctx) {
      var foundation = ctx.require('demo.foundation');
      var samples = MUI.signal(ctx.store.get('samples', [18, 22, 26, 24, 30, 34, 31, 38]).slice(-12));
      var timer = null;

      function push() {
        var last = samples.get()[samples.get().length - 1] || 20;
        var next = Math.max(6, Math.min(60, Math.round(last + (Math.random() * 12 - 6))));
        samples.set(samples.get().concat([next]).slice(-12));
        var ticks = (ctx.store.get('ticks') || 0) + 1;
        ctx.store.set('ticks', ticks);
        if (ticks % 5 === 0) ctx.store.set('samples', samples.get());
      }
      function start() { if (timer) return; timer = ctx.setInterval(push, ctx.getConfig('interval')); }
      function stop() { if (timer) { clearInterval(timer); timer = null; } }

      if (ctx.getConfig('live')) start();

      ctx.style('.di-tick{font-family:var(--mono);font-size:var(--fs-2xs);color:var(--text-3)}');

      ctx.slot('dashboard.top', function () {
        var chart = ui.sparkline({ data: samples.get() });
        var value = h('span', { class: 'kpi__value' });
        var off = samples.subscribe(function (arr) { value.textContent = String(arr[arr.length - 1]); chart.replaceWith(chart = ui.sparkline({ data: arr })); }, true);
        var card = ui.card({
          accent: true, title: '实时采样', icon: 'activity', subtitle: 'demo.insights · dashboard.top',
          actions: [
            ui.badge({ text: ctx.permissions.has('timers') ? 'timers 已授权' : '只读', tone: 'warning' }),
            ui.button({ label: ctx.getConfig('live') ? '暂停' : '继续', size: 'sm', variant: 'outline', onClick: function (e) { var on = !ctx.getConfig('live'); ctx.setConfig('live', on); e.currentTarget.label = ''; if (on) start(); else stop(); ui.toast(on ? '已继续采样' : '已暂停采样'); } })
          ],
          children: [
            h('div', { class: 'row', style: 'align-items:flex-end;gap:12px;margin-bottom:8px' }, [value, h('span', { class: 'di-tick' }, ['ticks: ' + (ctx.store.get('ticks') || 0)])]),
            chart,
            h('div', { class: 'row', style: 'margin-top:12px;justify-content:space-between' }, [
              h('span', { class: 't-caption', text: '依赖 Foundation 的共享计数' }),
              h('span', { class: 'mono', text: foundation ? 'foundation.visits = ' + foundation.visits.get() : '—' })
            ])
          ]
        });
        card.__dispose = off;
        return card;
      }, { priority: 10 });

      ctx.command({
        id: 'insights.toggle', title: '切换实时采样', subtitle: 'demo.insights', icon: 'activity', group: '模块',
        run: function () { var on = !ctx.getConfig('live'); ctx.setConfig('live', on); if (on) start(); else stop(); ctx.toast(on ? '采样已开启' : '采样已暂停'); }
      });
      ctx.action('mod:config', function (id, key) {
        if (id === 'demo.insights' && key === 'live') { if (ctx.getConfig('live')) start(); else stop(); }
      });

      ctx.setting({
        order: 30,
        render: function () {
          return h('div', { class: 'listitem' }, [
            h('div', { class: 'listitem__main' }, [
              h('div', { class: 'listitem__title', text: 'Insights 实时采样' }),
              h('div', { class: 'listitem__sub', text: '需要 timers 权限 · 当前 ' + ctx.getConfig('interval') + 'ms' })
            ]),
            ui.switch({ checked: ctx.getConfig('live'), onChange: function (v) { ctx.setConfig('live', v); if (v) start(); else stop(); } })
          ]);
        }
      });

      ctx.log('Insights 已接入，采样间隔 ' + ctx.getConfig('interval') + 'ms');
    },

    deactivate: function (ctx) {
      ctx.log('Insights 已停用，定时器随作用域回收');
    }
  });

  /* ---------------------------------------------------------------- lab (page + component + override) */
  MUI.defineModule({
    id: 'demo.lab',
    name: 'Playground',
    version: '1.0.0',
    apiVersion: '^2.0.0',
    author: { name: 'ModularUI' },
    description: '注册独立页面、自定义组件、覆盖内置组件，并演示权限拒绝。',
    icon: 'terminal',
    permissions: [],
    config: { density: { type: 'select', label: '卡片密度', default: '舒适', options: ['舒适', '紧凑'] } },

    activate: function (ctx) {
      /* custom component available to every module */
      ctx.component.define('metricTile', function (p) {
        return h('div', { class: 'card card--pad', style: 'display:flex;flex-direction:column;gap:6px' }, [
          h('div', { class: 'row', style: 'justify-content:space-between' }, [
            h('span', { class: 'kpi__label', text: p.label }),
            h('span', { style: 'color:var(--accent);display:flex' }, MUI.icon(p.icon || 'activity', 16))
          ]),
          h('div', { class: 'kpi__value', text: String(p.value) }),
          p.hint ? h('div', { class: 't-caption', text: p.hint }) : null
        ]);
      });

      /* override the built-in ring to add a soft glow (capture the original first) */
      var originalRing = MUI.components.get('ring');
      ctx.override('ring', function (p) {
        var node = originalRing(p);
        node.style.filter = 'drop-shadow(0 6px 14px ' + MUI.util.rgba(MUI.theme.accent(), .35) + ')';
        return node;
      });

      /* demonstrate a denied capability */
      try { ctx.http.get('/demo'); }
      catch (err) { ctx.warn('预期中的权限拒绝 →', err.name + ': ' + err.message); }

      ctx.component.define('labGreeting', function (p) {
        return h('div', { class: 'panel', text: '自定义组件 labGreeting · 参数 = ' + JSON.stringify(p) });
      });

      ctx.view('playground', {
        title: '演练场', icon: 'terminal', order: 13,
        nav: { group: '资源', order: 13, label: '演练场' },
        render: function () {
          var counter = MUI.signal(0);
          var tiles = h('div', { class: 'grid', style: 'grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px' });
          function paintTiles() {
            MUI.clear(tiles);
            tiles.appendChild(ui.metricTile({ label: '计数', value: counter.get(), icon: 'activity', hint: '点击随机 +1' }));
            tiles.appendChild(ui.metricTile({ label: '组件', value: MUI.components.list().length, icon: 'grid' }));
            tiles.appendChild(ui.metricTile({ label: '模块', value: MUI.mods.list().length, icon: 'puzzle' }));
          }
          paintTiles();
          counter.subscribe(paintTiles);

          return h('div', { class: 'view' }, [
            ui.banner({ tone: 'accent', title: '模块演练场', text: '本页面、metricTile 组件与命令都由 demo.lab 在运行时注册。' }),
            ui.card({ title: '自定义组件', subtitle: 'ctx.component.define("metricTile")', children: [
              tiles,
              h('div', { class: 'buttonrow', style: 'margin-top:12px' }, [
                ui.button({ label: '随机 +1', icon: 'plus', variant: 'primary', size: 'sm', onClick: function () { counter.update(function (v) { return v + 1; }); } }),
                ui.button({ label: '重置', size: 'sm', variant: 'outline', onClick: function () { counter.set(0); } })
              ])
            ] }),
            ui.card({ title: '覆盖内置组件', subtitle: 'ring 现在带有柔和光晕', children: h('div', { class: 'row', style: 'gap:20px' }, [
              ui.ring({ value: 72, label: 'CPU' }), ui.ring({ value: 45, label: '内存', color: 'var(--accent-400)' })
            ]) }),
            ui.card({ title: '作用域样式', subtitle: 'ctx.style() 注入，停用时移除', children: h('div', { class: 'row', style: 'gap:10px' }, [
              ui.button({ label: '打个招呼', size: 'sm', onClick: function () { ctx.toast(ctx.require('demo.foundation').greet('Playground')); } }),
              ui.badge({ text: 'lab.scoped', tone: 'accent' })
            ]) })
          ]);
        }
      });

      ctx.command({ id: 'lab.open', title: '打开演练场', subtitle: 'demo.lab', icon: 'terminal', group: '模块', run: function () { ctx.go('playground'); } });
      ctx.log('Playground 已加载');
    }
  });
})(window.MUI = window.MUI || {});
