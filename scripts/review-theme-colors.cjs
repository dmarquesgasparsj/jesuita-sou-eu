const fs=require('node:fs'),sharp=require('sharp');
const headers={'User-Agent':'Mozilla/5.0 (compatible; JesuitaSouEu theme reference)'};
async function get(url){const r=await fetch(url,{headers,signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(r.status+' '+url);return Buffer.from(await r.arrayBuffer());}
async function colors(bytes){const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});const counts=new Map();for(let i=0;i<data.length;i+=4){const[r,g,b,a]=data.subarray(i,i+4);if(a<230||Math.max(r,g,b)-Math.min(r,g,b)<18)continue;const hex='#'+[r,g,b].map(x=>x.toString(16).padStart(2,'0')).join('');counts.set(hex,(counts.get(hex)||0)+1);}return{width:info.width,height:info.height,colors:[...counts].sort((a,b)=>b[1]-a[1]).slice(0,12)};}
(async()=>{const result={};const m=await get('https://cdn.imweb.me/upload/S20251223704cbc073db19/5373c69088177.png');result.magis=await colors(m);
fs.mkdirSync('.review/theme',{recursive:true});fs.writeFileSync('.review/theme/reference-colors.json',JSON.stringify(result,null,2));
result.portugal=await colors(await get('https://content.pontosj.pt/wp-content/uploads/sites/13/2019/05/21141608/logo-curia-ihs-red.png'));
result.portugalSource='https://content.pontosj.pt/wp-content/uploads/sites/13/2019/05/21141608/logo-curia-ihs-red.png';
fs.mkdirSync('.review/theme',{recursive:true});fs.writeFileSync('.review/theme/reference-colors.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
})().catch(e=>{console.error(e.message);process.exitCode=1});
