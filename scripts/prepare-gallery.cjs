const fs=require('node:fs');
const path=require('node:path');
const sharp=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, 'sharp') : 'sharp');
const {init,infer}=require('./portrait-inference.cjs');
const root=path.resolve(__dirname,'..');
const source=process.argv[2];
async function main(){
 const people=JSON.parse(fs.readFileSync(source,'utf8'));
 for(const p of people) if(!path.isAbsolute(p.imagePath)) p.imagePath=path.resolve(path.dirname(source),p.imagePath);
 await init();
 const gallery=[];
 const originals=path.join(root,'source-portraits');fs.mkdirSync(originals,{recursive:true});
 const output=path.join(root,'dist/assets/portraits');fs.mkdirSync(output,{recursive:true});
 const checkpoints=path.join(root,'scripts/descriptors');fs.mkdirSync(checkpoints,{recursive:true});
 for(const p of people){
  const file=path.join(output,p.id+'.jpg');
  const checkpoint=path.join(checkpoints,p.id+'.json');
  let reference;
  if(fs.existsSync(checkpoint))reference=JSON.parse(fs.readFileSync(checkpoint,'utf8'));
  else{
   if(!fs.existsSync(file)){
    const found=await infer(p.imagePath);
    if(!found.length)throw new Error('No face in '+p.id);
    const face=found[0];const info=await sharp(p.imagePath).metadata();const box=face.box;
    const centerX=(box.x+box.width/2)*info.width;const centerY=(box.y+box.height*.60)*info.height;
    let width=Math.min(info.width,box.width*info.width*2.0);let height=width*1.25;
    if(height>info.height){height=info.height;width=Math.min(info.width,height*.8);}
    width=Math.round(width);height=Math.round(height);
    const left=Math.max(0,Math.min(info.width-width,Math.round(centerX-width/2)));
    const top=Math.max(0,Math.min(info.height-height,Math.round(centerY-height*.48)));
    await sharp(p.imagePath).extract({left,top,width,height}).resize(600,750).jpeg({quality:88,mozjpeg:true}).toFile(file);
   }
   const cropped=await infer(file);
   // A recognisable original can be the reference when a close crop causes
   // the detector to miss an angled painted face. Both depict the same work.
   reference=cropped[0] || (await infer(p.imagePath))[0];
   if(!reference)throw new Error('No reference face '+p.id);
   fs.writeFileSync(checkpoint,JSON.stringify(reference)+'\n');
  }
  fs.copyFileSync(p.imagePath,path.join(originals,p.id+path.extname(p.imagePath)));
  const {imagePath,imageFilename,imageUrl,imageSource,...metadata}=p;
  gallery.push({...metadata,image:'./assets/portraits/'+p.id+'.jpg',imageSource:p.sourceUrl,imageCollection:imageSource,position:'50% 38%',descriptor:reference.descriptor});
  console.log(p.id,'face',reference.score.toFixed(3));
 }
 fs.writeFileSync(path.join(root,'dist/gallery.json'),JSON.stringify(gallery,null,2)+'\n');
 const reproducible=people.map(p=>({...p,imagePath:'../source-portraits/'+p.id+path.extname(p.imagePath)}));
 fs.writeFileSync(path.join(root,'scripts/portrait-sources.json'),JSON.stringify(reproducible,null,2)+'\n');
 await sharp(path.join(root,'dist/assets/icon.svg')).resize(192,192).png().toFile(path.join(root,'dist/assets/icon-192.png'));
 await sharp(path.join(root,'dist/assets/icon.svg')).resize(512,512).png().toFile(path.join(root,'dist/assets/icon-512.png'));
 console.log('Gallery ready:',gallery.length);
}
main().catch(e=>{console.error(e);process.exit(1)});
