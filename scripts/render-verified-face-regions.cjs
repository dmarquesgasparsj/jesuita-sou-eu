const fs=require('node:fs'),sharp=require('sharp');const {init,inferFaceRegion}=require('./portrait-inference.cjs');
process.on('unhandledRejection',e=>{console.error('REJECTION',e.message);process.exit(1)});
const specs=[['kostka-new',[.03,.14,.94,.81]],['diogo-kisai',[.445,.435,.075,.085]],['sebastiao-kimura',[.42,.135,.16,.125]],['pedro-kibe',[.425,.035,.14,.08]]];
(async()=>{await init();for(const[id,f]of specs){
const file='.review/eastern/'+id,bytes=fs.readFileSync(file+'.source'),m=await sharp(bytes).metadata();
const bx=f[0]*m.width,by=f[1]*m.height,bw=f[2]*m.width,bh=f[3]*m.height;
let width=Math.min(m.width,Math.round(bw*2.1)),height=Math.round(width*1.25);if(height>m.height){height=m.height;width=Math.min(m.width,Math.round(height*.8));}
const left=Math.max(0,Math.min(m.width-width,Math.round(bx+bw/2-width/2))),top=Math.max(0,Math.min(m.height-height,Math.round(by+bh*.6-height*.48)));
const crop={left,top,width,height};const faceBox={x:(bx-left)/width,y:(by-top)/height,width:bw/width,height:bh/height};
for(const[k,v]of Object.entries(faceBox))if(!Number.isFinite(v)||v<0||v>1)throw Error(id+' invalid face '+k);
if(faceBox.x+faceBox.width>1.02||faceBox.y+faceBox.height>1.02)throw Error('Face outside crop '+id);
const out=await sharp(bytes).extract(crop).resize(600,750,{fit:'fill'}).jpeg({quality:88,mozjpeg:true}).toBuffer();
fs.writeFileSync(file+'.portrait.jpg',out);const face=await inferFaceRegion(out,faceBox);
const preview=await sharp(out).resize(300,375).jpeg({quality:82}).toBuffer();
fs.writeFileSync(file+'.rendered.json',JSON.stringify({id,crop,referencePreparation:{crop,resize:[600,750],fit:'fill',rotate:0,face:faceBox},face,preview:preview.toString('base64')}));
console.log('VERIFIED REGION',id,'descriptor norm',Math.hypot(...face.descriptor),'crop',JSON.stringify(crop));
}})().catch(e=>{console.error(e.message);process.exitCode=1});
