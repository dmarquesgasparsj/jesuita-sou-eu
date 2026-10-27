const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const {init,infer}=require('./portrait-inference.cjs');
const candidates=[["kostka-new","StanislausKostka.jpg"],["miki-new","Catedral Basílica de Salvador Sacristy Ceiling-0702.jpg"],["joao-goto","Catedral Basílica de Salvador Sacristy Ceiling São João Soan de Goto-0716.jpg"],["diogo-kisai","Catedral Basílica de Salvador Sacristy Ceiling Jacob Kisai-0715.jpg"],["juliao-nakaura","中浦ジュリアン肖像画 アンブロジアーナ図書館蔵.jpg"],["leonardo-kimura","Martyrdom-of-Leonardo-Kimura-with-4-Christians-in-Nagasaki-Nov-18-1619-(made-c1626).png"],["tomas-tsuji","Gerard Bouttats - T. Thomacce Tzuqqi.jpg"],["sebastiao-kimura","Sebastião Kimura.jpg"],["pedro-kibe","Pedro Kasui Kibe.jpg"]];
const ua={'User-Agent':'JesuitaSouEu/0.9 educational gallery (https://github.com/dmarquesgasparsj/jesuita-sou-eu)'};
async function get(url,json=false){for(let i=0;i<5;i++){try{const r=await fetch(url,{headers:ua,signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error(r.status+' '+url);return json?await r.json():Buffer.from(await r.arrayBuffer());}catch(e){if(i===4)throw e;await new Promise(r=>setTimeout(r,4000*(i+1)));}}}
(async()=>{
fs.mkdirSync('.review/eastern',{recursive:true});await init();
for(const [id,title]of candidates){
const out='.review/eastern/'+id;
if(fs.existsSync(out+'.json')){console.log('Already prepared',id);continue;}
const url='https://commons.wikimedia.org/w/api.php?'+new URLSearchParams({action:'query',format:'json',prop:'imageinfo',titles:'File:'+title,iiprop:'url|size|extmetadata'});
const metadata=await get(url,true),page=Object.values(metadata.query.pages)[0],info=page.imageinfo?.[0];if(!info)throw Error('Missing Commons file '+title);
const bytes=await get(info.url);fs.writeFileSync(out+'.source',bytes);
const preview=await sharp(bytes).resize({width:420,height:600,fit:'inside',withoutEnlargement:true}).jpeg({quality:78}).toBuffer();
const faces=await infer(bytes);
fs.writeFileSync(out+'.json',JSON.stringify({id,title,info,faces,preview:preview.toString('base64')}));
console.log(id,info.width,info.height,'faces',faces.map(f=>({score:f.score,box:f.box})));
await new Promise(r=>setTimeout(r,1500));
}
for(const id of ['estanislao-kostka','john-sullivan']){
const file='dist/assets/portraits/'+id+'.jpg';const b=await sharp(file).resize({width:420,height:600,fit:'inside'}).jpeg({quality:78}).toBuffer();fs.writeFileSync('.review/eastern/current-'+id+'.json',JSON.stringify({id,preview:b.toString('base64')}));
}
})().catch(e=>{console.error(e);process.exitCode=1});
