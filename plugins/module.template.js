/* Copy this file to plugins/<your-module>.js and edit the manifest. */
(function (MUI) {
  'use strict';

  MUI.defineModule({
    id: 'vendor.module-name',
    name: 'Module Name',
    version: '1.0.0',
    apiVersion: '^2.0.0',
    author: { name: 'Your Name' },
    description: 'What this module does.',
    icon: 'puzzle',
    requires: {},
    optional: {},
    permissions: [],
    config: {
      enabled: { type: 'boolean', label: '启用功能', default: true }
    },
    storageVersion: 1,

    async activate(ctx) {
      ctx.slot('home.feed', () => ctx.ui.card({
        title: '来自 Module Name',
        subtitle: 'vendor.module-name · home.feed',
        children: ['Replace this with your feature.']
      }));

      ctx.command({
        id: 'vendor.module-name.run',
        title: '运行 Module Name',
        group: '模块',
        icon: 'play',
        run: () => ctx.toast('模块已运行', 'success')
      });

      ctx.setting({
        order: 50,
        render: () => ctx.ui.switchRow({
          title: '启用 Module Name',
          checked: ctx.getConfig('enabled'),
          onChange: (value) => ctx.setConfig('enabled', value)
        })
      });

      ctx.log('module activated');
    },

    deactivate(ctx) {
      ctx.log('module deactivated');
    }
  });
})(window.MUI);
