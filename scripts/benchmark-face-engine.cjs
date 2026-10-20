// Optional real-model benchmark. Requires sharp in the development runtime.
// Usage: node scripts/benchmark-face-engine.cjs /absolute/path/to/photo.jpg
const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { pathToFileURL } = require('node:url');
const sharp = require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'sharp') : 'sharp');
const { init, faceapi } = require('./portrait-inference.cjs');
async function main() {
  const file = process.argv[2];
  if (!file || !path.isAbsolute(file)) throw new Error('Indica uma fotografia por caminho absoluto.');
  const root = path.resolve(__dirname,'../dist');
  const { detectFacesForComparison, warmFaceModels } = await import(pathToFileURL(path.join(root,'face-engine.js')));
  const { rankPortraits } = await import(pathToFileURL(path.join(root,'matching.js')));
  const gallery = JSON.parse(fs.readFileSync(path.join(root,'gallery.json'),'utf8'));
  await init();
  const inputs = [];
  try {
    const results = [];
    for (const [name,maxSize] of [['baseline-ssd',960],['optimized-tiny',640]]) {
      const { data, info } = await sharp(file).rotate().resize({ width:maxSize, height:maxSize, fit:'inside', withoutEnlargement:true }).removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject:true });
      const input = faceapi.tf.tensor3d(new Uint8Array(data),[info.height,info.width,info.channels]); inputs.push(input);
      const start = performance.now();
      const faces = name === 'baseline-ssd'
        ? await faceapi.detectAllFaces(input,new faceapi.SsdMobilenetv1Options({ minConfidence:.4,maxResults:8 })).withFaceLandmarks().withFaceDescriptors()
        : await detectFacesForComparison(faceapi,input);
      const duration = performance.now() - start;
      if (faces.length !== 1 || !faces[0].descriptor) throw new Error(name+': expected one usable face');
      const top3 = rankPortraits(faces[0].descriptor,gallery).map(m => m.person.id);
      const entry = { name, faces:faces.length, total_ms:Math.round(duration), top3 };
      results.push(entry); console.log(JSON.stringify(entry));
    }
    const before = faceapi.tf.memory().numTensors;
    // Exercise the real warm-up operations on CPU without claiming to emulate
    // a browser GPU. Only the conditional gate is overridden for this check.
    await warmFaceModels({ ...faceapi, tf:{ ...faceapi.tf, getBackend:() => 'webgl' } });
    const after = faceapi.tf.memory().numTensors;
    if (after !== before) throw new Error('Warm-up leaked tensors: '+before+' -> '+after);
    console.log(JSON.stringify({ speedup:Number((results[0].total_ms/results[1].total_ms).toFixed(2)), same_top3:results[0].top3.join()===results[1].top3.join(), warmup_tensor_count_stable:true, backend:faceapi.tf.getBackend(), device_note:'CPU development environment; not a tablet or browser benchmark.' }));
  } finally { inputs.forEach(input => input.dispose()); }
}
main().catch(error => { console.error(error.message); process.exit(1); });
