const CHANNEL = 'syntax-view-v1'
let initData = null
let callSeq = 0
const pending = new Map()
let currentDoc = null

function callHost(target, method, args = []) {
  return new Promise((resolve, reject) => {
    const callId = `c-${++callSeq}`
    pending.set(callId, { resolve, reject })
    window.parent.postMessage(
      {
        channel: CHANNEL,
        type: 'syntax:view-call',
        instanceId: initData.instanceId,
        activationId: initData.activationId,
        callId,
        target,
        method,
        args,
      },
      '*',
    )
  })
}

function applyTheme(theme) {
  document.getElementById('theme-mode').textContent = theme.mode
  document.documentElement.dataset.theme = theme.mode
  for (const [k, v] of Object.entries(theme.cssVars || {})) {
    document.documentElement.style.setProperty(k, v)
  }
}

function renderDoc() {
  const statusEl = document.getElementById('doc-status')
  const listEl = document.getElementById('task-list')
  if (!currentDoc) {
    statusEl.textContent = 'no-doc'
    listEl.innerHTML = ''
    return
  }
  statusEl.textContent = `${currentDoc.id}|rev:${currentDoc.revision}|${currentDoc.title}`
  listEl.innerHTML = ''
  for (const t of currentDoc.data?.tasks ?? []) {
    const li = document.createElement('li')
    li.textContent = t
    listEl.appendChild(li)
  }
}

function runSecurityProbe() {
  let parentBlocked = false
  try {
    void window.parent.document.title
  } catch {
    parentBlocked = true
  }
  let storageBlocked = false
  try {
    void window.localStorage.getItem('syntax.extensions.v1')
  } catch {
    storageBlocked = true
  }
  document.getElementById('security-probe').textContent = JSON.stringify({
    origin: window.origin,
    parentBlocked,
    storageBlocked,
  })
}

window.addEventListener('message', async event => {
  const msg = event.data
  if (!msg || msg.channel !== CHANNEL) return

  if (msg.type === 'syntax:view-init') {
    initData = msg
    applyTheme(msg.theme)
    runSecurityProbe()
    if (msg.docId) {
      currentDoc = await callHost('syscall', 'documents.get', [msg.docId])
      renderDoc()
    }
    return
  }

  if (msg.type === 'syntax:view-theme') {
    applyTheme(msg.theme)
    return
  }

  if (msg.type === 'syntax:view-result') {
    const entry = pending.get(msg.callId)
    if (!entry) return
    pending.delete(msg.callId)
    if (msg.ok) entry.resolve(msg.result)
    else entry.reject(new Error(msg.error?.message || 'RPC error'))
  }
})

document.getElementById('create-btn').addEventListener('click', async () => {
  currentDoc = await callHost('worker', 'createSample', ['Demo Board'])
  renderDoc()
})

document.getElementById('add-task-btn').addEventListener('click', async () => {
  if (!currentDoc) return
  currentDoc = await callHost('worker', 'addTask', [
    currentDoc.id,
    currentDoc.revision,
    'Edit rough cut',
  ])
  renderDoc()
})

document.getElementById('stale-save-btn').addEventListener('click', async () => {
  if (!currentDoc) return
  try {
    await callHost('worker', 'addTask', [currentDoc.id, 1, 'Stale write'])
    document.getElementById('doc-status').textContent = 'UNEXPECTED_SUCCESS'
  } catch (err) {
    document.getElementById('doc-status').textContent = `CONFLICT:${err.message}`
  }
})

window.parent.postMessage({ channel: CHANNEL, type: 'syntax:view-ready' }, '*')
