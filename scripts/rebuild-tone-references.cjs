const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const {init,infer,inferFaceRegion}=require('./portrait-inference.cjs');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const write=(p,value)=>fs.writeFileSync(p,JSON.stringify(value,null,2)+'\n');
const repo=path.resolve(__dirname,'..');
const gallery=read('dist/gallery.json');
const sources=read('scripts/portrait-sources.json');
const photos=read('dist/biography-photos.json');
const opts={neutral:true};
const subject='inacio-azevedo';
const crop=[.39,.166,.248,.247];
async function prepared(p) {
 const file=path.resolve(repo,'scripts',p.imagePath);
 const o=p.referencePreparation;
 if(!o)return file;
 let img=sharp(file);if(o.crop)img=img.extract(o.crop);
 if(o.resize)img=img.resize(o.resize[0],o.resize[1],{fit:o.fit||'contain',background:'white'});
 let b=await img.png().toBuffer();
 if(o.rotate)b=await sharp(b).rotate(o.rotate,{background:'white'}).resize(400,500,{fit:'inside'}).png().toBuffer();
 return b;
}
async function main(){
 await init();
 const original=gallery.find(p=>p.id===subject);
 const {image:oldImage,commonsFilename,imageAuthor,license,licenseUrl,imageSource}=original;
 const sourcePhoto=photos[subject][0];
 const source='source-portraits/inacio-azevedo.jpg';
 fs.copyFileSync('dist/'+sourcePhoto.image,source);
 const m=await sharp(source).metadata();
 const [left,top,width,height]=crop.map((v,i)=>Math.round(v*(i%2?m.height:m.width)));
 await sharp(source).extract({left,top,width,height}).resize(600,750,{fit:'fill'}).jpeg({quality:91,mozjpeg:true}).toFile('dist/assets/portraits/inacio-azevedo.new.jpg');
 fs.copyFileSync('dist/'+oldImage,'dist/assets/biography/inacio-azevedo-2.jpg');
 fs.renameSync('dist/assets/portraits/inacio-azevedo.new.jpg','dist/'+oldImage);
 photos[subject][1]={image:'./assets/biography/inacio-azevedo-2.jpg',author:imageAuthor,license,licenseUrl,sourceUrl:imageSource,commonsTitle:'File:'+commonsFilename,cropped:true,verifiedOn:'2026-11-12',captions:{pt:'Inácio de Azevedo numa gravura de 1675.',es:'Ignacio de Azevedo en un grabado de 1675.',fr:'Ignace de Azevedo dans une gravure de 1675.',en:'Ignatius of Azevedo in a 1675 engraving.',ko:'1675년 판화 속 이냐시오 데 아제베두.'}};
 const meta={imageAuthor:'Pintor não identificado; fotografia: Jgqa56',authorUnknown:false,imageCollection:'Museu Pio XII, Braga',license:sourcePhoto.license,licenseUrl:sourcePhoto.licenseUrl,licenseKind:'pd',imageDate:'Século XVII',commonsFilename:sourcePhoto.commonsTitle.slice(5),imageChanges:'Recorte da figura central da pintura de grupo e redimensionamento para 600 × 750 píxeis.',verifiedOn:'2026-11-12',portraitNote:'Representação pictórica identificada na pintura de grupo. Não é uma fotografia do biografado.'};
 delete original.originalImageUrl;
 const origin=sources.find(p=>p.id===subject);
 delete origin.originalImageUrl;
 Object.assign(original,meta,{imageSource:sourcePhoto.sourceUrl});
 Object.assign(origin,meta,{sourceUrl:sourcePhoto.sourceUrl,imageSource:meta.imageCollection,imagePath:'../'+source,referencePreparation:{crop:{left,top,width,height},resize:[600,750],fit:'fill',face:{x:.08,y:.12,width:.80,height:.83}}});
 for(const p of gallery){
  const config=sources.find(s=>s.id===p.id), file='dist/'+p.image;
  let ref;
  if(config.referencePreparation?.face)ref=await inferFaceRegion(file,config.referencePreparation.face,opts);
  else{
   const input=await prepared(config);
   ref=(await infer(file,opts))[0] || (await infer(input,opts))[0];
  }
  if(!ref)throw Error('No usable reference for '+p.id);
  p.descriptor=ref.descriptor;
  fs.writeFileSync('scripts/descriptors/'+p.id+'.json',JSON.stringify(ref)+'\n');
  console.log(p.id,ref.method,ref.box);
 }
 write('dist/gallery.json',gallery);
 write('dist/biography-photos.json',photos);
 write('scripts/portrait-sources.json',sources);
 const preview=await sharp('dist/'+original.image).resize(400,500).jpeg({quality:80}).toBuffer();
 fs.mkdirSync('.review/azevedo',{recursive:true});
 write('.review/azevedo/final-crop.json',{image_url:'data:image/jpeg;base64,'+preview.toString('base64')});
}
main().catch(e=>{console.error(e);process.exit(1)});
