/* ==========================================================================
   views/system.js — modules manager + settings
   ========================================================================== */
(function (MUI) {
  'use strict';
  var h = MUI.h, ui = MUI.ui, icon = MUI.icon, router = MUI.router, util = MUI.util;

  function stateLabel(s) {
    return ({ active: '运行中', inactive: '已停用', error: '错误', registered: '已注册', resolving: '解析依赖', activating: '激活中', deactivating: '停用中' })[s] || s;
  }

  function configEditor(rec) {
    var schema = rec.configSchema || {};
    var keys = Object.keys(schema);
    if (!keys.length) return h('div', { class: 't-caption', text: '该模块没有可配置项。' });
    return h('div', { class: 'stack', style: 'gap:14px' }, keys.map(function (k) {
      var def = schema[k];
      var cur = rec.configValues[k];
      if (def.type === 'boolean') {
        return h('div', { class: 'row', style: 'justify-content:space-between' }, [
          h('div', {}, [h('div', { class: 't-h3', text: def.label || k }), def.description ? h('div', { class: 't-caption', text: def.description }) : null]),
          ui.switch({ checked: cur, onChange: function (v) { rec.ctx.setConfig(k, v); } })
        ]);
      }
      if (def.type === 'select') {
        return ui.field({ label: def.label || k, control: ui.select({ value: cur, options: def.options || [], onChange: function (v) { rec.ctx.setConfig(k, v); } }) });
      }
      if (def.type === 'number') {
        return h('div', { class: 'stack', style: 'gap:6px' }, [
          h('div', { class: 't-h3', text: def.label || k }),
          ui.slider({ min: def.min != null ? def.min : 0, max: def.max != null ? def.max : 100, value: cur, onInput: function (v) { rec.ctx.setConfig(k, v); } })
        ]);
      }
      return ui.field({ label: def.label || k, hint: k, control: ui.input({ value: cur, flush: true, onInput: function (v) { rec.ctx.setConfig(k, v); } }) });
    }));
  }

  function openModuleSheet(id) {
    var rec = MUI.mods.get(id);
    if (!rec) return;
    var info = MUI.mods.info(id);
    var edges = MUI.mods.graph().edges.filter(function (e) { return e.from === id || e.to === id; });
    var ctl = ui.sheet({
      title: rec.name,
      content: h('div', { class: 'stack', style: 'gap:18px' }, [
        h('div', { class: 'row', style: 'gap:10px' }, [
          h('span', { style: 'display:grid;place-items:center;width:40px;height:40px;border-radius:12px;background:var(--accent-50);color:var(--accent-700)' }, icon(rec.icon || 'puzzle', 19)),
          h('div', { style: 'flex:1;min-width:0' }, [
            h('div', { class: 't-h2', text: rec.name }),
            h('div', { class: 'mono faint', text: id + '@' + info.version + '  ·  API ' + info.apiVersion })
          ]),
          ui.statusPill({ state: info.state, label: stateLabel(info.state) })
        ]),
        rec.description ? h('p', { class: 't-body', text: rec.description }) : null,
        info.error ? ui.banner({ tone: 'danger', title: '运行错误', text: info.error }) : null,

        h('div', {}, [
          h('div', { class: 't-h3', style: 'margin-bottom:8px' }, '能力权限'),
          h('div', { class: 'row row-wrap', style: 'gap:6px' }, info.permissions.length ? info.permissions.map(function (p) {
            return ui.badge({ text: p.label + (p.granted ? '' : ' · 未授权'), tone: p.granted ? (p.kind === 'sensitive' ? 'warning' : 'default') : 'danger' });
          }) : [h('span', { class: 't-caption', text: '无需特殊权限' })])
        ]),

        Object.keys(info.requires).length || edges.length ? h('div', {}, [
          h('div', { class: 't-h3', style: 'margin-bottom:8px' }, '依赖关系'),
          ui.keyValue({ items: Object.keys(info.requires).map(function (d) { return { k: d, v: info.requires[d] }; }).concat(edges.filter(function (e) { return e.from === id && e.kind === 'optional'; }).map(function (e) { return { k: e.to, v: '可选' }; })) })
        ]) : null,

        Object.keys(rec.configSchema || {}).length ? h('div', {}, [
          h('div', { class: 't-h3', style: 'margin-bottom:10px' }, '模块配置'),
          configEditor(rec)
        ]) : null,

        h('div', { class: 'row', style: 'gap:8px' }, [
          ui.button({ label: '重新加载', icon: 'refresh', variant: 'outline', onClick: function () { MUI.mods.reload(id).then(function () { ui.toast('已重新加载 ' + rec.name, 'success'); ctl.close(); }); } }),
          ui.button({ label: '卸载', icon: 'trash', variant: 'danger-soft', onClick: function () { ui.confirm({ title: '卸载 ' + rec.name + '？', desc: '其注册的界面、命令与存储将被移除。', danger: true }).then(function (ok) { if (ok) MUI.mods.uninstall(id).then(function () { ui.toast('已卸载', 'danger'); ctl.close(); }); }); } })
        ])
      ])
    });
  }

  router.register('modules', {
    title: '模块', icon: 'cpu', order: 11,
    nav: { group: '资源', order: 11, label: '模块', badge: function () { return MUI.mods.list().length; } },
    render: function () {
      var root = h('div', { class: 'view' });
      function paint() {
        MUI.clear(root);
        var mods = MUI.mods.list();
        var active = mods.filter(function (m) { return m.state === 'active'; }).length;
        var errored = mods.filter(function (m) { return m.state === 'error'; }).length;

        root.appendChild(ui.grid({ min: '150px', children: [
          ui.card({ pad: true, children: h('div', { class: 'kpi' }, [h('div', { class: 'kpi__label', text: '已加载模块' }), h('div', { class: 'kpi__value', text: String(mods.length) })]) }),
          ui.card({ pad: true, children: h('div', { class: 'kpi' }, [h('div', { class: 'kpi__label', text: '运行中' }), h('div', { class: 'kpi__value', style: 'color:var(--success-text)', text: String(active) })]) }),
          ui.card({ pad: true, children: h('div', { class: 'kpi' }, [h('div', { class: 'kpi__label', text: '异常' }), h('div', { class: 'kpi__value', style: 'color:' + (errored ? 'var(--danger-text)' : 'inherit'), text: String(errored) })]) }),
          ui.card({ pad: true, children: h('div', { class: 'kpi' }, [h('div', { class: 'kpi__label', text: 'API 版本' }), h('div', { class: 'kpi__value', text: MUI.mods.API_VERSION })]) })
        ] }));

        root.appendChild(h('div', { class: 'row', style: 'justify-content:space-between;gap:12px;flex-wrap:wrap' }, [
          h('div', {}, [
            h('div', { class: 't-h2', text: '模块管理' }),
            h('div', { class: 't-caption', text: '启用、停用、重载与诊断模块。' })
          ]),
          h('div', { class: 'buttonrow' }, [
            ui.button({ label: '从 URL 安装', icon: 'download', variant: 'outline', size: 'sm', onClick: function () {
              ui.prompt({ title: '从 URL 加载模块', placeholder: 'https://example.com/my-module.js' }).then(function (url) {
                if (!url) return;
                var close = ui.loading.show('正在加载模块…');
                MUI.mods.load(url).then(function (added) {
                  close(); ui.toast('已加载 ' + added.length + ' 个模块', 'success');
                }).catch(function (e) { close(); ui.toast({ title: '加载失败', text: e.message, type: 'danger' }); });
              });
            } }),
            ui.button({ label: '刷新', icon: 'refresh', size: 'sm', onClick: function () { paint(); ui.toast('已刷新'); } })
          ])
        ]));

        root.appendChild(h('div', { class: 'list' }, mods.map(function (m) {
          var row = h('div', { class: 'listitem' }, [
            h('span', { class: 'listitem__icon' }, icon(m.icon || 'puzzle', 16)),
            h('div', { class: 'listitem__main' }, [
              h('div', { class: 'row', style: 'gap:8px' }, [
                h('span', { class: 'listitem__title', text: m.name }),
                ui.statusPill({ state: m.state, label: stateLabel(m.state) }),
                m.permissions.some(function (p) { return p.kind === 'sensitive'; }) ? ui.badge({ text: '敏感权限', tone: 'warning' }) : null
              ]),
              h('div', { class: 'listitem__sub', text: m.id + ' · v' + m.version + ' · ' + (m.author || '未知') + (m.activationMs != null ? ' · ' + m.activationMs + 'ms' : '') }),
              m.error ? h('div', { class: 't-caption', style: 'color:var(--danger-text);margin-top:3px', text: m.error }) : null
            ]),
            h('div', { class: 'listitem__trail' }, [
              ui.iconButton({ icon: 'info', title: '详情', onClick: function () { openModuleSheet(m.id); } }),
              ui.iconButton({ icon: 'refresh', title: '重载', onClick: function () { MUI.mods.reload(m.id).then(function () { ui.toast('已重载 ' + m.name, 'success'); }); } }),
              ui.switch({ checked: m.state === 'active', onChange: function (v) { if (v) MUI.mods.enable(m.id); else MUI.mods.disable(m.id); } })
            ])
          ]);
          return row;
        })));

        var graph = MUI.mods.graph();
        root.appendChild(ui.grid({ min: '340px', children: [
          ui.section({ title: '诊断', icon: 'activity', children: ui.card({ flush: true, children: h('div', { class: 'stack', style: 'gap:8px;padding:14px' }, MUI.mods.diagnostics().map(function (d) {
            return h('div', { class: 'row', style: 'gap:8px' }, [
              h('span', { class: 'mono', style: 'flex:1', text: d.id }),
              ui.badge({ text: d.dependencies + ' 依赖' }),
              ui.badge({ text: d.dependents + ' 被依赖' }),
              ui.statusPill({ state: d.state, label: stateLabel(d.state) })
            ]);
          })) }) }),
          ui.section({ title: '依赖图', icon: 'gitBranch', children: ui.card({ flush: true, children: h('div', { class: 'stack', style: 'gap:6px;padding:14px' },
            graph.edges.length ? graph.edges.map(function (e) {
              return h('div', { class: 'row', style: 'gap:7px;font-family:var(--mono);font-size:var(--fs-sm)' }, [
                h('span', { text: e.from }),
                h('span', { class: 'faint', text: e.kind === 'optional' ? '⇢' : '→' }),
                h('span', { text: e.to }),
                e.kind === 'optional' ? ui.badge({ text: 'optional' }) : null
              ]);
            }) : [h('span', { class: 't-caption', text: '暂无依赖关系' })]
          ) }) })
        ] }));
      }
      paint();
      MUI.bus.on('mods:changed', paint);
      root.__cleanup = function () { };
      return root;
    }
  });

  router.register('settings', {
    title: '设置', icon: 'settings', order: 20, tab: true,
    nav: { group: '系统', order: 20, label: '设置' },
    render: function () {
      var root = h('div', { class: 'view' });
      function paint() {
        MUI.clear(root);
        root.appendChild(ui.section({
          title: '外观', icon: 'palette',
          children: ui.card({ flush: true, children: h('div', {}, [
            h('div', { class: 'listitem', style: 'flex-direction:column;align-items:stretch;gap:10px' }, [
              h('div', {}, [h('div', { class: 'listitem__title', text: '主题模式' }), h('div', { class: 'listitem__sub', text: '浅色 / 深色 / 跟随系统' })]),
              ui.segmented({ block: true, value: MUI.theme.mode(), items: [{ label: '浅色', value: 'light' }, { label: '棕褐', value: 'sepia' }, { label: '深色', value: 'dark' }, { label: '自动', value: 'system' }], onChange: function (v) { MUI.theme.setMode(v); paint(); } })
            ]),
            h('div', { class: 'listitem', style: 'flex-direction:column;align-items:stretch;gap:10px' }, [
              h('div', {}, [h('div', { class: 'listitem__title', text: '配色方案' }), h('div', { class: 'listitem__sub', text: '双色语义：主色 + 强调色' })]),
              h('div', { class: 'palette-grid' }, MUI.theme.palettes.map(function (p) {
                var active = MUI.theme.palette() === p.name;
                return h('button', { type: 'button', title: p.name, class: 'palette-swatch' + (active ? ' is-active' : ''), onClick: function () { MUI.theme.setPalette(p.name); paint(); } }, [
                  h('span', { class: 'palette-swatch__colors' }, [h('i', { style: 'background:' + p.a1 }), h('i', { style: 'background:' + p.a2 })]),
                  h('span', { class: 'palette-swatch__name', text: p.name })
                ]);
              }))
            ]),
            h('div', { class: 'listitem', style: 'flex-direction:column;align-items:stretch;gap:10px' }, [
              h('div', { class: 'listitem__title', text: '圆角' }),
              ui.segmented({ block: true, value: MUI.theme.radiusStyle(), items: [{ label: '直角', value: 'sharp' }, { label: '柔和', value: 'soft' }, { label: '圆润', value: 'round' }], onChange: function (v) { MUI.theme.setRadiusStyle(v); paint(); } })
            ]),
            h('div', { class: 'listitem', style: 'flex-direction:column;align-items:stretch;gap:10px' }, [
              h('div', { class: 'listitem__title', text: '密度' }),
              ui.segmented({ block: true, value: MUI.theme.density(), items: [{ label: '紧凑', value: 'compact' }, { label: '舒适', value: 'cozy' }], onChange: function (v) { MUI.theme.setDensity(v); paint(); } })
            ]),
            h('div', { class: 'listitem', style: 'flex-direction:column;align-items:stretch;gap:8px' }, [
              h('div', { class: 'listitem__title', text: '字号缩放' }),
              ui.slider({ min: 0.85, max: 1.25, step: 0.05, value: MUI.theme.fontScale(), unit: '×', onInput: function (v) { MUI.theme.setFontScale(v); } })
            ]),
            ui.switchRow({ title: '瞬变动效', subtitle: '关闭过渡动画（参考稿的 --transition:0s）', checked: MUI.theme.motion() === 'instant', onChange: function (v) { MUI.theme.setMotion(v ? 'instant' : 'smooth'); } }),
            ui.switchRow({ title: '高对比模式', subtitle: '提升对比度并降低饱和度', checked: MUI.theme.contrast(), onChange: function (v) { MUI.theme.setContrast(v); } })
          ]) })
        }));

        var items = MUI.settings.list();
        if (items.length) root.appendChild(ui.section({ title: '模块设置', icon: 'cpu', children: ui.card({ flush: true, children: h('div', {}, items.map(function (it) {
          try { return it.render(); } catch (e) { return h('div', { class: 'listitem', text: '渲染失败: ' + it.id }); }
        })) }) }));

        root.appendChild(ui.section({
          title: '语言', icon: 'globe',
          children: ui.card({ flush: true, children: h('div', { class: 'listitem' }, [
            h('div', { class: 'listitem__main' }, [h('div', { class: 'listitem__title', text: '界面语言' })]),
            h('div', { style: 'flex:0 0 auto;width:170px' }, ui.select({ value: MUI.i18n.locale(), options: [{ label: '简体中文', value: 'zh-CN' }, { label: 'English', value: 'en' }], onChange: function (v) { MUI.i18n.setLocale(v); ui.toast('语言已切换'); } }))
          ]) })
        }));

        var storeKeys = Object.keys(localStorage).filter(function (k) { return k.indexOf('mui:') === 0; });
        root.appendChild(ui.section({
          title: '数据', icon: 'database',
          children: ui.card({ flush: true, children: h('div', {}, [
            h('div', { class: 'listitem' }, [h('div', { class: 'listitem__main' }, [h('div', { class: 'listitem__title', text: '本地存储命名空间' })]), h('div', { class: 'listitem__trail', text: storeKeys.length + ' 个' })]),
            h('div', { class: 'listitem listitem--tap', onClick: function () { MUI.theme.setMode('system'); MUI.theme.setAccent('#5b4df0'); MUI.theme.setDensity('cozy'); MUI.theme.setRadiusStyle('soft'); MUI.theme.setFontScale(1); paint(); ui.toast('已重置外观', 'success'); } }, [
              h('span', { class: 'listitem__icon' }, icon('refresh', 16)), h('div', { class: 'listitem__main' }, h('div', { class: 'listitem__title', text: '重置外观设置' }))
            ]),
            h('div', { class: 'listitem listitem--tap listitem--danger', onClick: function () {
              ui.confirm({ title: '清空本地数据？', desc: '将删除所有模块配置与状态。', danger: true }).then(function (ok) {
                if (!ok) return;
                Object.keys(localStorage).filter(function (k) { return k.indexOf('mui:') === 0; }).forEach(function (k) { localStorage.removeItem(k); });
                ui.toast('已清空，即将重载', 'danger'); setTimeout(function () { location.reload(); }, 700);
              });
            } }, [h('span', { class: 'listitem__icon' }, icon('trash', 16)), h('div', { class: 'listitem__main' }, h('div', { class: 'listitem__title', text: '清空本地存储' }))])
          ]) })
        }));

        root.appendChild(ui.section({
          title: '关于', icon: 'info',
          children: ui.card({ children: ui.keyValue({ items: [
            { k: '内核版本', v: 'v' + MUI.version },
            { k: 'API 版本', v: MUI.mods.API_VERSION },
            { k: '模块', v: MUI.mods.list().length + ' 个' },
            { k: '组件', v: MUI.components.list().length + ' 个' },
            { k: '路由', v: MUI.router.routes().length + ' 个' },
            { k: '构建', v: 'no-bundler · es5-friendly' }
          ] }) })
        }));
      }
      paint();
      MUI.bus.on('theme:mode', paint);
      root.__cleanup = function () { };
      return root;
    }
  });

  router.register('log', {
    title: '运行日志', icon: 'terminal', order: 21,
    nav: { group: '系统', order: 21, label: '运行日志' },
    render: function () {
      var filter = 'all', query = '', follow = true;
      var listEl = h('div', { class: 'log__list', role: 'log' });
      var statEl = h('div', { class: 'row row-wrap', style: 'gap:8px' });

      function visible() {
        var items = MUI.logs.list();
        if (filter !== 'all') items = items.filter(function (l) { return l.level === filter; });
        if (query) {
          var q = query.toLowerCase();
          items = items.filter(function (l) { return (l.scope || '').toLowerCase().indexOf(q) > -1 || l.text.toLowerCase().indexOf(q) > -1; });
        }
        return items;
      }
      function paint() {
        var items = visible();
        MUI.clear(listEl);
        if (!items.length) { listEl.appendChild(h('div', { class: 'log__empty', text: '暂无日志' })); return; }
        items.slice(-300).forEach(function (l) {
          listEl.appendChild(h('div', { class: 'log__row log__row--' + l.level }, [
            h('span', { class: 'log__time', text: util.formatDate(new Date(l.t), 'HH:mm:ss') }),
            h('span', { class: 'log__lvl log__lvl--' + l.level, text: l.level }),
            h('span', { class: 'log__scope', text: l.scope || 'kernel' }),
            h('span', { class: 'log__msg', text: l.text })
          ]));
        });
        if (follow) listEl.scrollTop = listEl.scrollHeight;
      }
      function paintStats() {
        MUI.clear(statEl);
        [['all', '全部'], ['log', '信息'], ['warn', '警告'], ['error', '错误'], ['debug', '调试']].forEach(function (x) {
          var tone = x[0] === 'error' ? 'danger' : x[0] === 'warn' ? 'warning' : x[0] === 'log' ? 'accent' : 'default';
          statEl.appendChild(ui.badge({ text: x[1] + ' ' + MUI.logs.count(x[0] === 'all' ? null : x[0]), tone: tone }));
        });
      }
      var repaint = util.throttle(function () { paint(); paintStats(); }, 160);

      var toolbar = h('div', { class: 'log__bar' }, [
        ui.segmented({ value: 'all', items: [{ label: '全部', value: 'all' }, { label: '信息', value: 'log' }, { label: '警告', value: 'warn' }, { label: '错误', value: 'error' }], onChange: function (v) { filter = v; paint(); } }),
        h('span', { class: 'spacer' }),
        h('label', { class: 'log__follow' }, [h('span', { text: '跟随' }), ui.switch({ checked: follow, onChange: function (v) { follow = v; if (v) paint(); } })]),
        ui.button({ label: '清空', size: 'sm', variant: 'outline', icon: 'trash', onClick: function () { MUI.logs.clear(); } })
      ]);
      var search = ui.searchInput({ placeholder: '搜索 scope 或内容…', onInput: function (v) { query = v; paint(); } });

      var view = h('div', { class: 'view' }, [
        ui.banner({ tone: 'accent', title: '运行日志', text: '捕获模块 ctx.log / warn / error、路由切换与内核输出，最多保留 600 条。' }),
        h('div', { class: 'row row-wrap', style: 'gap:10px;align-items:center' }, [statEl, h('span', { class: 'spacer' }), h('div', { style: 'min-width:240px;flex:1 1 240px;max-width:340px' }, search)]),
        ui.card({ flush: true, children: h('div', { class: 'log' }, [toolbar, listEl]) })
      ]);
      view.__cleanup = function () { off(); };
      var off = MUI.logs.on(repaint);
      paint(); paintStats();
      return view;
    }
  });
})(window.MUI = window.MUI || {});
