# ModularUI 插件（模块）开发文档

面向模块作者（含 AI 代码生成）。按本文即可编写、注册、调试一个模块。
框架零构建、无依赖；模块就是「一个清单对象 + 若干生命周期函数」。

> 第一阶段 SDK 文件：`types/modularui.d.ts`、`schemas/module-manifest.schema.json`、`templates/module.template.js`、`examples/module-manifest.json`。
> 如果编辑器支持 JSON Schema，可以把 manifest 文件的 `$schema` 指向 `../schemas/module-manifest.schema.json`。

---

## 0. 最小可用模块

```html
<!-- 1. 页面先加载框架：index.html 里已按顺序引入 js/** -->
<!-- 2. 你的模块文件单独引入即可（放到 js/modules/ 并加 <script>，或用 MUI.mods.load(url)） -->
<script src="/plugins/hello.js"></script>
```

```js
// plugins/hello.js
MUI.defineModule({
  id: 'acme.hello',           // 必填，全局唯一
  name: 'Hello',
  version: '1.0.0',
  apiVersion: '^2.0.0',
  description: '一个示例模块',

  activate(ctx) {
    ctx.slot('home.hero', () => ctx.ui.card({
      title: '来自 Hello 模块',
      children: ['Hello, ModularUI!']
    }));
    ctx.command({ id: 'hello.greet', title: '打个招呼', run: () => ctx.toast('你好') });
    ctx.log('已加载');
  }
});
```

`activate`（也可写成 `setup`）在依赖满足后异步执行；模块停用时，`ctx` 注册的一切资源（插槽/页面/命令/快捷键/设置/样式/定时器/订阅/副作用）都会**自动回收**。

---

## 1. Manifest（清单）字段

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `id` | string | **必填** | 模块唯一标识，建议反向域名 `vendor.name` |
| `name` | string | = `id` | 展示名 |
| `version` | semver | `0.0.0` | 非法版本会抛错 |
| `apiVersion` | semver range | `*` | 要求的内核 API（当前内核 `2.0.0`），不满足则不激活 |
| `author` | string \| `{name,url}` | — | 作者 |
| `description` | string | — | 描述 |
| `icon` | string | `puzzle` | 内置图标名（见 `MUI.icons`） |
| `homepage` / `license` | string | — | 元信息 |
| `requires` | `{ id: range }` | — | **强依赖**；缺失/不满足则不激活并记录原因 |
| `optional` | `{ id: range }` | — | 可选依赖；存在则尝试激活，不阻塞 |
| `permissions` | string[] | `[]` | 需要显式声明的敏感能力（见第 3 节） |
| `config` | object | `{}` | 配置 schema（见 2.2） |
| `storageVersion` | number | `1` | 存储版本，变更时触发 `migrate` |
| `migrate` | `(store, from, to) => store` | — | 存储迁移 |
| `timeout` | number(ms) | `6000` | 各生命周期超时 |
| `autoEnable` | boolean | `true` | 注册后是否自动激活 |
| `builtin` / `remote` | boolean | `false` | 标记用途（只读） |
| `preload(ctx)` | function | — | 激活前调用（异步） |
| `install(ctx)` | function | — | 仅首次调用一次（异步） |
| `activate(ctx)`/`setup(ctx)` | function | — | 启用时调用（异步） |
| `deactivate(ctx)` | function | — | 停用前调用（异步） |
| `uninstall(ctx)` | function | — | 卸载前调用 |

---

## 2. 生命周期与配置

### 2.1 状态机与激活顺序

```
registered → resolving → activating → active
                      ↘ inactive（依赖未满足/超时/报错）
active → deactivating → inactive
error（生命周期抛错）
```

- 依赖图按**拓扑顺序**激活；`requires` 里的模块会先激活。
- 检测循环依赖、缺失依赖；失败信息见 `MUI.mods.info(id).error`。
- 循环依赖会被标记为 `inactive`，不会继续递归激活或阻塞其它模块。
- 生命周期抛错会进入 `error` 状态并通过 `mod:error` 弹出通知；**不会影响其它模块**。
- 生命周期支持 `async`，受 `timeout` 限制。

### 2.2 配置 schema

