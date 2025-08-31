import 'shaka-player/dist/shaka-player.compiled';

export type ShakaConstructor = typeof shaka.Player;
export type ShakaConstructorLoader = () => Promise<{ default: ShakaConstructor } | undefined>;

export type ShakaNamespace = typeof shaka;
export type ShakaNamespaceLoader = () => Promise<{ default: typeof shaka } | undefined>;

export type ShakaLibrary =
  | ShakaConstructor
  | ShakaConstructorLoader
  | ShakaNamespace
  | ShakaNamespaceLoader
  | string
  | undefined;

export type ShakaInstanceCallback = (player: shaka.Player) => void;
