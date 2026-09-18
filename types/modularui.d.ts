export type ModuleState =
  | 'registered' | 'resolving' | 'activating' | 'active'
  | 'deactivating' | 'inactive' | 'error';

export type Permission =
  | 'ui.slot' | 'ui.view' | 'ui.component' | 'ui.style' | 'ui.theme'
  | 'ui.overlay' | 'ui.settings' | 'ui.commands' | 'ui.hotkeys'
  | 'ui.notifications' | 'events' | 'hooks' | 'storage' | 'i18n'
  | 'http' | 'timers' | 'clipboard' | (string & {});

export type NodeValue = Node | string | number | boolean | null | undefined | NodeValue[];
export type Renderable = NodeValue;
export type Dispose = () => void;

export interface ConfigField<T = unknown> {
  type?: 'string' | 'number' | 'boolean' | 'select';
  default: T;
  label?: string;
  description?: string;
  min?: number;
  max?: number;
  options?: Array<string | { label: string; value: T }>;
}

export type ConfigSchema = Record<string, ConfigField | string | number | boolean>;

export interface ModuleManifest {
  id: string;
  name?: string;
  version: string;
  apiVersion?: string;
  author?: string | { name: string; url?: string };
  description?: string;
  icon?: string;
  homepage?: string;
  license?: string;
  requires?: Record<string, string>;
  optional?: Record<string, string>;
  permissions?: Permission[];
  config?: ConfigSchema;
  storageVersion?: number;
  timeout?: number;
  autoEnable?: boolean;
  builtin?: boolean;
  remote?: boolean;
  migrate?: (store: Record<string, unknown>, from: number, to: number) => Record<string, unknown> | void;
  preload?: (ctx: ModuleContext) => void | Promise<void>;
  install?: (ctx: ModuleContext) => void | Promise<void>;
  activate?: (ctx: ModuleContext) => void | Promise<void>;
  setup?: (ctx: ModuleContext) => void | Promise<void>;
  deactivate?: (ctx: ModuleContext) => void | Promise<void>;
  uninstall?: (ctx: ModuleContext) => void | Promise<void>;
}

export interface Signal<T> {
  readonly value: T;
  get(): T;
  peek(): T;
  set(value: T | ((previous: T) => T)): T;
  update(fn: (previous: T) => T): T;
  subscribe(listener: (value: T) => void, immediate?: boolean): Dispose;
}

export interface Resource<T> {
  data: Signal<T | null>;
  error: Signal<unknown | null>;
  loading: Signal<boolean>;
  reload(): Resource<T>;
  value(): T | null;
}

export interface Store {
  readonly ns: string;
  readonly version: number;
  get<T>(key: string, fallback?: T): T;
  set<T>(key: string, value: T): T;
  update<T>(key: string, fn: (value: T) => T): T;
  remove(key: string): void;
  all(): Record<string, unknown>;
  keys(): string[];
  clear(): void;
  watch(listener: (key: string, value: unknown) => void): Dispose;
  snapshot(): { __data: Record<string, unknown>; __version: number };
}

export interface ComponentFactory<P = Record<string, unknown>> {
  (props?: P): HTMLElement | SVGElement | DocumentFragment | Node;
}

export interface ComponentRegistry {
  define<P = Record<string, unknown>>(name: string, factory: ComponentFactory<P>): ComponentFactory<P>;
  get<P = Record<string, unknown>>(name: string): ComponentFactory<P> | undefined;
  has(name: string): boolean;
  use<P = Record<string, unknown>>(name: string, props?: P, ...children: NodeValue[]): Node;
  override<P = Record<string, unknown>>(name: string, factory: ComponentFactory<P>): Dispose;
  list(): string[];
}

export interface UI {
  [component: string]: ((props?: Record<string, unknown>, ...children: NodeValue[]) => Node) | unknown;
  h: typeof MUI.h;
  icon(name: string, size?: number, stroke?: number): SVGElement;
  use(name: string, props?: Record<string, unknown>, ...children: NodeValue[]): Node;
}

export interface SlotOptions { priority?: number; id?: string; owner?: string; }
export interface SlotRegistry {
  register(name: string, render: () => NodeValue, options?: SlotOptions): Dispose;
  render(name: string): void;
  renderAll(): void;
  names(): string[];
}

export interface RouteDefinition {
  name?: string;
  title?: string;
  icon?: string;
  order?: number;
  nav?: boolean | { group?: string; label?: string; icon?: string; order?: number; hidden?: boolean; badge?: string | number | (() => string | number) };
  tab?: boolean | { label?: string; icon?: string; order?: number };
  badge?: string | number | (() => string | number);
  badgeTone?: string;
  breadcrumbGroup?: string;
  beforeEnter?: (ctx: { name: string; params: Record<string, unknown> }) => boolean | void;
  render: (ctx: RouteContext) => NodeValue;
  onEnter?: (ctx: RouteContext) => void;
  onLeave?: (ctx: RouteContext) => void;
}

