
const fs=require('node:fs'),sharp=require('sharp'),crypto=require('node:crypto');
const targets={pign:'Иосиф Пиньятелли.jpg',naka:'First Japanese Embassy to Europe 1586.png',rubio:'Madrid - Iglesia de San Francisco de Borja 10.jpg',miki:'San Pablo Miki, Museo de Bellas Artes de Sevilla.jpg',grande:'Óscar Romero (al centro) y Rutilio Grande (al lado derecho) c. 1977.jpg'};
const out='.review/six';
async function get(url){const r=await fetch(url,{headers:{'User-Agent':'JesuitaSouEu/0.9.5 (portrait review; github.com/dmarquesgasparsj/jesuita-sou-eu)'},signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error(r.status+' '+url);return r;}
(async()=>{
 const meta={};
 for(const [key,title] of Object.entries(targets)){
 try {
 const name=title.replaceAll(' ','_'),hash=crypto.createHash('md5').update(name).digest('hex');
 const url='https://upload.wikimedia.org/wikipedia/commons/'+hash[0]+'/'+hash.slice(0,2)+'/'+encodeURIComponent(name);
 const file=out+'/'+key+'-alt.jpg';
 const existing=key==='miki'?out+'/miki-sevilha.jpg':null;
 const input=existing&&fs.existsSync(existing)?existing:Buffer.from(await (await get(url)).arrayBuffer());
 await sharp(input).rotate().resize(2200,2200,{fit:'inside',withoutEnlargement:true}).jpeg({quality:94}).toFile(file);
 const preview=await sharp(file).resize(600,740,{fit:'inside'}).jpeg({quality:81}).toBuffer();
 fs.writeFileSync(out+'/'+key+'-alt.json',JSON.stringify({image_url:'data:image/jpeg;base64,'+preview.toString('base64')}));
 const query=new URLSearchParams({action:'query',format:'json',titles:'File:'+title,prop:'imageinfo',iiprop:'url|extmetadata',iiextmetadatafilter:'Artist|LicenseShortName|LicenseUrl|ImageDescription|NonFree'});
 try{
 const p=Object.values((await (await get('https://commons.wikimedia.org/w/api.php?'+query)).json()).query.pages)[0];
 const i=p.imageinfo?.[0];
 meta[key]={title,url,...Object.fromEntries(Object.entries(i?.extmetadata||{}).map(([k,v])=>[k,v.value]))};
 }catch(e){meta[key]={title,url,error:e.message};}
 }catch(e){meta[key]={title,error:e.message};}
 }
 const o=await sharp('source-portraits/nicolau-owen.jpg').resize(750,1000,{fit:'inside'}).jpeg({quality:88}).toBuffer();
 fs.writeFileSync(out+'/owen-full.json',JSON.stringify({image_url:'data:image/jpeg;base64,'+o.toString('base64')}));
 fs.writeFileSync(out+'/meta.json',JSON.stringify(meta,null,2));
})().catch(e=>{console.error(e);process.exit(1)});