```js
config: {
  greeting: { type: 'string',  label: '问候语', default: 'Hello' },
  interval: { type: 'number',  label: '间隔(ms)', default: 1500, min: 200, max: 10000 },
  live:     { type: 'boolean', label: '实时',    default: true },
  mode:     { type: 'select',  label: '数据源',  default: 'sim', options: [
    { label: '模拟', value: 'sim' }, { label: '实时', value: 'live' }
  ] }
}
// 简写： config: { greeting: 'Hello', live: true }
```

- `ctx.config` 是**响应式对象**：`ctx.config.greeting`、在 `ctx.bind/effect` 里读取即可。
- `ctx.getConfig(k)` / `ctx.setConfig(k, v)` / `ctx.resetConfig()`；改动自动持久化。
- 非法值会被纠正为默认值；`select` 只接受 `options` 内的值。
- 设置页可自动渲染这些配置（模块详情抽屉）。

### 2.3 存储与迁移

```js
storageVersion: 2,
migrate(store, from, to) {
  if (from < 2) store.items = store.items || [];
  return store;
},
activate(ctx) {
  ctx.store.set('count', (ctx.store.get('count', 0)) + 1);
}
```

`ctx.store` 命名空间为 `mod:<id>`，API：`get(k,d)` `set(k,v)` `update(k,fn)` `remove(k)` `all()` `keys()` `clear()` `watch(cb)`。

---

## 3. 能力权限（Capabilities）

敏感能力**必须在 `permissions` 中声明**，否则调用会抛 `PermissionError`：

| 能力 | 默认 | 说明 |
|---|---|---|
| `ui.slot` `ui.view` `ui.component` `ui.style` `ui.theme` | ✅ 已授予 | 界面相关 |
| `ui.overlay` `ui.notifications` `ui.settings` `ui.commands` `ui.hotkeys` | ✅ 已授予 | 交互相关 |
| `events` `hooks` `storage` `i18n` | ✅ 已授予 | 系统相关 |
| **`http`** | ❌ 需声明 | `ctx.http` / `ctx.fetch` |
| **`timers`** | ❌ 需声明 | `ctx.setTimeout/ setInterval` |
| **`clipboard`** | ❌ 需声明 | `ctx.copy` |

```js
MUI.defineModule({
  id: 'acme.analytics',
  version: '1.0.0',
  apiVersion: '^2.0.0',
  permissions: ['http', 'timers'],
  async activate(ctx) {
    const data = await ctx.http.get('/api/stats');   // 已授权
    ctx.setInterval(refresh, 5000);                    // 已授权
    // 未声明时： ctx.http 访问即抛 PermissionError
  }
});
```

`ctx.permissions.has(cap)` / `ctx.permissions.list()`；模块信息里带 `permissions[]`（含 `granted/kind`）与 `denied[]`。

---

## 4. 依赖与版本

```js
requires: { 'acme.core': '^1.0.0' },
optional: { 'acme.theme': '~2.1.0' },
```

支持的 range：`*`、`^1.2.3`、`~1.2.3`、`>=1 <2`、`1.2.x`、`1 || 2`。
跨模块调用用 `expose` / `require`：

```js
// 提供方
activate(ctx) { ctx.expose({ greet: (n) => 'hi ' + n }); }

// 消费方（requires 里声明依赖）
activate(ctx) {
  const core = ctx.require('acme.core');   // 已激活模块的 exports
  core.greet('world');
}
```

`ctx.require(id)` 在依赖未激活时抛错；因此它只能读取 `requires`/`optional` 里声明的模块。

---

## 5. `ctx` API 参考

> 所有通过 `ctx` 注册的东西都会在模块停用时自动回收。

### 5.1 元信息 / 日志

`ctx.id` `ctx.name` `ctx.version` `ctx.apiVersion` `ctx.manifest`
`ctx.log(...)` `ctx.debug(...)` `ctx.warn(...)` `ctx.error(...)` — 同时输出到控制台与内置「运行日志」。
`ctx.permissions.has(cap)` `ctx.permissions.list()`

### 5.2 配置
`ctx.config`（响应式）· `ctx.getConfig(k)` · `ctx.setConfig(k,v)` · `ctx.resetConfig()` · `ctx.configSchema`

### 5.3 界面 — 插槽
```js
const off = ctx.slot('home.feed', () => ctx.ui.card({ title: 'X' }), { priority: 10 });
ctx.slots();                 // 现有插槽名
```
内置挂载点：`header.left` `header.right` `header.title` `sidebar.nav` `view.top` `view.bottom`（页面内可自建 `data-slot="..."`）。

