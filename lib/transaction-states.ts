/** Stored state for transactions entered by hand. */
export const MANUAL_TRANSACTION_STATE = 'COMPLETADO'

/** States that mean a transaction has settled, across bank export languages. */
export const COMPLETED_STATES = new Set(['COMPLETADO', 'COMPLETED'])

export function isCompletedState(state: string | null | undefined): boolean {
  return COMPLETED_STATES.has((state ?? '').trim().toUpperCase())
}
