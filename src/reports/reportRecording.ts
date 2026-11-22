export async function startReportRecording(signal: AbortSignal, onStart: () => void,
  onFinish: (blob?: Blob) => void, onError: (error: unknown) => void) {
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
  if (signal.aborted) { stream.getTracks().forEach(track => track.stop()); return; }
  const mimeType = ['video/webm; codecs=vp9', 'video/webm; codecs=vp8', 'video/mp4']
    .find(type => MediaRecorder.isTypeSupported(type));
  let recorder: MediaRecorder;
  try { recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined); }
  catch (error) { stream.getTracks().forEach(track => track.stop()); throw error; }
  let cancelled = false, timer: ReturnType<typeof setTimeout> | undefined;
  const chunks: Blob[] = [];
  const cleanup = () => {
    clearTimeout(timer); signal.removeEventListener('abort', abort);
    stream.getTracks().forEach(track => track.stop());
  };
  const stop = (cancel = false) => {
    cancelled ||= cancel;
    if (recorder.state !== 'inactive') recorder.stop();
    cleanup();
  };
  const abort = () => stop(true);
  signal.addEventListener('abort', abort, { once: true });
  stream.getVideoTracks()[0].addEventListener('ended', () => stop(), { once: true });
  recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
  recorder.onstart = () => { onStart(); timer = setTimeout(() => stop(), 30_000); };
  recorder.onstop = () => { cleanup(); if (!signal.aborted) onFinish(cancelled ? undefined : new Blob(chunks, { type: recorder.mimeType })); };
  recorder.onerror = event => { cancelled = true; stop(true); onError(event); };
  try { recorder.start(); } catch (error) { cleanup(); throw error; }
  return stop;
}
