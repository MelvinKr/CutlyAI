export async function withTelemetry<T>(name: string, tenantId: string | undefined, fn: () => Promise<T>): Promise<T> {
  const isProd = process.env.NODE_ENV === 'production'
  const start = Date.now()
  try {
    const result = await fn()
    if (!isProd) {
      // eslint-disable-next-line no-console
      console.log(`[telemetry] ${name} tenant=${tenantId ?? '-'} duration_ms=${Date.now() - start}`)
    }
    return result
  } catch (e) {
    if (!isProd) {
      // eslint-disable-next-line no-console
      console.error(`[telemetry] ${name} tenant=${tenantId ?? '-'} error`, e)
    }
    throw e
  }
}