### 5.4 界面 — 页面
```js
ctx.view('lab', {
  title: '实验室', icon: 'play', order: 9,
  nav: { group: '资源', order: 9, label: '实验室', badge: () => 3, hidden: false },
  tab: { label: '实验室', icon: 'play', order: 3 },   // 或 tab: true
  beforeEnter(ctx) { return true; },                   // 返回 false 取消导航
  render(ctx) { return ctx.ui.empty({ title: '内容' }); },
  onEnter(ctx) {}, onLeave(ctx) {}
});
ctx.page('docs', { title: '文档', render: () => ctx.ui.empty({}) }); // = view + tab:true
ctx.go('lab'); ctx.back();
```

### 5.5 界面 — 组件
```js
ctx.component.define('metric', (p) => ctx.ui.card({ children: [String(p.value)] }));
ctx.component.use('metric', { value: 42 });
ctx.component.override('card', (p) => { const el = MUI.components.get('card')(p); el.classList.add('x'); return el; }); // 返回可还原
ctx.component.get(name) / has(name) / list()
ctx.define(name, factory) / ctx.override(name, factory) // 等价简写
```

### 5.6 界面 — 样式
```js
ctx.style('.acme-badge{ color: var(--accent); }');   // 停用时移除
```

### 5.7 交互 — 命令 / 快捷键 / 设置项
```js
ctx.command({
  id: 'acme.refresh', title: '刷新数据', subtitle: 'acme', group: '模块',
  icon: 'refresh', keywords: 'reload', keybinding: 'mod+shift+r',
  when: () => true, run: (cmd) => {}
});
ctx.hotkey('mod+shift+r', () => {}, { scope, when, preventDefault });
ctx.setting({ order: 30, render: () => ctx.ui.switchRow({ title: '开关' }) });
```

### 5.8 交互 — 覆盖层 / 通知
```js
ctx.toast('保存成功', 'success');
ctx.toast({ title: '已保存', text: '...', type: 'success', duration: 2000 });
ctx.notify({ type: 'warning', title: '配额不足', text: '...', action: node, duration: 0 });
ctx.modal({ title, desc, icon, body, actions: [{ label, tone, onClick, value }] });
await ctx.confirm({ title: '删除？', danger: true });     // → boolean
await ctx.prompt({ title: '重命名', value: 'x' });          // → string | null
ctx.sheet({ title, content }); ctx.actionSheet({ title, items }); ctx.menu(items, { x, y, at });
ctx.loading.show('处理中…'); ctx.loading.hide();
```

### 5.9 数据 — 存储 / HTTP / 日志 / i18n
```js
ctx.store.set('k', v); ctx.store.get('k');
const d = await ctx.http.get('/api/x'); ctx.http.post('/api/x', { a: 1 });
ctx.http.use('response', (res) => res);   // 拦截器
ctx.i18n.register('zh-CN', { 'k': '值' }); ctx.i18n.t('k', { n: 1 });
MUI.logs.list(); // 运行日志
```

### 5.10 响应式（随模块自动回收）
```js
const c = MUI.signal(0);              // 或 ctx.signals.signal(0)
ctx.text(c);                           // 绑定到 signal 的文本节点
ctx.bind(() => ctx.h('b', {}, String(c.get())));  // 依赖变化重渲染
ctx.list(itemsSignal, (it) => ctx.ui.listItem({ title: it.t }));
const r = ctx.resource(async () => (await ctx.http.get('/api')).items); // {data,error,loading,reload}
ctx.persist(c, 'count');               // signal ↔ localStorage（模块命名空间）
ctx.scope((s) => { /* 其它副作用 */ }); // 统一回收
```
也可用 `ctx.signals.{signal,computed,effect,reactive,watch,batch}`。

### 5.11 事件 / 钩子
```js
ctx.on('router:navigate', (name) => {});       // 事件（自动解绑）
ctx.emit('acme:done', payload);
ctx.hook('route:render', (node, cx, def) => node);   // 过滤器（改值）
ctx.action('route:mounted', (name) => {});           // 动作（副作用）
```

**事件（`bus`）**：`app:ready` `store:set` `store:changed` `theme:mode` `theme:accent` `i18n:changed` `logs:changed` `commands:changed` `component:defined|overridden|restored` `slot:mount|unmount` `router:navigate` `router:changed` `settings:changed` `mod:registered|enabled|disabled|state|error|exports|activated|config` `mods:changed`

