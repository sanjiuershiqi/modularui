# ModularUI

零构建、无依赖的可扩展应用内核 —— 把页面、组件、插槽、命令与主题拆成可插拔的模块。

直接用浏览器打开 `index.html` 即可运行；或用任意静态服务器托管（无需打包）。

## 特性

- **模块内核**：语义化版本依赖解析、拓扑激活、循环检测、能力权限门控、作用域自动回收、配置 schema、存储迁移、远程加载（`MUI.mods.load(url)`）。
- **组件系统**：注册表 + `ui.*` 门面，可注册或覆盖任意内置组件。
- **插槽系统**：`data-slot` 挂载点，模块卸载时自动清理。
- **路由**：页面注册、参数、面包屑、View Transitions。
- **命令面板 / 快捷键**：模糊搜索、最近使用、作用域快捷键、快捷键帮助（`Ctrl/⌘ + /`）。
- **响应式状态**：`signal / computed / effect / reactive`，带微任务批处理。
- **主题引擎**：双色配色方案（12 套）、`light / sepia / dark / system`、密度 / 圆角 / 字号、瞬变动效、高对比模式。
- **内置组件（58 个）**：表单、数据表格、图表（面积 / 柱状 / 环形 / 进度 / 迷你图）、时间线、覆盖层、命令式弹层等。
- **可观测性**：运行日志视图（捕获 `ctx.log/warn/error` 与内核输出）+ 模块依赖图可视化。
- **Editorial 皮肤**：直角、硬偏移投影、45° 斜纹、大写字标。

## 文档

- **插件 / 模块开发文档**：[`docs/PLUGIN_API.md`](docs/PLUGIN_API.md) —— 清单字段、生命周期、能力权限、`ctx` 全量 API、事件与钩子、内置组件、完整模板与常见坑。面向模块作者与 AI 代码生成。
- **TypeScript SDK 类型**：[`types/modularui.d.ts`](types/modularui.d.ts)
- **Manifest JSON Schema**：[`schemas/module-manifest.schema.json`](schemas/module-manifest.schema.json)
- **插件模板**：[`templates/module.template.js`](templates/module.template.js)
- **Manifest 示例**：[`examples/module-manifest.json`](examples/module-manifest.json)

## 运行 / 开发

```bash
# 方式一：直接打开 index.html
# 方式二：本地静态服务器
python -m http.server 8000     # 然后访问 http://localhost:8000
```

### 在 VS Code 中开发插件

项目已包含 `jsconfig.json` 与 `.vscode/settings.json`：

1. 用 VS Code 打开仓库根目录；
2. 从 `templates/module.template.js` 复制一个插件模板到 `plugins/`；
3. 编辑器会自动识别全局 `MUI`、`ModuleContext`、`ModuleManifest` 等类型；
4. 新建 `plugins/my-module.manifest.json` 时，会自动启用 `schemas/module-manifest.schema.json` 校验；
5. 如果提示找不到 TypeScript 类型，可安装项目依赖后重载窗口：

```bash
npm install -D typescript
```

也可以在插件文件顶部显式引用类型：

```js
/// <reference path="../types/modularui.d.ts" />

MUI.defineModule({
  id: 'acme.example',
  version: '1.0.0',
  apiVersion: '^2.0.0',
  activate(ctx) {
    ctx.log('ready');
  }
});
```

## 目录结构

```
index.html
css/  tokens.css · app.css · components.css · skin.css
js/
  core/      util · icons · state · dom · platform · ui-core · mods · registry
  components/ primitives · widgets
  views/     main · docs · system
  modules/   demos
  boot.js
```

## 写一个模块

```js
MUI.defineModule({
  id: 'acme.analytics',
  name: 'Analytics',
  version: '1.2.0',
  apiVersion: '^2.0.0',
  requires: { 'acme.core': '^1.0.0' },   // semver 依赖
  permissions: ['timers'],               // 能力权限（http/timers/clipboard 需声明）
  config: { interval: { type: 'number', default: 1500 } },

  activate(ctx) {
    // 注入界面
    ctx.slot('dashboard.top', () => ctx.ui.card({ title: '实时指标' }))
    // 注册页面
    ctx.view('analytics', { title: '分析', render: () => ctx.ui.empty({ title: '待建设' }) })
    // 注册命令 / 快捷键 / 设置项
    ctx.command({ id: 'analytics.refresh', title: '刷新指标', run: () => {} })
    // 需要 timers 权限；停用时随作用域自动清理
    ctx.setInterval(() => {}, ctx.getConfig('interval'))
  }
})
```

## 部署

GitHub Pages：仓库 **Settings → Pages → Source: Deploy from a branch → `main` / `/ (root)`**，
访问 `https://<user>.github.io/<repo>/`。

## License

MIT
