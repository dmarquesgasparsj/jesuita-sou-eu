function cameraFailure(key) {
  const error = new Error(key); error.translationKey = key; return error;
}
const stop = stream => stream?.getTracks().forEach(track => track.stop());

export function cameraSupportError(win, doc, nav) {
  if (!win.isSecureContext) return 'cameraContextError';
  try {
    const policy = doc.permissionsPolicy || doc.featurePolicy;
    if (policy?.allowsFeature && !policy.allowsFeature('camera')) return 'cameraPolicyError';
  } catch { /* Some embedded browsers do not expose their policy. */ }
  if (!nav.mediaDevices?.getUserMedia) return 'cameraUnsupportedError';
  return null;
}

export function cameraErrorKey(error) {
  if (error.translationKey) return error.translationKey;
  if (['NotAllowedError','PermissionDeniedError','SecurityError'].includes(error.name)) return 'cameraPermissionError';
  if (['NotFoundError','DevicesNotFoundError'].includes(error.name)) return 'cameraMissingError';
  if (['NotReadableError','TrackStartError','AbortError'].includes(error.name)) return 'cameraBusyError';
  return 'cameraOpenError';
}

export function requestCameraStream(mediaDevices, { front = true, timeoutMs = 20000, isCurrent = () => true } = {}) {
  // Invoke getUserMedia immediately inside the button's event, before model
  // preparation. Ignored permission requests must not leave controls locked.
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => fail(cameraFailure('cameraPermissionTimeout')), timeoutMs);
    function fail(error) {
      if (settled) return;
      settled = true; clearTimeout(timer); reject(error);
    }
    function accept(stream) {
      if (settled || !isCurrent()) {
        stop(stream);
        if (!settled) fail(cameraFailure('cameraCancelled'));
        return;
      }
      settled = true; clearTimeout(timer); resolve(stream);
    }
    function request(constraints, retry) {
      let pending;
      try { pending = mediaDevices.getUserMedia(constraints); }
      catch (error) { fail(error); return; }
      Promise.resolve(pending).then(accept, error => {
        if (retry && !settled && isCurrent() && ['OverconstrainedError','ConstraintNotSatisfiedError'].includes(error.name)) {
          request({ audio: false, video: true }, false);
        } else fail(error);
      });
    }
    request({ audio: false, video: { facingMode: { ideal: front ? 'user' : 'environment' }, width: { ideal: 960 }, height: { ideal: 720 } } }, true);
  });
}

export async function playCameraVideo(video, stream, { timeoutMs = 12000 } = {}) {
  // Make the live element visible before requesting playback. In particular,
  // do not wait for play() while it is hidden behind the welcome artwork.
  video.hidden = false; video.muted = true; video.autoplay = true; video.playsInline = true;
  video.setAttribute('playsinline', ''); video.srcObject = stream;
  let timer;
  try {
    await Promise.race([
      Promise.resolve(video.play()),
      new Promise((_, reject) => { timer = setTimeout(() => reject(cameraFailure('cameraVideoTimeout')), timeoutMs); })
    ]);
  } finally { clearTimeout(timer); }
}