**钩子**：
- 动作：`app:ready` `route:registered` `route:beforeRender` `route:afterRender` `route:mounted` `mod:registered` `mod:enabled` `mod:disabled` `mod:error`
- 过滤器：`route:render(node, ctx, def)` `route:title(title, def)` `mod:context(ctx, info)`

### 5.12 DOM 工具
`ctx.observer(el, cb)` · `ctx.intersect(el, cb, opts)` · `ctx.drag(el, {start,move,end,filter})`

### 5.13 其它
`ctx.ui`（组件门面）· `ctx.h` · `ctx.icon(name,size,width)` · `ctx.utils` · `ctx.components` · `ctx.expose(obj)` · `ctx.require(id)` · `ctx.dispose(fn)` / `ctx.onDispose(fn)`

---

## 6. 全局 API（`window.MUI`）

```js
MUI.version / MUI.mods.API_VERSION
MUI.h(tag, props, ...children) / MUI.svg(tag, props, ...) / MUI.fragment(...) / MUI.icon(name, size)
MUI.ui.*                      // 组件门面（见第 7 节）
MUI.components.define/use/get/override/list
MUI.slots.register(name, render, opt) / render / renderAll / names
MUI.router.register/navigate/back/current/params
MUI.overlay.toast/notify/modal/confirm/prompt/sheet/actionSheet/menu/loading
MUI.commands.register/run/list/search/recent
MUI.keys.register(combo, fn, {scope}) / format / scope
MUI.settings.register(owner, item)
MUI.theme.setMode/setAccent/setPalette/setDensity/setRadiusStyle/setFontScale/setMotion/setContrast/toggle
MUI.i18n.register/t/setLocale
MUI.http.get/post/put/patch/delete/request/use
MUI.bus.on/once/off/emit/onAny
MUI.hooks.addFilter/addAction/applyFilters/doAction
MUI.state / MUI.signal / MUI.computed / MUI.effect / MUI.reactive / MUI.watch / MUI.batch
MUI.createStore(ns, {version, migrate}) / MUI.store
MUI.logs.push/list/count/clear/on
MUI.util.*                    // uid/isNode/clamp/debounce/throttle/copy/formatDate/hexToRgb...
MUI.semver.parse/compare/satisfies
MUI.Scope / MUI.scope(fn) / MUI.text / MUI.bind / MUI.list / MUI.persist / MUI.resource / MUI.observer / MUI.intersect / MUI.drag / MUI.autoDispose
MUI.app.ready(fn) / MUI.app.on/emit
```

模块内核：`MUI.mods.{define,register,validate,enable,disable,enableAll,disableAll,reload,uninstall,get,info,state,waitFor,list,has,require,load,graph,diagnostics,onChange}`

### 6.1 生产环境模块治理接口

```js
const result = MUI.mods.validate(manifest);
// { valid: boolean, errors: string[], warnings: string[] }

await MUI.mods.enableAll();
await MUI.mods.disableAll();
await MUI.mods.waitFor('acme.analytics', 10000);
MUI.mods.state('acme.analytics');
```

`validate()` 适合在安装、CI 或远程加载前调用；`waitFor()` 适合宿主在模块异步激活后再挂载依赖 UI。生产系统应在调用 `load()` 后检查返回的模块信息与 `error`，不要只依赖 `autoEnable`。

---

## 7. 内置组件（`ctx.ui.*` / `MUI.ui.*`）

**布局**：`stack row grid masonry spacer divider rule box panel toolbar`
**排版**：`heading text kbd code codeblock badge statusPill chip`
**按钮**：`button iconButton buttonRow segmented`
**表单**：`field input textarea select searchInput switch switchRow checkbox radioGroup slider stepper`
**数据**：`table progress ring sparkline areaChart barChart donut timeline keyValue`
**导航**：`tabs collapse`
**反馈**：`banner empty skeleton spinner event`
**容器**：`card section list listItem avatar avatars`

