/// <reference path="../types/modularui.d.ts" />

const typedManifest: ModuleManifest = {
  id: 'examples.typed-module',
  name: 'Typed Module Example',
  version: '1.0.0',
  apiVersion: '^2.0.0',
  permissions: ['timers'],
  config: {
    interval: {
      type: 'number',
      default: 1500,
      label: '采样间隔',
      min: 500,
      max: 20000
    },
    enabled: { type: 'boolean', default: true }
  },
  activate(ctx: ModuleContext) {
    const count = ctx.signals.signal(0);

    ctx.slot('dashboard.top', () => ctx.ui.card({
      title: 'Typed Module',
      children: [ctx.bind(() => ctx.h('strong', {}, String(count.get())))]
    }));

    ctx.command({
      id: 'examples.typed-module.increment',
      title: '增加 Typed Module 计数',
      run: () => count.update((value) => value + 1)
    });

    ctx.setInterval(() => count.update((value) => value + 1), ctx.getConfig<number>('interval'));
  }
};

MUI.defineModule(typedManifest);
