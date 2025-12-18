declare module "opossum" {
  export type CircuitBreakerStatus = {
    fires: number
    successes: number
    failures: number
    opens?: number
  }

  export type CircuitBreakerOptions = Partial<{
    timeout: number
    errorThresholdPercentage: number
    requestVolumeThreshold: number
    resetTimeout: number
    name: string
  }>

  type ListenerArgs = {
    open: []
    halfOpen: []
    close: []
    timeout: []
    reject: []
    success: [result: unknown, latency: number]
    failure: [error: Error]
  }

  export default class CircuitBreaker<Args extends any[] = any[], Result = any> {
    constructor(action: (...args: Args) => Promise<Result>, options?: CircuitBreakerOptions)
    fire(...args: Args): Promise<Result>
    close(): void
    shutdown(): void

    on<E extends keyof ListenerArgs>(event: E, listener: (...args: ListenerArgs[E]) => void): this

    opened: boolean
    halfOpen: boolean
    stats: CircuitBreakerStatus
  }
}

