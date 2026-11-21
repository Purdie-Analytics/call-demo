import { useOutletContext } from 'react-router-dom'
import type { Call, Meta } from './types'

export interface DataContext {
  meta: Meta
  calls: Call[]
  topics: string[]
}

export const useData = () => useOutletContext<DataContext>()
