import { contextBridge, ipcRenderer } from 'electron'
import type { WorkbenchApi, WorkbenchEvent } from '../shared/types'

const call =
  (name: string) =>
  (...args: unknown[]) =>
    ipcRenderer.invoke(`workbench:${name}`, ...args)

const api: WorkbenchApi = {
  listProjects: call('listProjects') as WorkbenchApi['listProjects'],
  addProject: call('addProject') as WorkbenchApi['addProject'],
  removeProject: call('removeProject') as WorkbenchApi['removeProject'],
  listThreads: call('listThreads') as WorkbenchApi['listThreads'],
  listModels: call('listModels') as WorkbenchApi['listModels'],
  engineStatus: call('engineStatus') as WorkbenchApi['engineStatus'],
  createThread: call('createThread') as WorkbenchApi['createThread'],
  deleteThread: call('deleteThread') as WorkbenchApi['deleteThread'],
  getTranscript: call('getTranscript') as WorkbenchApi['getTranscript'],
  send: call('send') as WorkbenchApi['send'],
  interrupt: call('interrupt') as WorkbenchApi['interrupt'],
  respondApproval: call('respondApproval') as WorkbenchApi['respondApproval'],
  pendingApprovals: call('pendingApprovals') as WorkbenchApi['pendingApprovals'],
  gitDiff: call('gitDiff') as WorkbenchApi['gitDiff'],
  onEvent(cb) {
    const listener = (_: unknown, e: WorkbenchEvent) => cb(e)
    ipcRenderer.on('workbench:event', listener)
    return () => ipcRenderer.removeListener('workbench:event', listener)
  }
}

contextBridge.exposeInMainWorld('workbench', api)
