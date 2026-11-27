window.parent.postMessage({ channel: 'syntax-view-v1', type: 'syntax:view-ready' }, '*')
document.getElementById('status').textContent = 'module-ran'
