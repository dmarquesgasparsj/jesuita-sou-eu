const fs=require('node:fs'),sharp=require('sharp'),crypto=require('node:crypto');
const ids=["nicolau-owen","paulo-miki","rutilio-grande","juliao-nakaura","jose-maria-rubio","jose-pignatelli"];
const title='San Pablo Miki, Museo de Bellas Artes de Sevilla.jpg';
const filename=title.replaceAll(' ','_'),hash=crypto.createHash('md5').update(filename).digest('hex');
const url='https://upload.wikimedia.org/wikipedia/commons/'+hash[0]+'/'+hash.slice(0,2)+'/'+encodeURIComponent(filename);
const out='.review/six';fs.mkdirSync(out,{recursive:true});
async function sheet(name,inputs){
 const images=[];
 for(const [i,p] of inputs.entries()){
  const label=Buffer.from('<svg width="260" height="26"><text x="8" y="18" font-size="14" fill="white">'+p.label+'</text></svg>');
  images.push({input:await sharp(p.file).rotate().resize(260,298,{fit:'contain',background:'#292824'}).jpeg().toBuffer(),left:i*260,top:26},{input:label,left:i*260,top:0});
 }
 const b=await sharp({create:{width:260*inputs.length,height:324,channels:3,background:'#292824'}}).composite(images).jpeg({quality:80}).toBuffer();
 fs.writeFileSync(out+'/'+name+'.json',JSON.stringify({image_url:'data:image/jpeg;base64,'+b.toString('base64')}));
}
async function main(){
 const extras=JSON.parse(fs.readFileSync('dist/biography-photos.json'));
 for(const id of ids){
  const original=fs.readdirSync('source-portraits').find(x=>x.startsWith(id+'.'));
  const inputs=[{label:'Atual',file:'dist/assets/portraits/'+id+'.jpg'},{label:'Fonte original',file:'source-portraits/'+original},...extras[id].map((p,i)=>({label:'Ficha '+(i+1),file:'dist/'+p.image}))];
  if(id==='paulo-miki'){
   try{
    const response=await fetch(url,{headers:{'User-Agent':'JesuitaSouEu/0.9.5 (public portrait review)'},signal:AbortSignal.timeout(25000)});
    if(!response.ok)throw Error(response.status);
    const file=out+'/miki-sevilha.jpg';
    fs.writeFileSync(file,Buffer.from(await response.arrayBuffer()));inputs.push({label:'Museu de Sevilha',file});
   }catch(e){console.log(url,e.message);}
  }
  await sheet(id,inputs);
 }
}
main().catch(e=>{console.error(e);process.exit(1)});
