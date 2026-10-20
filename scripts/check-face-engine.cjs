const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
async function main() {
  const { detectFacesForComparison, warmFaceModels } = await import(pathToFileURL(path.resolve(__dirname,'../dist/face-engine.js')));
  const input = { width: 640, height: 480 };
  const face = { box: { width: 140, height: 170 } };
  function mock(results, backend = 'cpu') {
    const calls = { detection: [], descriptors: 0, fallback: 0, allocations: 0, disposed: 0, landmarks: 0, recognition: 0 };
    const f = {
      TinyFaceDetectorOptions: class { constructor(options) { Object.assign(this, options); this.kind = 'tiny'; } },
      SsdMobilenetv1Options: class { constructor(options) { Object.assign(this, options); this.kind = 'ssd'; } },
      async detectAllFaces(_input, options) { calls.detection.push(options); return results.shift() || []; },
      DetectAllFaceLandmarksTask: class {
        constructor(parent) { this.parent = parent; }
        async withFaceDescriptors() { calls.descriptors++; return (await this.parent).map(face => ({ ...face, descriptor: Array(128).fill(.1) })); }
      },
      tf: { getBackend: () => backend, zeros() { calls.allocations++; return { dispose() { calls.disposed++; } }; } },
      nets: { faceLandmark68Net: { async detectLandmarks() { calls.landmarks++; } }, faceRecognitionNet: { async computeFaceDescriptor() { calls.recognition++; } } }
    };
    return { f, calls, options: { async loadFallback() { calls.fallback++; } } };
  }
  let m = mock([[face]]);
  assert.equal((await detectFacesForComparison(m.f,input,m.options))[0].descriptor.length,128);
  assert.equal(m.calls.detection.length,1); assert.equal(m.calls.fallback,0);
  m = mock([[face,face]]);
  assert.equal((await detectFacesForComparison(m.f,input,m.options)).length,2); assert.equal(m.calls.descriptors,0);
  m = mock([[{ box: { width: 12, height: 15 } }]]);
  await detectFacesForComparison(m.f,input,m.options); assert.equal(m.calls.descriptors,0);
  m = mock([[],[face]]);
  await detectFacesForComparison(m.f,input,m.options);
  assert.deepEqual(m.calls.detection.map(x => x.inputSize),[320,416]); assert.equal(m.calls.fallback,0);
  m = mock([[],[],[face]]);
  await detectFacesForComparison(m.f,input,m.options);
  assert.deepEqual(m.calls.detection.map(x => x.kind),['tiny','tiny','ssd']); assert.equal(m.calls.fallback,1);
  m = mock([[],[],[]]);
  assert.equal((await detectFacesForComparison(m.f,input,m.options)).length,0); assert.equal(m.calls.descriptors,0);
  m = mock([[face]]);
  await detectFacesForComparison(m.f,input,{...m.options,isDemo:true});
  assert.equal(m.calls.detection[0].kind,'ssd'); assert.equal(m.calls.fallback,1);
  m = mock([]);
  await warmFaceModels(m.f); assert.equal(m.calls.allocations,0);
  m = mock([], 'webgl');
  await warmFaceModels(m.f); assert.equal(m.calls.landmarks,1); assert.equal(m.calls.recognition,1); assert.equal(m.calls.disposed,1);
  m = mock([], 'webgl');
  m.f.nets.faceRecognitionNet.computeFaceDescriptor = async () => { throw new Error('GPU failure'); };
  await assert.rejects(warmFaceModels(m.f),/GPU failure/); assert.equal(m.calls.disposed,1);
  console.log(JSON.stringify({status:'passed',single_detection_on_normal_capture:true,no_descriptors_for_invalid_or_multiple_faces:true,fallback_and_demo:true,warmup_disposes_tensor:true}));
}
main().catch(error => { console.error(error.stack); process.exit(1); });
