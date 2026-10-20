(async function cloudImport(){
const fs=require("node:fs"),path=require("node:path"),sharp=require("sharp");
const {init,infer}=require("./portrait-inference.cjs");
const root=path.resolve(__dirname,".."),read=p=>fs.readFileSync(path.join(root,p),"utf8"),write=(p,s)=>fs.writeFileSync(path.join(root,p),s);
const meta=JSON.parse(read("scripts/new-saints-meta.json")),localized=JSON.parse(read("scripts/new-saints-locales.json"));
const gallery=JSON.parse(read("dist/gallery.json")),texts=JSON.parse(read("dist/saints-text.json")),sources=JSON.parse(read("scripts/portrait-sources.json"));
if(gallery.length!==30)throw Error("Expected gallery of 30");
await init();
for(const [id,dates,title,file,url,author,bio,crop,license] of meta){
 const response=await fetch(url,{headers:{"User-Agent":"OJesuitaSouEu/0.7.0 educational portrait gallery"}});
 if(!response.ok)throw Error(id+" HTTP "+response.status);
 const bytes=Buffer.from(await response.arrayBuffer()),ext=id==="miguel-carvalho"?".png":".jpg",full=id==="john-sullivan";
 fs.writeFileSync(path.join(root,"source-portraits",id+ext),bytes);
 let reference=bytes;
 const small=["roberto-southwell","rupert-mayer","julien-maunoir"].includes(id);
 if(crop||small){
  let image=sharp(bytes);if(crop)image=image.extract(crop);
  reference=await image.resize(400,500,{fit:small?"inside":"contain",background:"white"}).png().toBuffer();
  if(id==="nicolau-owen")reference=await sharp(reference).rotate(135,{background:"white"}).resize({width:400,height:500,fit:"inside"}).png().toBuffer();
 }
 const found=await infer(reference);if(!found.length)throw Error("No face: "+id);
 const face=found[0],destination=path.join(root,"dist/assets/portraits",id+".jpg");
 if(full)await sharp(bytes).resize({width:1200,height:1200,fit:"inside",withoutEnlargement:true}).jpeg({quality:88,mozjpeg:true}).toFile(destination);
 else{
  const d=await sharp(reference).metadata(),b=face.box;
  let width=Math.min(d.width,Math.round(b.width*d.width*2.05)),height=Math.round(width*1.25);
  if(height>d.height){height=d.height;width=Math.round(height*.8);}
  const left=Math.max(0,Math.min(d.width-width,Math.round((b.x+b.width/2)*d.width-width/2))),top=Math.max(0,Math.min(d.height-height,Math.round((b.y+b.height*.6)*d.height-height*.48)));
  await sharp(reference).extract({left,top,width,height}).resize(600,750).jpeg({quality:88,mozjpeg:true}).toFile(destination);
 }
 const locales=Object.fromEntries(Object.entries(localized[id]).map(([lang,[name,theme,a,b,question]])=>[lang,{name,theme,biography:[a,b],question}]));
 if(full){
  const notes={pt:"Fotografia completa do santuário em Dublin, com uma representação artística do beato no painel.",es:"Fotografía completa del santuario en Dublín, con una representación artística del beato en el panel.",fr:"Photographie complète du sanctuaire à Dublin, avec une représentation artistique du bienheureux sur le panneau.",en:"Full photograph of the shrine in Dublin, with an artistic representation of the blessed on the panel.",ko:"더블린 성소의 전체 사진입니다. 안내판에는 복자의 예술적 초상이 있습니다."};
  for(const [language,note] of Object.entries(notes))locales[language].imageNote=note;
 }
 const sourceUrl="https://commons.wikimedia.org/wiki/File:"+encodeURIComponent(file.replaceAll(" ","_")),biographyUrl=bio.startsWith("https:")?bio:"https://www.jesuits.global/saint-blessed/"+bio+"/";
 const p={id,name:locales.pt.name,dates,title,commonsFilename:file,imageAuthor:author,authorUnknown:author==="Autor não identificado",biographyUrl,biography:locales.pt.biography.join(" "),question:locales.pt.question,theme:locales.pt.theme,sourceUrl,originalImageUrl:url,license:license||"Domínio público (Wikimedia Commons)",licenseKind:license?"cc":"pd",licenseUrl:license?"https://creativecommons.org/licenses/by-sa/4.0/":"https://creativecommons.org/publicdomain/mark/1.0/",questionAttribution:"Pergunta original proposta para esta experiência; não é uma citação do santo.",verifiedOn:"2026-10-20",imageChanges:full?"Fotografia completa, apenas redimensionada.":"Recorte e redimensionamento, sem geração por IA."+(id==="nicolau-owen"?" Recorte rodado para orientar o rosto.":""),image:"./assets/portraits/"+id+".jpg",imageSource:sourceUrl,imageCollection:"Wikimedia Commons",position:full?"50% 50%":"50% 38%",descriptor:face.descriptor};
 if(full)p.imageFit="contain";
 gallery.push(p);texts[id]={sources:[biographyUrl],locales};
 fs.writeFileSync(path.join(root,"scripts/descriptors",id+".json"),JSON.stringify(face,null,2)+"\n");
 const {descriptor,image,...metadata}=p;sources.push({...metadata,imagePath:"../source-portraits/"+id+ext,imageUrl:url,referencePreparation:{crop:crop||null,resize:crop||small?[400,500]:null,fit:small?"inside":"contain",rotate:id==="nicolau-owen"?135:0}});
 console.log(JSON.stringify({id,faces:found.length,selectedFace:0,score:face.score,box:face.box}));
}
write("dist/gallery.json",JSON.stringify(gallery,null,2)+"\n");write("dist/saints-text.json",JSON.stringify(texts,null,2)+"\n");write("scripts/portrait-sources.json",JSON.stringify(sources,null,2)+"\n");
for(const file of ["dist/index.html","dist/translations.js","scripts/check-site.cjs","scripts/check-language-flow.cjs"])write(file,read(file).replace(/\b30\b/g,"40"));
const pack=JSON.parse(read("package.json"));pack.version="0.7.0";pack.description=pack.description.replace("30 retratos","40 retratos");write("package.json",JSON.stringify(pack,null,2)+"\n");
write("scripts/check-translations.cjs",read("scripts/check-translations.cjs").replace("assert(saints[person.id].sources.length >= 2);","assert(saints[person.id].sources.length >= 1);\n      assert(saints[person.id].sources.some(url=>url.startsWith('https://www.jesuits.global/')));"));
for(const file of ["dist/sw.js","scripts/build-offline-manifest.cjs"])write(file,read(file).replaceAll("20261020-v9","20261020-v10"));
let app=read("dist/app.js").replace("function imageLicense(person) {","const imageFit = person => person.imageFit === 'contain' ? 'contain' : 'cover';\nfunction imageLicense(person) {");
app=app.replaceAll('object-position:${escape(p.position','object-fit:${imageFit(p)};object-position:${escape(p.position').replaceAll('object-position:${escape(other.position','object-fit:${imageFit(other)};object-position:${escape(other.position');
app=app.replace("$('result-portrait').style.objectPosition = p.position || '50% 35%';","$('result-portrait').style.objectPosition = p.position || '50% 35%';\n  $('result-portrait').style.objectFit = imageFit(p);");
app=app.replace("${escape(t('portraitChanges'))}","${escape(t(p.imageFit === 'contain' ? 'portraitResizedOnly' : 'portraitChanges'))}${p.imageNote ? ' ' + escape(p.imageNote) : ''}");write("dist/app.js",app);
write("dist/translations.js",read("dist/translations.js").replace("  portraitChanges:","  portraitResizedOnly: ['Fotografia completa, apenas redimensionada.','Fotografía completa, solo redimensionada.','Photographie complète, uniquement redimensionnée.','Full photograph, resized only.','전체 사진이며 크기만 조정했습니다.'],\n  portraitChanges:"));
let prepare=read("scripts/prepare-gallery.cjs");
prepare=prepare.replace("const source=process.argv[2];",`const source=process.argv[2];
async function preparedReference(person) {
 const o=person.referencePreparation;if(!o)return person.imagePath;
 let image=sharp(person.imagePath);if(o.crop)image=image.extract(o.crop);
 if(o.resize)image=image.resize(o.resize[0],o.resize[1],{fit:o.fit||'contain',background:'white'});
 let buffer=await image.png().toBuffer();
 if(o.rotate)buffer=await sharp(buffer).rotate(o.rotate,{background:'white'}).resize({width:400,height:500,fit:'inside'}).png().toBuffer();
 return buffer;
}`);
prepare=prepare.replace("  else{\n   if(!fs.existsSync(file)){\n    const found=await infer(p.imagePath);","  else{\n   const referenceInput=await preparedReference(p);\n   if(!fs.existsSync(file) && p.imageFit==='contain')await sharp(p.imagePath).resize({width:1200,height:1200,fit:'inside'}).jpeg({quality:88,mozjpeg:true}).toFile(file);\n   if(!fs.existsSync(file)){\n    const found=await infer(referenceInput);");
prepare=prepare.replace("const info=await sharp(p.imagePath).metadata();","const info=await sharp(referenceInput).metadata();").replace("await sharp(p.imagePath).extract","await sharp(referenceInput).extract").replace("const cropped=await infer(file);","const cropped=await infer(p.imageFit==='contain'?referenceInput:file);").replace("(await infer(p.imagePath))[0]","(await infer(referenceInput))[0]");write("scripts/prepare-gallery.cjs",prepare);
let credits=read("PORTRAIT-SOURCES.md").replace("Galeria de 30","Galeria de 40");
for(const p of gallery.slice(30))credits+="\n## "+p.name+" ("+p.dates+")\n\n- Estatuto: "+p.title+"\n- Autor: "+p.imageAuthor+"\n- Fonte: "+p.imageSource+"\n- Licença: "+p.license+" — "+p.licenseUrl+"\n- Biografia: "+p.biographyUrl+"\n- Transformações: "+p.imageChanges+"\n";write("PORTRAIT-SOURCES.md",credits);
let readme=read("README.md").replace(/\b30\b/g,"40").replace("300 parágrafos","400 parágrafos").replace("24 santos e 6 beatos","28 santos e 12 beatos").replaceAll("Setup-0.6.0.exe","Setup-0.7.0.exe");
readme=readme.replace("releases/latest/download/O-jesuita-sou-eu-Android-0.6.0.apk","releases/download/v0.6.0/O-jesuita-sou-eu-Android-0.6.0.apk").replace("- [Aplicação para Android 6 ou superior (.apk)]","- [APK Android 0.6.0, galeria anterior de 30 figuras]");
readme=readme.replace("Os instaladores incluem os 40 retratos e os modelos para funcionamento sem Internet.","A aplicação web e o instalador Windows 0.7.0 incluem as 40 figuras e os modelos para funcionamento sem Internet. O APK 0.6.0 mantém 30 figuras. No Android, instala a PWA para utilizar a galeria atual. A atualização direta do APK exige a chave de assinatura original, que não foi recuperada neste ambiente; não foi gerada uma chave substituta.");
readme+="\n## Galeria 0.7.0\n\nAcrescenta "+gallery.slice(30).map(p=>p.name).join(", ")+". São 28 santos e 12 beatos, com 400 parágrafos biográficos nas cinco línguas. A fotografia do santuário de John Sullivan é conservada completa; o desenho do painel não é redistribuído isoladamente.\n";write("README.md",readme);
write("native/README.md",read("native/README.md").replace("As duas aplicações incluem os 30 retratos, as biografias nas cinco línguas e os modelos.","A versão Windows 0.7.0 inclui 40 figuras e os modelos. O APK 0.6.0 mantém 30 figuras; a sua atualização direta exige a chave original. A PWA Android já tem 40 figuras."));
write("INSTALAR.md",read("INSTALAR.md").replace("A versão 0.6.0 tem dois pacotes com a galeria, as biografias e os modelos incluídos:","A aplicação web e o instalador Windows 0.7.0 têm 40 figuras. O APK Android 0.6.0 mantém 30 figuras e a atualização direta exige a chave original. No Android, instala a PWA para usar a galeria atual.").replaceAll("Setup-0.6.0.exe","Setup-0.7.0.exe"));
})().catch(e=>{console.error(e);process.exit(1)});
