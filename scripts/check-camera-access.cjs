const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
async function main() {
  const { cameraSupportError, cameraErrorKey, requestCameraStream, playCameraVideo } = await import(pathToFileURL(path.resolve(__dirname,'../dist/camera-access.js')));
  const normal = { mediaDevices: { getUserMedia() {} } };
  assert.equal(cameraSupportError({isSecureContext:true},{},normal),null);
  assert.equal(cameraSupportError({isSecureContext:false},{},normal),'cameraContextError');
  assert.equal(cameraSupportError({isSecureContext:true},{permissionsPolicy:{allowsFeature:() => false}},normal),'cameraPolicyError');
  assert.equal(cameraSupportError({isSecureContext:true},{},{}),'cameraUnsupportedError');
  for (const [name,key] of [['NotAllowedError','cameraPermissionError'],['NotFoundError','cameraMissingError'],['NotReadableError','cameraBusyError']]) assert.equal(cameraErrorKey({name}),key);
  let requested = false; let stopped = 0;
  const stream = () => ({ getTracks:() => [{stop() {stopped++;}}] });
  const camera = requestCameraStream({getUserMedia() {requested=true;return Promise.resolve(stream());}});
  assert.equal(requested,true,'Request must start within the button event, before awaiting preparation');
  assert(await camera);
  let attempts = 0;
  await requestCameraStream({getUserMedia(constraints) {
    attempts++;
    if (attempts===1) return Promise.reject({name:'OverconstrainedError'});
    assert.equal(constraints.video,true); return Promise.resolve(stream());
  }});
  assert.equal(attempts,2);
  await assert.rejects(requestCameraStream({getUserMedia:() => Promise.reject({name:'NotAllowedError'})}), error => cameraErrorKey(error)==='cameraPermissionError');
  let resolveLate;
  const late = requestCameraStream({getUserMedia:() => new Promise(resolve => {resolveLate=resolve;})},{timeoutMs:5});
  await assert.rejects(late,error => error.translationKey==='cameraPermissionTimeout');
  resolveLate(stream()); await new Promise(resolve => setImmediate(resolve));
  assert.equal(stopped,1,'A camera granted after a timeout must be stopped');
  await assert.rejects(requestCameraStream({getUserMedia:() => Promise.resolve(stream())},{isCurrent:() => false}),error => error.translationKey==='cameraCancelled');
  assert.equal(stopped,2,'A camera granted after cancellation must be stopped');
  const video = { hidden:true, setAttribute() {}, play() { assert.equal(this.hidden,false); assert.equal(this.muted,true); assert(this.srcObject); return Promise.resolve(); } };
  await playCameraVideo(video,stream());
  await assert.rejects(playCameraVideo({...video,play:() => new Promise(() => {})},stream(),{timeoutMs:5}),error => error.translationKey==='cameraVideoTimeout');
  console.log(JSON.stringify({status:'passed',permission_policy_detected:true,visible_before_play:true,permission_timeout_recovers:true,late_and_cancelled_streams_stopped:true,constraint_fallback:true}));
}
main().catch(error => { console.error(error.stack); process.exit(1); });
