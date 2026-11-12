
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const http=require('node:http');
const {createHash}=require('node:crypto');
const {execFileSync}=require('node:child_process');
const sharp=require('sharp');
const {chromium}=require('playwright');
const digest=b=>createHash('sha256').update(b).digest('hex');
const base='28f46129513465617bda9457e9a2112f33dd5737';
const requestHeaders={'User-Agent':'JesuitaSouEu/0.9.4 (test of public official portraits)'};
async function fetchOK(url){
 const r=await fetch(url,{headers:requestHeaders,signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw Error(r.status+' '+url);
 return r;
}
async function publicPhotos(){
 const rev='aec3e4a88af843b282c0576f420b930f6a9a46ad';
 const tree=await (await fetchOK('https://api.github.com/repos/unitedstates/images/git/trees/'+rev+'?recursive=1')).json();
 const picks=tree.tree.filter(e=>/^congress\/450x550\/[A-Z][0-9]+\.jpg$/.test(e.path))
   .sort((a,b)=>digest('stand-2026-11-12:'+a.path).localeCompare(digest('stand-2026-11-12:'+b.path)));
 assert(picks.length>=50,'Need at least 50 public portraits');
 const photos=[];
 for(let i=0; i<picks.length && photos.length<50; i+=8){
  const batch=await Promise.allSettled(picks.slice(i,i+8).map(async p=>{
   const url='https://raw.githubusercontent.com/unitedstates/images/'+rev+'/'+p.path;
   const buffer=Buffer.from(await (await fetchOK(url)).arrayBuffer());
   const m=await sharp(buffer).metadata();
   assert.equal(m.format,'jpeg');
   return {name:path.basename(p.path),url,buffer,sha256:digest(buffer),mimeType:'image/jpeg'};
  }));
  for(const item of batch)if(item.status==='fulfilled' && !photos.some(p=>p.sha256===item.value.sha256) && photos.length<50)photos.push(item.value);
 }
 assert.equal(photos.length,50);
 return {rev,photos};
}
function serve(dirs){
 const types={'.js':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml'};
 const server=http.createServer((req,res)=>{
  const route=new URL(req.url,'http://127.0.0.1').pathname;
  const [,version,...parts]=route.split('/');
  const name=parts.join('/')||'index.html';
  const root=dirs[version];
  if(req.method!=='GET'||!root||name.includes('..')){res.writeHead(404).end();return;}
  const f=path.join(root,name);
  if(!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',types[path.extname(f)]||'application/octet-stream');
  fs.createReadStream(f).pipe(res);
 });
 return new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve(server)));
}
async function videoFixture(photo, file) {
 const w=640,h=480;
 const raw=await sharp(photo.buffer).resize(w,h,{fit:'contain',background:'#8b8b8b'}).removeAlpha().toColourspace('srgb').raw().toBuffer();
 const y=Buffer.alloc(w*h),u=Buffer.alloc(w*h/4),v=Buffer.alloc(w*h/4);
 for(let j=0;j<h;j++)for(let i=0;i<w;i++){
  const k=j*w+i,r=raw[3*k],g=raw[3*k+1],b=raw[3*k+2];
  y[k]=Math.round(16+.257*r+.504*g+.098*b);
  if(i%2===0&&j%2===0){const c=j/2*w/2+i/2;u[c]=Math.round(128-.148*r-.291*g+.439*b);v[c]=Math.round(128+.439*r-.368*g-.071*b);}
 }
 const frame=Buffer.concat([Buffer.from('FRAME\n'),y,u,v]);
 fs.writeFileSync(file,Buffer.concat([Buffer.from('YUV4MPEG2 W640 H480 F30:1 Ip A1:1 C420jpeg\n'),...Array(30).fill(frame)]));
}
async function start(browser,origin,version,stand=false){
 const context=await browser.newContext({permissions:['camera'],viewport:{width:820,height:1180},serviceWorkers:'block'});
 const page=await context.newPage();
 const issues=[],outgoing=[];
 await context.route('**/*',route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.origin!==origin || request.method()!=='GET'){outgoing.push({url:url.origin+url.pathname,method:request.method()});return route.abort();}
  return route.continue();
 });
 page.on('pageerror',e=>issues.push(e.message));
 await page.goto(origin+'/'+version+'/?lang=pt'+(stand?'&stand=1':''));
 await page.waitForSelector('#model-status[data-i18n="modelReady"]',{state:'attached',timeout:120000});
 return {context,page,issues,outgoing};
}
const checkReset=async page=> {
 await page.waitForFunction(()=>document.querySelector('#results').hidden&&!document.querySelector('#camera-start').disabled,{},{timeout:30000});
};
async function visit(page,photo,isCurrent){
 const now=Date.now();
 await page.locator('#photo-file').setInputFiles({name:photo.name,mimeType:photo.mimeType,buffer:photo.buffer});
 const state=await outcome(page,isCurrent);
 if(state.name)await page.locator('#new-person').click();
 else await page.locator('#retry').click();
 await checkReset(page);
 return {...state,ms:Date.now()-now};
}
async function outcome(page,isCurrent){
 await page.waitForFunction(()=>!document.querySelector('#results').hidden||document.querySelector('#station-message').classList.contains('error'),{},{timeout:45000});
 return page.evaluate(current=>{
  const get=id=>document.getElementById(id);
  const error=get('results').hidden ? get('station-message').dataset.i18n : null;
  const mem=window.faceapi.tf.memory();
  return {
   name:error?null:get('result-portrait-caption').textContent,
   error,
   clean:!current||(get('capture-canvas').width===1&&get('capture-canvas').height===1&&!get('photo-file').value&&!get('result-selfie')&&!get('photo-preview')&&!get('camera').srcObject),
   tensors:mem.numTensors,bytes:mem.numBytes,backend:window.faceapi.tf.getBackend()
  };
 },isCurrent);
}
const stable=(a,b)=>a.name&&b.name&&a.name===b.name;
const q=(v,x)=>[...v].sort((a,b)=>a-b)[Math.min(v.length-1,Math.ceil(x*v.length)-1)];
function tally(r){const names={};for(const x of r)if(x.name)names[x.name]=(names[x.name]||0)+1;return names;}
async function main(){
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'jesuita-stand-'));
 const old=path.join(tmp,'old');
 fs.mkdirSync(old);
 // Only source history is unpacked; no visitor photos are written to the repo.
 const archive=execFileSync('git',['archive',base,'dist'],{maxBuffer:80*1024*1024});
 execFileSync('tar',['-x','-C',old],{input:archive});
 const {rev,photos}=await publicPhotos();
 const y4m=path.join(tmp,'camera.y4m');
 await videoFixture(photos[0],y4m);
 const server=await serve({current:path.resolve('dist'),baseline:path.join(old,'dist')});
 const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--use-file-for-fake-video-capture='+y4m]});
 try{
  const current=await start(browser,origin,'current');
  const uploads=[];
  for(let i=0;i<photos.length;i++){
   uploads.push(await visit(current.page,photos[i],true));
   console.log('Upload',i+1,JSON.stringify(uploads.at(-1)));
  }
  const blank={name:'blank.jpg',mimeType:'image/jpeg',buffer:await sharp({create:{width:450,height:550,channels:3,background:'#808080'}}).jpeg().toBuffer()};
  const rejected=await visit(current.page,blank,true);
  assert(rejected.error&&rejected.clean,'No-face error must clear the input and permit the next visitor');
  const restored=await visit(current.page,photos[0],true);
  assert(restored.name&&restored.clean,'Recover after a rejected photo');
  const n=12, variants=[];
  for(const p of photos.slice(0,n))variants.push({...p,buffer:await sharp(p.buffer).linear([.68,.60,.53],[0,0,0]).jpeg({quality:90}).toBuffer()});
  const perturbed=[];
  for(const p of variants)perturbed.push(await visit(current.page,p,true));
  const photoSummary={completed:uploads.filter(x=>x.name).length,rejected:uploads.filter(x=>x.error).length,clean:uploads.every(x=>x.clean),backend:uploads.at(-1).backend,distinctResults:Object.keys(tally(uploads)).length,results:tally(uploads),p50Ms:q(uploads.map(x=>x.ms),.50),p95Ms:q(uploads.map(x=>x.ms),.95),tensorsAfter10:uploads[9].tensors,tensorsAfter25:uploads[24].tensors,tensorsAfter50:uploads[49].tensors};
  await current.context.close();
  const stand=await start(browser,origin,'current',true);
  assert(await stand.page.locator('#upload-button').isHidden(),'The stand does not ask to import personal files');
  const camera=[];
  for(let i=0;i<15;i++){
   await stand.page.locator('#camera-start').click();
   await stand.page.locator('#capture').waitFor({state:'visible'});
   await stand.page.locator('#capture').click();
   const x=await outcome(stand.page,true);
   camera.push(x);
   console.log('Camera',i+1,JSON.stringify(x));
   if(x.name)await stand.page.locator('#new-person').click();
   else await stand.page.locator('#retry').click();
   await checkReset(stand.page);
  }
  await stand.page.locator('#camera-start').click();
  await stand.page.locator('#capture').waitFor({state:'visible'});
  await stand.page.locator('#camera-cancel').click();
  assert(await stand.page.evaluate(()=>!document.querySelector('#camera').srcObject),'Cancel must stop the camera');
  await stand.context.close();
  const baseline=await start(browser,origin,'baseline');
  const baseNormal=[],baseDark=[];
  for(let i=0;i<n;i++){
   baseNormal.push(await visit(baseline.page,photos[i],false));
   baseDark.push(await visit(baseline.page,variants[i],false));
  }
  await baseline.context.close();
  const report={
   corpus:{source:'https://github.com/unitedstates/images',revision:rev,inputs:photos.map(({url,sha256})=>({url,sha256})),count:photos.length},
   uploads:photoSummary,camera:{attempted:camera.length,completed:camera.filter(x=>x.name).length,clean:camera.every(x=>x.clean),tensorsFirst:camera[0].tensors,tensorsLast:camera.at(-1).tensors},
   lighting:{pairs:n,baselineSameFirst:baseNormal.filter((x,i)=>stable(x,baseDark[i])).length,newSameFirst:uploads.slice(0,n).filter((x,i)=>stable(x,perturbed[i])).length,baselineRejected:baseDark.filter(x=>x.error).length,newRejected:perturbed.filter(x=>x.error).length},
   issues:[...current.issues,...stand.issues,...baseline.issues],outgoing:[...current.outgoing,...stand.outgoing],blankRejectedAndRecovered:true
  };
  fs.mkdirSync('.review/stand',{recursive:true});
  fs.writeFileSync('.review/stand/report.json',JSON.stringify(report,null,2)+'\n');
  console.log('SUMMARY',JSON.stringify({...report,corpus:{count:photos.length,revision:rev}}));
  assert(photoSummary.clean&&report.camera.clean&&report.camera.completed===15);
  assert(photoSummary.completed>=48,'Most single-face photos must complete');
  assert(photoSummary.tensorsAfter50<=photoSummary.tensorsAfter25+2,'No steady accumulation of tensors after model warmup');
  assert.equal(report.outgoing.length,0,'No external requests or request bodies during visitor sessions');
  assert.equal(report.issues.length,0);
  assert(report.lighting.newSameFirst>=report.lighting.baselineSameFirst,'Lighting consistency should not regress on this sample');
 }finally{
  await browser.close();await new Promise(resolve=>server.close(resolve));
  fs.rmSync(tmp,{recursive:true,force:true});
 }
}
main().catch(e=>{console.error(e);process.exit(1)});
