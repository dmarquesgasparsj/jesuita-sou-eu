const fs=require('node:fs'),sharp=require('sharp'); (async()=>{
const urls={owen:'https://upload.wikimedia.org/wikipedia/commons/3/3e/Nicholas_Owen_in_the_manacles.jpg',grande:'https://wp.en.aleteia.org/wp-content/uploads/sites/2/2022/01/WEB3-RUTILIO-GRANDE-GARCIA-JESUIT-PRIEST-EL-SALVADOR-02-PD.jpg',rubio:'https://static.religiondigital.org/clip/307b8930-a993-4178-a851-4ef92cdf5038_source-aspect-ratio_1600w_0.jpg'};
for(const [key,url] of Object.entries(urls))try{
const r=await fetch(url,{signal:AbortSignal.timeout(16000)});if(!r.ok)throw Error(r.status);const buf=Buffer.from(await r.arrayBuffer());
const p='.review/six/'+key+'-new';
await sharp(buf).rotate().resize(1400,1600,{fit:'inside',withoutEnlargement:true}).jpeg({quality:94}).toFile(p+'.jpg');
const b=await sharp(p+'.jpg').resize(560,650,{fit:'inside'}).jpeg({quality:78}).toBuffer();fs.writeFileSync(p+'.json',JSON.stringify({image_url:'data:image/jpeg;base64,'+b.toString('base64')}));
}catch(e){console.log(key,e.message);}
})().catch(e=>{console.error(e);process.exit(1)});