export interface RouteContext {
  name: string;
  params: Record<string, unknown>;
  app: AppFacade;
  ui: UI;
  h: typeof MUI.h;
  icon: typeof MUI.icon;
  router: Router;
}

export interface Router {
  register(name: string, definition: RouteDefinition): Dispose;
  navigate(name: string, params?: Record<string, unknown>, options?: { replace?: boolean; noTransition?: boolean }): boolean;
  go(name: string, params?: Record<string, unknown>): boolean;
  back(): void;
  current(): string | null;
  params(): Record<string, unknown>;
  routes(): RouteDefinition[];
  get(name: string): RouteDefinition | undefined;
  onChange(listener: (name: string, params: Record<string, unknown>) => void): Dispose;
}

export interface Command {
  id: string;
  title: string;
  subtitle?: string;
  group?: string;
  icon?: string;
  keywords?: string;
  keybinding?: string;
  owner?: string;
  when?: () => boolean;
  run: (command: Command) => void;
}

export interface CommandRegistry {
  register(command: Command): Dispose;
  get(id: string): Command | undefined;
  unregister(id: string): void;
  list(): Command[];
  enabled(): Command[];
  search(query?: string): Command[];
  recent(): Command[];
  run(id: string | Command): boolean;
}

export interface ThemeAPI {
  mode(): 'light' | 'sepia' | 'dark' | 'system';
  resolved(): 'light' | 'sepia' | 'dark';
  setMode(mode: 'light' | 'sepia' | 'dark' | 'system'): void;
  toggle(): void;
  accent(): string;
  accent2(): string;
  palette(): string;
  setPalette(name: string): void;
  setAccent(primary: string, secondary?: string): void;
  palettes: Array<{ name: string; a1: string; a2: string }>;
  density(): 'cozy' | 'compact';
  setDensity(value: 'cozy' | 'compact'): void;
  radiusStyle(): 'sharp' | 'soft' | 'round';
  setRadiusStyle(value: 'sharp' | 'soft' | 'round'): void;
  fontScale(): number;
  setFontScale(value: number): void;
  motion(): 'smooth' | 'instant';
  setMotion(value: 'smooth' | 'instant'): void;
  contrast(): boolean;
  setContrast(value: boolean): void;
  setVar(name: string, value: string): void;
  getVar(name: string): string;
  tokens(): Record<string, string>;
}

export interface ModuleContext {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly apiVersion: string;
  readonly manifest: ModuleManifest;
  readonly config: Record<string, unknown>;
  readonly configSchema: ConfigSchema;
  readonly store: Store;
  readonly ui: UI;
  readonly h: typeof MUI.h;
  readonly icon: typeof MUI.icon;
  readonly utils: typeof MUI.util;
  readonly components: ComponentRegistry;
  readonly signals: typeof MUI.state;
  readonly theme: ThemeAPI;
  readonly i18n: { register(locale: string, dictionary: Record<string, string>): void; t(key: string, vars?: Record<string, unknown>): string; locale(): string };
  readonly permissions: { has(capability: Permission): boolean; list(): Permission[] };

