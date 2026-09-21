import { createContext, useContext } from 'react'
import type { ApiResult } from '../../api/client'
import type { CommissionView } from '../../api/types'

/**
 * One sent request, shared by the detail screen and the modals layered on it
 * (designs 05, 06 and 09). `act` runs a creator action and replaces the view
 * with whatever the server returned, so no screen can drift from the record.
 */
export interface RequestContext {
  view: CommissionView
  busy: boolean
  act: (run: () => Promise<ApiResult<CommissionView>>, success: string) => Promise<boolean>
  closeToRequest: () => void
  closeToQueue: () => void
}

export const RequestCtx = createContext<RequestContext | null>(null)

export function useRequestContext(): RequestContext {
  const value = useContext(RequestCtx)
  if (!value) throw new Error('useRequestContext must be used inside <CreatorRequest>')
  return value
}
