/// <reference path="../types/modularui.d.ts" />

MUI.defineModule({
  id: 'examples.typed-module',
  name: 'Typed Module Example',
  version: '1.0.0',
  apiVersion: '^2.0.0',
  permissions: ['timers'],
  config: {
    interval: { type: 'number', default: 1500, label: '采样间隔' }
  },
  activate(ctx: ModuleContext) {
    const count = ctx.signals.signal(0);
    ctx.slot('dashboard.top', () => ctx.ui.card({
      title: 'Typed Module',
      children: [ctx.bind(() => ctx.h('strong', {}, String(count.get())))]
    }));
    ctx.setInterval(() => count.update(value => value + 1), ctx.getConfig<number>('interval'));
  }
});
