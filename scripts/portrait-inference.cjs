const fs = require('node:fs');
const path = require('node:path');
const faceapi = require('../dist/vendor/face-api.min.js');
const sharp = require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? require('node:path').join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, 'sharp') : 'sharp');
const modelsPath=path.resolve(__dirname,'../dist/models');
async function loadModel(net,prefix){
 const manifest=JSON.parse(fs.readFileSync(path.join(modelsPath,prefix+'-weights_manifest.json'),'utf8'));
 const map={};
 for(const g of manifest){
  const b=Buffer.concat(g.paths.map(p=>fs.readFileSync(path.join(modelsPath,p))));
  Object.assign(map,faceapi.tf.io.decodeWeights(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),g.weights));
 }
 net.loadFromWeightMap(map);
}
async function init(){
 await faceapi.tf.setBackend('cpu');
 await Promise.all([
  loadModel(faceapi.nets.tinyFaceDetector,'tiny_face_detector_model'),
  loadModel(faceapi.nets.ssdMobilenetv1,'ssd_mobilenetv1_model'),
  loadModel(faceapi.nets.faceLandmark68Net,'face_landmark_68_model'),
  loadModel(faceapi.nets.faceRecognitionNet,'face_recognition_model')
 ]);
}
async function infer(file){
 const {data,info}=await sharp(file).rotate().resize({width:900,height:1100,fit:'inside',withoutEnlargement:true}).removeAlpha().toColourspace('srgb').raw().toBuffer({resolveWithObject:true});
 const tensor=faceapi.tf.tensor3d(new Uint8Array(data),[info.height,info.width,info.channels]);
 try{
  let result=await faceapi.detectAllFaces(tensor,new faceapi.SsdMobilenetv1Options({minConfidence:.20,maxResults:8})).withFaceLandmarks().withFaceDescriptors();
  result=result.sort((a,b)=>b.detection.box.area-a.detection.box.area);
  return result.map(r=>({descriptor:Array.from(r.descriptor),box:{x:r.detection.box.x/info.width,y:r.detection.box.y/info.height,width:r.detection.box.width/info.width,height:r.detection.box.height/info.height},score:r.detection.score,landmarks:r.landmarks.positions.map(p=>[p.x/info.width,p.y/info.height])}));
 }finally{tensor.dispose();}
}

async function inferFaceRegion(file, box) {
 const {data,info}=await sharp(file).rotate().removeAlpha().toColourspace('srgb').raw().toBuffer({resolveWithObject:true});
 for(const k of ['x','y','width','height'])if(!Number.isFinite(box[k])||box[k]<0)throw new Error('Invalid annotated face region');
 if(box.width<=0||box.height<=0||box.x+box.width>1.02||box.y+box.height>1.02)throw new Error('Annotated face region exceeds image');
 const tensor=faceapi.tf.tensor3d(new Uint8Array(data),[info.height,info.width,info.channels]);
 try{
  // The region identifies the face after human inspection of the complete work.
  // Landmarks and the 128 features are computed by the same models as the app.
  // The internal detection score is a placeholder, not detector confidence.
  const detection=new faceapi.FaceDetection(1,new faceapi.Rect(box.x,box.y,box.width,box.height),{width:info.width,height:info.height});
  const results=await new faceapi.DetectAllFaceLandmarksTask(Promise.resolve([detection]),tensor,false).withFaceDescriptors();
  const r=results[0];if(!r)throw new Error('No features for annotated face');
  return {descriptor:Array.from(r.descriptor),box,score:null,method:'human-verified-face-region',landmarks:r.landmarks.positions.map(p=>[p.x/info.width,p.y/info.height])};
 }finally{tensor.dispose();}
}

module.exports={init,infer,inferFaceRegion,faceapi};
if(require.main===module){
 (async()=>{await init(); for(const file of process.argv.slice(2)){const r=await infer(file);console.log(JSON.stringify({file,faces:r.length,results:r}));}})().catch(e=>{console.error(e);process.exit(1);});
}
