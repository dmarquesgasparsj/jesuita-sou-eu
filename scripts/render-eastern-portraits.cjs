const fs=require('node:fs'),sharp=require('sharp');const {init,infer}=require('./portrait-inference.cjs');
const specs=[
['kostka-new',null],
['miki-new',[.37,.38,.27,.25]],
['joao-goto',[.37,.37,.27,.27]],
['diogo-kisai',[.37,.37,.27,.27]],
['juliao-nakaura',null],
['sebastiao-kimura',[.35,.10,.30,.25]],
['tomas-tsuji',[.26,.16,.47,.28]],
['pedro-kibe',[.34,.01,.33,.15]]
];
(async()=>{await init();for(const [id,region]of specs){try{
const file='.review/eastern/'+id,source=fs.readFileSync(file+'.source');const md=await sharp(source).metadata();let image=sharp(source);
let crop=null;if(region){const[x,y,w,h]=region;crop={left:Math.round(x*md.width),top:Math.round(y*md.height),width:Math.round(w*md.width),height:Math.round(h*md.height)};image=image.extract(crop);}
const ref=await image.resize(700,900,{fit:'inside',background:'white'}).png().toBuffer();
const faces=(await infer(ref)).filter(f=>f.box.width<.92&&f.box.height<.95).sort((a,b)=>b.score-a.score);
if(!faces[0]||faces[0].score<.4)throw Error('Insufficient face confidence '+JSON.stringify(faces.map(f=>({score:f.score,box:f.box}))));
const face=faces[0],m=await sharp(ref).metadata(),b=face.box;
let width=Math.min(m.width,Math.round(b.width*m.width*2.1)),height=Math.round(width*1.25);if(height>m.height){height=m.height;width=Math.round(height*.8);}
const left=Math.max(0,Math.min(m.width-width,Math.round((b.x+b.width/2)*m.width-width/2))),top=Math.max(0,Math.min(m.height-height,Math.round((b.y+b.height*.6)*m.height-height*.48)));
const out=await sharp(ref).extract({left,top,width,height}).resize(600,750).jpeg({quality:88,mozjpeg:true}).toBuffer();
fs.writeFileSync(file+'.portrait.jpg',out);const finalFaces=await infer(out);const selected=finalFaces.sort((a,b)=>b.score-a.score)[0]||face;
const preview=await sharp(out).resize(300,375).jpeg({quality:78}).toBuffer();
fs.writeFileSync(file+'.rendered.json',JSON.stringify({id,crop,referencePreparation:{crop,resize:[700,900],fit:'inside',rotate:0},face:selected,preview:preview.toString('base64')}));
console.log('PORTRAIT',id,'confidence',selected.score,'crop',JSON.stringify(crop));
}catch(e){console.error('REJECT',id,e.message);fs.writeFileSync('.review/eastern/'+id+'.rejected.json',JSON.stringify({id,error:e.message}));}}
})().catch(e=>{console.error(e);process.exitCode=1});