常用 props 速查：
```js
ui.button({ label, variant: 'primary|soft|outline|ghost|danger|danger-soft', size: 'sm|lg', icon, block, disabled, onClick })
ui.card({ title, subtitle, icon, actions: [node], flush, hover, accent, footer, children })
ui.list({ items: [{ icon, title, subtitle, value, right, chevron, danger, onClick }] })
ui.table({ columns: [{ key, label, align, width, render }], rows, sortable })
ui.areaChart({ data: [..], labels: [..], height })
ui.select({ value, options: [{label,value}], onChange })
ui.event({ icon, eyebrow, title, text, variant: 'accent|ink|accent2', onClick })
ui.tabs({ items: [{ label, value, render }], value, onChange })
```

---

## 8. 事件总线与钩子清单

见 5.11。约定：事件名用 `域:动作`，模块自定义事件建议加前缀 `你的id:xxx`。

---

## 9. 主题与设计令牌

```js
ctx.theme.toggle();                       // 明暗
ctx.theme.setMode('light|sepia|dark|system');
ctx.theme.setPalette('靛蓝');              // 12 套双色配色
ctx.theme.setAccent('#5b4df0');           // 自定义主色（自动生成色阶）
ctx.theme.setVar('radius', '4px');        // 任意 CSS 变量（--m- 前缀可选）
ctx.theme.getVar('accent');
ctx.theme.subscribe((mode) => {});
```

可覆盖的 CSS 变量（节选）：`--m-primary` `--m-primary-2` `--m-accent-2` `--m-bg` `--m-surface` `--m-text` `--m-border` `--r-md` `--dur-2`。
复用视觉语言：类 `rail` `stripebar` `rule` `event` `t-outline` `masonry` `badge--accent`。

---

## 10. 远程 / 动态加载

```js
const added = await MUI.mods.load('/plugins/analytics.js', { timeout: 12000 });
// 该文件内容即 MUI.defineModule({...})；加载后 autoEnable 生效
```
也可由宿主主动注册：`MUI.mods.register(manifest, setup)`。

---

## 11. 调试

```js
MUI.mods.list();                 // 全部模块（public info 数组）
MUI.mods.info('acme.hello');     // 单模块：state/error/permissions/...
MUI.mods.diagnostics();          // 依赖数/被依赖数/权限
MUI.mods.graph();                // { nodes, edges }
MUI.mods.reload('acme.hello');   // 停用→重装→激活
MUI.mods.disable('acme.hello');  // 观察资源是否干净回收
MUI.logs.list();
```
界面上：**模块**页可启用/停用/重载/卸载、编辑配置、看依赖图；**运行日志**页看输出；命令面板 `Ctrl/⌘+K`；快捷键 `Ctrl/⌘+/`。

---

## 12. 完整模板（复制即用）

```js
MUI.defineModule({
  id: 'acme.dashboard',
  name: 'Dashboard Widget',
  version: '1.0.0',
  apiVersion: '^2.0.0',
  author: { name: 'Acme' },
  description: '演示：插槽 + 配置 + 响应式 + 命令 + 定时器',
  icon: 'activity',
  requires: { 'demo.foundation': '^1.0.0' },   // 依赖已有示例模块（可删）
  permissions: ['timers'],
  config: {
    title: { type: 'string', label: '标题', default: '实时指标' },
    interval: { type: 'number', label: '刷新间隔(ms)', default: 2000, min: 500, max: 20000 }
  },
  storageVersion: 1,

  activate(ctx) {
    const value = MUI.signal(ctx.store.get('value', 0));

    // 插槽卡片（响应式）
    ctx.slot('dashboard.top', () => ctx.ui.card({
      title: ctx.getConfig('title'),
      icon: 'activity',
      children: [
        ctx.bind(() => ctx.h('div', { class: 'kpi__value' }, String(value.get()))),
        ctx.ui.button({ label: '刷新', size: 'sm', variant: 'primary', onClick: () => value.update(v => v + 1) })
      ]
    }), { priority: 20 });

    // 定时刷新（需 timers 权限；随停用自动清理）
    ctx.setInterval(() => {
      value.update(v => v + 1);
      ctx.store.set('value', value.get());
    }, ctx.getConfig('interval'));

    // 命令 / 快捷键 / 设置项
    ctx.command({ id: 'acme.dashboard.reset', title: '重置指标', group: '模块', run: () => value.set(0) });
    ctx.hotkey('mod+shift+0', () => value.set(0));
    ctx.setting({ order: 40, render: () => ctx.ui.switchRow({
      title: '启用刷新', checked: true,
      onChange: (v) => ctx.toast(v ? '已开启' : '已关闭')
    }) });

    ctx.log('dashboard 就绪');
  },

  deactivate(ctx) { ctx.log('dashboard 已停用'); }
});
```

