import type { PlatformKey } from '../../lib/platforms';
import type { Provider } from './types';
const registry = new Map<PlatformKey, Provider>();
export function registerProvider(p: Provider) { registry.set(p.key, p); }
export function getProvider(platform: PlatformKey): Provider | undefined { return registry.get(platform); }
export function allProviders() { return [...registry.values()]; }
