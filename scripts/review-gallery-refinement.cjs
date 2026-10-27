
const fs=require('node:fs');const crypto=require('node:crypto');const sharp=require('sharp');
const out='.review/gallery-refinement';fs.mkdirSync(out,{recursive:true});
const titles=[
'Guido Cagnaccio - Three Jesuit martyrs in Japan.jpg',
'Pedro garcìa ferrer, martirio dei santi gesuiti pablo miki, juan gotò e diego kisai in giappone, 1628, dalla casa professa dei gesuiti a valencia.jpg',
'Nakaura -Juliao-Cardim-p200.jpg',
'Blessed Sebastian Kimura, Priest, and the 204 Martyrs 2.jpg'
];
async function get(url){for(let i=0;i<3;i++){try{const r=await fetch(url,{headers:{'User-Agent':'JesuitaSouEu/0.9.3 (educational image verification; github.com/dmarquesgasparsj/jesuita-sou-eu)'},signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error(r.status+' '+url);return Buffer.from(await r.arrayBuffer());}catch(e){if(i===2)throw e;}}}
(async()=>{
const results=[];
for(let i=0;i<titles.length;i++){
 const t=titles[i],name=t.replaceAll(' ','_'),hash=crypto.createHash('md5').update(name).digest('hex');
 const url='https://upload.wikimedia.org/wikipedia/commons/'+hash[0]+'/'+hash.slice(0,2)+'/'+encodeURIComponent(name);
 const b=await get(url);await sharp(b).rotate().resize({width:1200,height:1400,fit:'inside',withoutEnlargement:true}).jpeg({quality:86,mozjpeg:true}).toFile(out+'/candidate-'+i+'.jpg');
 const preview=await sharp(b).rotate().resize({width:500,height:650,fit:'inside',withoutEnlargement:true}).jpeg({quality:80}).toBuffer();
 fs.writeFileSync(out+'/candidate-'+i+'.json',JSON.stringify({title:t,url,image_url:'data:image/jpeg;base64,'+preview.toString('base64')}));
 results.push({title:t,url,metadata:await sharp(b).metadata()});
}
const john=await sharp('source-portraits/john-sullivan.jpg').extract({left:3180,top:580,width:1000,height:1150}).resize(600,690).jpeg({quality:88,mozjpeg:true}).toBuffer();
fs.writeFileSync(out+'/john-sullivan.jpg',john);
fs.writeFileSync(out+'/john-sullivan.json',JSON.stringify({image_url:'data:image/jpeg;base64,'+john.toString('base64')}));
try{
 const query=new URLSearchParams({action:'query',format:'json',prop:'imageinfo',iiprop:'url|extmetadata',titles:'File:Petro Kasui Kibe statue.jpg'});
 const b=await get('https://ja.wikipedia.org/w/api.php?'+query);
 fs.writeFileSync(out+'/kibe-source.json',b);
}catch(e){fs.writeFileSync(out+'/kibe-source.json',JSON.stringify({error:e.message}));}
fs.writeFileSync(out+'/sources.json',JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exit(1)});
