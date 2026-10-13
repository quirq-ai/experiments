// Newline-delimited JSON-RPC peer, used on both ends of the app-server pipe:
// the Electron main process (client) and the claude-app-server (server).
import type { Readable, Writable } from 'node:stream'
import type { RequestId, RpcMessage, RpcRequest, RpcResponse } from './protocol'

type RequestHandler = (params: any, id: RequestId) => Promise<unknown> | unknown
type NotificationHandler = (params: any, method: string) => void

export class RpcError extends Error {
  constructor(
    public code: number,
    message: string,
    public data?: unknown
  ) {
    super(message)
  }
}

export class LinePeer {
  private nextId = 1
  private pending = new Map<RequestId, { resolve: (v: any) => void; reject: (e: Error) => void }>()
  private requestHandlers = new Map<string, RequestHandler>()
  private notificationHandlers: NotificationHandler[] = []
  private buffer = ''

  constructor(
    input: Readable,
    private output: Writable,
    private log: (line: string) => void = () => {}
  ) {
    input.setEncoding('utf8')
    input.on('data', (chunk: string) => this.onData(chunk))
    input.on('close', () => this.failAll(new Error('app-server connection closed')))
  }

  onRequest(method: string, handler: RequestHandler): void {
    this.requestHandlers.set(method, handler)
  }

  onNotification(handler: NotificationHandler): void {
    this.notificationHandlers.push(handler)
  }

  request<R = unknown>(method: string, params?: unknown): Promise<R> {
    const id = this.nextId++
    return new Promise<R>((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.write({ id, method, params })
    })
  }

  notify(method: string, params?: unknown): void {
    this.write({ method, params })
  }

  failAll(err: Error): void {
    for (const p of this.pending.values()) p.reject(err)
    this.pending.clear()
  }

  private write(msg: RpcMessage): void {
    const line = JSON.stringify(msg)
    this.log(`> ${line}`)
    this.output.write(line + '\n')
  }

  private onData(chunk: string): void {
    this.buffer += chunk
    let nl: number
    while ((nl = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, nl).trim()
      this.buffer = this.buffer.slice(nl + 1)
      if (!line) continue
      this.log(`< ${line}`)
      let msg: any
      try {
        msg = JSON.parse(line)
      } catch {
        continue
      }
      void this.dispatch(msg)
    }
  }

  private async dispatch(msg: any): Promise<void> {
    if ('id' in msg && ('result' in msg || 'error' in msg) && !('method' in msg)) {
      const res = msg as RpcResponse
      const p = this.pending.get(res.id)
      if (!p) return
      this.pending.delete(res.id)
      if (res.error) p.reject(new RpcError(res.error.code, res.error.message, res.error.data))
      else p.resolve(res.result)
      return
    }
    if ('id' in msg && 'method' in msg) {
      const req = msg as RpcRequest
      const handler = this.requestHandlers.get(req.method)
      if (!handler) {
        this.write({ id: req.id, error: { code: -32601, message: `Method not found: ${req.method}` } })
        return
      }
      try {
        const result = await handler(req.params, req.id)
        this.write({ id: req.id, result: result ?? {} })
      } catch (e) {
        const err = e instanceof RpcError ? e : new RpcError(-32000, (e as Error)?.message ?? String(e))
        this.write({ id: req.id, error: { code: err.code, message: err.message, data: err.data } })
      }
      return
    }
    if ('method' in msg) {
      for (const h of this.notificationHandlers) h(msg.params, msg.method)
    }
  }
}
