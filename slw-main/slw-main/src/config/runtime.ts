export type RuntimeMode = 'lite' | 'online'

export function resolveRuntimeMode(viteMode: string): RuntimeMode {
  return viteMode === 'online' ? 'online' : 'lite'
}

export const runtimeMode: RuntimeMode = resolveRuntimeMode(import.meta.env.MODE)
export const backendEnabled = runtimeMode === 'online'

export class BackendUnavailableError extends Error {
  constructor() {
    super('Backend is unavailable in lite runtime')
    this.name = 'BackendUnavailableError'
  }
}

export function assertBackendAvailable(): void {
  if (!backendEnabled) throw new BackendUnavailableError()
}