---

## 13. 约定与常见坑

1. **权限**：`http` / `timers` / `clipboard` 不声明就抛 `PermissionError`（`ctx.http` 是 getter，访问即抛）。
2. **自动回收**：不要手动管理生命周期；把一切登记到 `ctx`（或 `ctx.scope`）即可。
3. **依赖未激活**：`ctx.require(id)` 会抛错——只用它读取 `requires`/`optional` 声明过的模块。
4. **id / version**：`id` 必须唯一；`version` 必须是合法 semver，否则注册抛错。
5. **顺序**：注册用微任务异步激活；`app:ready` 后再执行 `MUI.app.ready(fn)` 回调。
6. **配置**：非法值会被纠正；`select` 必须给 `options`。
7. **视图渲染异常**：会被路由捕获并渲染错误页，不会白屏。
8. **样式作用域**：`ctx.style` 是全局 CSS，请用模块前缀类名（如 `.acme-xxx`）避免污染。
9. **性能**：`MUI.bind` 每次依赖变化整体重渲染其容器，列表较大时用 `MUI.list` 或配合 key 手动优化。
10. **不要**在 `activate` 外保存 `ctx` 并延时使用——停用后 `ctx` 已失效。

### 13.1 性能维护约定

- 高频状态更新使用 `MUI.batch(() => { ... })`，避免同一帧重复调度。
- 页面内的 `MUI.bind`、`MUI.list`、`MUI.resource` 应放在 `ctx.scope` 或视图的清理作用域中。
- 插件不要直接监听 `window`、`document`、`MUI.bus` 后丢弃返回的清理函数；统一用 `ctx.on`、`ctx.hotkey`、`ctx.observer` 等 API。
- 大列表不要在每次事件中手工 `innerHTML` 全量重绘；使用局部 `MUI.bind`，或把数据拆成分页/虚拟化区域。
- 轮询应使用 `ctx.setInterval`，不要直接使用全局 `setInterval`，这样停用模块时才能自动取消。
- 日志使用 `ctx.log`，不要在高频循环中输出大量 `console.log`；运行日志最多保留 600 条。
- 图表、瀑布流等组件必须在宽度变化时才重排，不要在高度变化或滚动事件中反复重建 DOM。
- 自定义组件的 class 必须使用模块前缀（例如 `.acme-analytics-*`），避免覆盖其它模块。

---

## 14. 让 AI 生成插件的建议提示词

> 用 ModularUI（`apiVersion: '^2.0.0'`）写一个模块：id `vendor.name`，功能是 …。
> 要求：用 `MUI.defineModule`；声明所需 `permissions`；用 `ctx.slot`/`ctx.view` 注入界面；
> 用 `ctx.config` 暴露配置；用 `ctx.store` 持久化；跨模块用 `ctx.expose/require`；
> 所有资源通过 `ctx` 注册以便自动回收。只输出该模块的 JS 文件。

## 15. TypeScript 与 Manifest 工作流

项目提供 `types/modularui.d.ts`，插件可以直接使用：

```ts
/// <reference path="../types/modularui.d.ts" />

const moduleDefinition: ModuleManifest = {
  id: 'acme.analytics',
  version: '1.0.0',
  apiVersion: '^2.0.0',
  permissions: ['timers'],
  config: { interval: { type: 'number', default: 1500 } },
  activate(ctx: ModuleContext) {
    ctx.setInterval(() => ctx.log('tick'), ctx.getConfig<number>('interval'));
  }
};

MUI.defineModule(moduleDefinition);
```

Manifest 与运行时代码建议分离：

```text
plugin/
  manifest.json       # 可用 JSON Schema 校验
  index.js            # 调用 MUI.defineModule()
```

AI 生成模块时必须先完成这几项检查：

1. `id` 使用唯一的 `vendor.name` 格式；
2. `version` 与 `apiVersion` 使用合法 semver；
3. 访问网络、定时器、剪贴板时声明对应 permission；
4. 所有监听、定时器、DOM 观察器通过 `ctx` 注册；
5. 停用模块后不得残留事件、样式、路由、插槽或响应式 effect；
6. 在提交前运行 `MUI.mods.validate(manifest)`。
