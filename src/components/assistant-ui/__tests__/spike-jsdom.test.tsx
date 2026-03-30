import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render } from '@testing-library/react'
import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  type ChatModelAdapter,
} from '@assistant-ui/react'
import { Thread } from '@/components/assistant-ui/thread'

beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

const mockAdapter: ChatModelAdapter = {
  async *run() {
    yield { content: [{ type: 'text' as const, text: 'Hello' }] }
  },
}

function TestWrapper() {
  const runtime = useLocalRuntime(mockAdapter)
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
    </AssistantRuntimeProvider>
  )
}

describe('Spike: assistant-ui in jsdom', () => {
  it('renders Thread without crashing', () => {
    const { container } = render(<TestWrapper />)
    expect(container).toBeTruthy()
  })
})
