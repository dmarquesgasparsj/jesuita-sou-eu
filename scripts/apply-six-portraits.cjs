const fs=require('node:fs'),sharp=require('sharp'),crypto=require('node:crypto');
const {init,infer,inferFaceRegion}=require('./portrait-inference.cjs');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const write=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const defs=[{"id":"nicolau-owen","crop":[0.607,0.161,0.1,0.088],"face":{"x":0.18,"y":0.22,"width":0.57,"height":0.59}},{"id":"paulo-miki","input":".review/six/miki-alt.jpg","crop":[0.177,0.04,0.65,0.8125],"title":"San Pablo Miki, Museo de Bellas Artes de Sevilla.jpg","url":"https://upload.wikimedia.org/wikipedia/commons/7/74/San_Pablo_Miki%2C_Museo_de_Bellas_Artes_de_Sevilla.jpg","author":"Juan de Mesa (escultura); Jl FilpoC (fotografia)","collection":"Museu de Belas-Artes de Sevilha","license":"CC BY-SA 4.0","replaceExtra":0},{"id":"rutilio-grande","crop":[0.235,0.238,0.67,0.59]},{"id":"juliao-nakaura","crop":[0.135,0.174,0.62,0.515]},{"id":"jose-maria-rubio","input":"dist/assets/biography/jose-maria-rubio-1.jpg","crop":[0.34,0.002,0.31,0.290625],"title":"San José María Rubio S.J.jpg","url":"https://upload.wikimedia.org/wikipedia/commons/9/9e/San_Jos%C3%A9_Mar%C3%ADa_Rubio_S.J.jpg","author":"Fran Hernández (fotografia)","collection":"Paróquia de Santa Maria de Ambróx, Dalías","license":"CC BY-SA 3.0","replaceExtra":0},{"id":"jose-pignatelli","input":".review/six/pign-alt.jpg","crop":[0.295,0,0.47,0.57],"title":"Иосиф Пиньятелли.jpg","url":"https://upload.wikimedia.org/wikipedia/commons/4/4c/%D0%98%D0%BE%D1%81%D0%B8%D1%84_%D0%9F%D0%B8%D0%BD%D1%8C%D1%8F%D1%82%D0%B5%D0%BB%D0%BB%D0%B8.jpg","author":"Pintor não identificado; Gllenns (fotografia)","collection":"Wikimedia Commons","license":"CC BY-SA 4.0","replaceExtra":1}];
const gallery=read('dist/gallery.json'),extras=read('dist/biography-photos.json'),sources=read('scripts/portrait-sources.json');
const src=t=>'https://commons.wikimedia.org/wiki/File:'+encodeURIComponent(t.replaceAll(' ','_'));
const pd='Domínio público (Wikimedia Commons)',pdm='https://creativecommons.org/publicdomain/mark/1.0/';
const date='2026-11-12';
const labels={
 'paulo-miki':['Paulo Miki na pintura da Catedral de Salvador.','Pablo Miki en la pintura de la Catedral de Salvador.','Paul Miki dans la peinture de la cathédrale de Salvador.','Paul Miki in the Salvador Cathedral painting.','사우바도르 대성당 그림 속 바오로 미키.'],
 'jose-maria-rubio':['Fotografia histórica de José Maria Rubio.','Fotografía histórica de José María Rubio.','Photographie historique de José María Rubio.','Historical photograph of José María Rubio.','호세 마리아 루비오의 역사적 사진.'],
 'jose-pignatelli':['José Pignatelli na gravura publicada por Alfred Hamy em 1893.','José Pignatelli en el grabado publicado por Alfred Hamy en 1893.','Joseph Pignatelli dans la gravure publiée par Alfred Hamy en 1893.','Joseph Pignatelli in the engraving published by Alfred Hamy in 1893.','알프레드 아미가 1893년에 출판한 판화 속 요셉 피냐텔리.']
};
function captions(v){return Object.fromEntries(['pt','es','fr','en','ko'].map((k,i)=>[k,v[i]]));}
async function addExtra(id,position,file,title,author,values){
 const image='./assets/biography/'+id+'-'+(position+1)+'.jpg';
 await sharp(file).resize(1200,1400,{fit:'inside',withoutEnlargement:true}).jpeg({quality:88}).toFile('dist/'+image);
 extras[id][position]={image,captions:captions(values),author,license:pd,licenseUrl:pdm,sourceUrl:src(title),commonsTitle:'File:'+title,verifiedOn:date};
}
async function main(){
 await init();
 for(const d of defs){
  const g=gallery.find(x=>x.id===d.id),s=sources.find(x=>x.id===d.id),file='dist/'+g.image;
  const original='source-portraits/'+d.id+'.jpg';
  if(d.input){
   const image='./assets/biography/'+d.id+'-'+(d.replaceExtra+1)+'.jpg';
   // Copy the candidate first, in case it was an existing gallery image.
   fs.copyFileSync(d.input,original);
   fs.copyFileSync(file,'dist/'+image);
   extras[d.id][d.replaceExtra]={image,captions:captions(labels[d.id]),author:g.imageAuthor,license:g.license,licenseUrl:g.licenseUrl,sourceUrl:g.imageSource,commonsTitle:'File:'+g.commonsFilename,cropped:true,verifiedOn:date};
   const n=d.title.replaceAll(' ','_'),h=crypto.createHash('md5').update(n).digest('hex');
   const meta={commonsFilename:d.title,originalImageUrl:'https://upload.wikimedia.org/wikipedia/commons/'+h[0]+'/'+h.slice(0,2)+'/'+encodeURIComponent(n),imageAuthor:d.author,authorUnknown:false,imageCollection:d.collection,license:d.license,licenseKind:'cc',licenseUrl:'https://creativecommons.org/licenses/by-sa/'+d.license.split(' ').at(-1)+'/',imageDate:null,portraitNote:'Representação artística da pessoa identificada na fonte.'};
   Object.assign(g,meta,{imageSource:src(d.title),sourceUrl:src(d.title)});
   Object.assign(s,meta,{sourceUrl:src(d.title),imageSource:d.collection});
  }
  const m=await sharp(original).metadata();
  const [left,top,width,height]=d.crop.map((v,i)=>Math.round(v*(i%2?m.height:m.width)));
  const crop={left,top,width,height};
  await sharp(original).extract(crop).resize(600,750,{fit:'contain',background:'#e9e4da'}).jpeg({quality:91,mozjpeg:true}).toFile(file);
  const ref=d.face ? await inferFaceRegion(file,d.face,{neutral:true}) : (await infer(file,{neutral:true}))[0];
  if(!ref)throw Error('Não foi possível localizar o rosto: '+d.id);
  g.descriptor=ref.descriptor;
  g.position=s.position='50% 40%';
  g.imageChanges=s.imageChanges='Recorte e redimensionamento para 600 × 750 píxeis, sem alterar as feições.';
  if(d.id==='nicolau-owen')g.portraitNote=s.portraitNote='Pormenor da figura suspensa, comparado com a gravura de Melchior Küsel que identifica Nicolau Owen.';
  g.verifiedOn=s.verifiedOn=date;
  s.referencePreparation={crop,resize:[600,750],fit:'contain',...(d.face?{face:d.face}:{})};
  write('scripts/descriptors/'+d.id+'.json',ref);
  console.log(JSON.stringify({id:d.id,crop,box:ref.box,score:ref.score}));
  const preview=await sharp(file).resize(270,337).jpeg({quality:85}).toBuffer();
  write('.review/six/final-'+d.id+'.json',{image_url:'data:image/jpeg;base64,'+preview.toString('base64')});
 }
 await addExtra('nicolau-owen',1,'.review/six/owen-new.jpg','Nicholas Owen in the manacles.jpg','Melchior Küsel, em Mathias Tanner (1675)',['Nicolau Owen numa gravura publicada por Mathias Tanner em 1675.','Nicolás Owen en un grabado publicado por Mathias Tanner en 1675.','Nicolas Owen dans une gravure publiée par Mathias Tanner en 1675.','Nicholas Owen in an engraving published by Mathias Tanner in 1675.','마티아스 타너가 1675년에 출판한 판화 속 니콜라스 오언.']);
 await addExtra('juliao-nakaura',0,'.review/six/naka-alt.jpg','First Japanese Embassy to Europe 1586.png','Newe Zeyttung, Augsburgo, 1586; Universidade de Quioto',['A embaixada japonesa na Europa em 1586, com Julião Nakaura no canto superior esquerdo.','La embajada japonesa en Europa en 1586, con Julián Nakaura arriba a la izquierda.','L’ambassade japonaise en Europe en 1586, avec Julien Nakaura en haut à gauche.','The Japanese embassy in Europe in 1586, with Julian Nakaura at the upper left.','1586년 유럽을 방문한 일본 사절단. 왼쪽 위는 줄리앙 나카우라.']);
 write('dist/gallery.json',gallery);write('dist/biography-photos.json',extras);write('scripts/portrait-sources.json',sources);
}
main().catch(e=>{console.error(e);process.exit(1)});
