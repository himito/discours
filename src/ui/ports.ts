/**
 * Access to the ports from the UI.
 *
 * @remarks The composition root (`src/main.ts`) creates the adapters and installs them with
 * {@link providePorts}; components and stores get them with {@link usePorts}. The UI never imports
 * an adapter, so adapters can be swapped (or faked in tests) in one place.
 *
 * @packageDocumentation
 */
import { inject, type App, type InjectionKey } from 'vue'
import type { Ports } from '@/core/ports'

/** The ports the UI works with: pages are DOM elements. */
export type UiPorts = Ports<HTMLElement>

const PORTS: InjectionKey<UiPorts> = Symbol('ports')

/** Makes the ports available to the whole app. */
export function providePorts(app: App, ports: UiPorts): void {
  app.provide(PORTS, ports)
}

/**
 * The ports, from a component's `setup` or a store.
 *
 * @throws If {@link providePorts} was not called.
 */
export function usePorts(): UiPorts {
  const ports = inject(PORTS)
  if (!ports) throw new Error('Ports not provided: call providePorts() in main.ts')
  return ports
}