  log(...args: unknown[]): void;
  debug(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
  getConfig<T = unknown>(key: string): T;
  setConfig<T = unknown>(key: string, value: T): void;
  resetConfig(): void;

  slot(name: string, render: () => NodeValue, options?: SlotOptions): Dispose;
  slots(): string[];
  view(name: string, definition: RouteDefinition): Dispose;
  view(definition: RouteDefinition & { name: string }): Dispose;
  page(name: string, definition: RouteDefinition): Dispose;
  page(definition: RouteDefinition & { name: string }): Dispose;
  go(name: string, params?: Record<string, unknown>): boolean;
  back(): void;

  component: {
    define<P = Record<string, unknown>>(name: string, factory: ComponentFactory<P>): Dispose;
    override<P = Record<string, unknown>>(name: string, factory: ComponentFactory<P>): Dispose;
    get<P = Record<string, unknown>>(name: string): ComponentFactory<P> | undefined;
    use(name: string, props?: Record<string, unknown>): Node;
    has(name: string): boolean;
    list(): string[];
  };
  define<P = Record<string, unknown>>(name: string, factory: ComponentFactory<P>): Dispose;
  override<P = Record<string, unknown>>(name: string, factory: ComponentFactory<P>): Dispose;
  style(css: string): Dispose;

  on(event: string, listener: (...args: unknown[]) => void): Dispose;
  once(event: string, listener: (...args: unknown[]) => void): Dispose;
  emit(event: string, ...args: unknown[]): void;
  hook(name: string, filter: (...args: any[]) => any, priority?: number): Dispose;
  action(name: string, action: (...args: any[]) => void, priority?: number): Dispose;

  get http(): typeof MUI.http;
  fetch(url: string, options?: RequestInit): Promise<unknown>;
  setInterval(fn: () => void, ms: number): number;
  setTimeout(fn: () => void, ms: number): number;
  clearInterval(id: number): void;
  clearTimeout(id: number): void;
  copy(text: string): Promise<boolean>;

  toast(message: string | Record<string, unknown>, typeOrOptions?: string | Record<string, unknown>): Dispose;
  notify(options: Record<string, unknown> | string): Dispose;
  modal(options: Record<string, unknown>): { close(value?: unknown): void; el: HTMLElement };
  confirm(options: Record<string, unknown> | string): Promise<boolean>;
  prompt(options: Record<string, unknown> | string): Promise<string | null>;
  sheet(options: Record<string, unknown>): { close(value?: unknown): void; el: HTMLElement };
  actionSheet(options: Record<string, unknown>): { close(value?: unknown): void; el: HTMLElement };
  menu(items: Array<Record<string, unknown>>, options?: Record<string, unknown>): { close(): void; el: HTMLElement };
  loading: { show(text?: string): Dispose; hide(): void };

  setting(item: { id?: string; order?: number; render: () => NodeValue }): Dispose;
  command(command: Command): Dispose;
  hotkey(combo: string, listener: (event: KeyboardEvent) => void, options?: Record<string, unknown>): Dispose;

  expose<T>(value: T): T;
  require<T = unknown>(id: string): T;
  scope(fn: (scope: Scope) => void): Dispose;
  text(source: Signal<unknown> | (() => unknown)): Text;
  bind(render: () => NodeValue): HTMLElement;
  list<T>(source: Signal<T[]>, renderItem: (item: T, index: number) => NodeValue): HTMLElement;
  persist<T>(signal: Signal<T>, key: string): Signal<T>;
  resource<T>(fetcher: () => Promise<T>): Resource<T>;
  observer(element: Element, callback: (info: { width: number; height: number; el: Element }) => void): Dispose;
  intersect(element: Element, callback: (visible: boolean, entry: IntersectionObserverEntry) => void, options?: IntersectionObserverInit): Dispose;
  drag(element: Element, handlers: { start?: (event: PointerEvent) => void; move?: (data: { dx: number; dy: number; x: number; y: number; event: PointerEvent }) => void; end?: (event: PointerEvent) => void; filter?: (event: PointerEvent) => boolean }): Dispose;
  onDispose(disposer: Dispose): Dispose;
  dispose(disposer: Dispose): Dispose;
}

export interface ModuleInfo {
  id: string;
  name: string;
  version: string;
  apiVersion: string;
  state: ModuleState;
  enabled: boolean;
  error: string | null;
  requires: Record<string, string>;
  optional: Record<string, string>;
  permissions: Array<{ id: string; label: string; granted: boolean; kind: string }>;
  configSchema: ConfigSchema;
  activationMs: number | null;
}

export interface ModsAPI {
  readonly API_VERSION: string;
  readonly capabilities: Record<string, boolean>;
  define(manifest: ModuleManifest, setup?: (ctx: ModuleContext) => void | Promise<void>): unknown;
  register(manifest: ModuleManifest, setup?: (ctx: ModuleContext) => void | Promise<void>): unknown;
  validate(manifest: unknown): { valid: boolean; errors: string[]; warnings: string[] };
  enable(id: string): Promise<boolean>;
  disable(id: string): Promise<boolean>;
  enableAll(): Promise<boolean[]>;
  disableAll(): Promise<boolean[]>;
  reload(id: string): Promise<boolean>;
  uninstall(id: string): Promise<boolean>;
  get(id: string): unknown;
  info(id: string): ModuleInfo | null;
  state(id: string): ModuleState | null;
  list(): ModuleInfo[];
  has(id: string): boolean;
  require<T = unknown>(id: string): T | null;
  waitFor(id: string, timeout?: number): Promise<ModuleInfo>;
  load(url: string, options?: { timeout?: number }): Promise<ModuleInfo[]>;
  graph(): { nodes: Array<Record<string, unknown>>; edges: Array<Record<string, unknown>> };
  diagnostics(): Array<Record<string, unknown>>;
  onChange(listener: () => void): Dispose;
}

export interface AppFacade {
  version: string;
  apiVersion: string;
  h: typeof MUI.h;
  ui: UI;
  icon: typeof MUI.icon;
  mods: ModsAPI;
  router: Router;
  theme: ThemeAPI;
  state: typeof MUI.state;
  logs: typeof MUI.logs;
  scope: typeof MUI.scope;
  text: typeof MUI.text;
  bind: typeof MUI.bind;
  list: typeof MUI.list;
  resource: typeof MUI.resource;
  observer: typeof MUI.observer;
  intersect: typeof MUI.intersect;
  drag: typeof MUI.drag;
}

export interface MUIRoot extends AppFacade {
  components: ComponentRegistry;
  slots: SlotRegistry;
  commands: CommandRegistry;
  http: typeof MUI.http;
  settings: typeof MUI.settings;
  i18n: typeof MUI.i18n;
  bus: typeof MUI.bus;
  hooks: typeof MUI.hooks;
  store: Store;
  utils: typeof MUI.util;
  semver: typeof MUI.semver;
  defineModule: ModsAPI['define'];
}

declare global {
  const MUI: MUIRoot;
  interface Window { MUI: MUIRoot; }
}

export {};
