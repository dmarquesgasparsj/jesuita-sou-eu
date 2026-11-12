
const fs=require('node:fs');
const {createHash}=require('node:crypto');
const sharp=require('sharp');
const out='.review/azevedo';
const titles=['Catedral Basílica de Salvador Sacristy Ceiling Inácio de Azevedo-0718.jpg','Ignatius de Azevedo, 8B6291068.jpg'];
async function preview(input,name){
 const b=await sharp(input).rotate().resize(500,630,{fit:'inside',withoutEnlargement:true}).jpeg({quality:78}).toBuffer();
 fs.writeFileSync(out+'/'+name+'.json',JSON.stringify({image_url:'data:image/jpeg;base64,'+b.toString('base64')}));
}
async function main(){
 fs.mkdirSync(out,{recursive:true});
 for(const [i,p] of ['dist/assets/portraits/inacio-azevedo.jpg','dist/assets/biography/inacio-azevedo-1.jpg','dist/assets/biography/inacio-azevedo-2.jpg'].entries()) await preview(p,'existing-'+i);
 for(const [i,title] of titles.entries()){
  const name=title.replaceAll(' ','_'), hash=createHash('md5').update(name).digest('hex');
  const url='https://upload.wikimedia.org/wikipedia/commons/'+hash[0]+'/'+hash.slice(0,2)+'/'+encodeURIComponent(name);
  try{
   let r=await fetch(url,{headers:{'User-Agent':'JesuitaSouEu/0.9.4 (public portrait review; github.com/dmarquesgasparsj/jesuita-sou-eu)'},signal:AbortSignal.timeout(25000)});
   if(!r.ok){await new Promise(r=>setTimeout(r,4000));r=await fetch(url+'?download=1',{signal:AbortSignal.timeout(25000)});}
   if(!r.ok)throw Error(r.status);
   const b=Buffer.from(await r.arrayBuffer());
   const f=out+'/candidate-'+i+'.jpg';
   await sharp(b).rotate().resize(1600,2000,{fit:'inside',withoutEnlargement:true}).jpeg({quality:92}).toFile(f);
   await preview(f,'candidate-'+i);
   console.log(JSON.stringify({title,url,metadata:await sharp(f).metadata()}));
  }catch(e){console.error(title,e.message);}
 }
}
main().catch(e=>{console.error(e);process.exit(1)});
