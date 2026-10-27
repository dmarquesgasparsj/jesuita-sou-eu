const fs=require('node:fs');const sharp=require('sharp');
(async()=>{const root='.review/gallery-refinement';
const copies=[{"from":"candidate-1.jpg","to":"dist/assets/biography/joao-goto-2.jpg"},{"from":"candidate-0.jpg","to":"dist/assets/biography/diogo-kisai-2.jpg"},{"from":"candidate-2.jpg","to":"dist/assets/biography/juliao-nakaura-2.jpg"},{"from":"candidate-3.jpg","to":"dist/assets/biography/sebastiao-kimura-2.jpg"}];
for(const c of copies){fs.copyFileSync(root+'/'+c.from,c.to);const m=await sharp(c.to).metadata();if(m.width<200||m.height<200)throw Error('Image too small');}
fs.copyFileSync(root+'/john-sullivan.jpg','dist/assets/portraits/john-sullivan.jpg');
const m=await sharp('dist/assets/portraits/john-sullivan.jpg').metadata();if(m.width!==600||m.height!==557)throw Error('Unexpected John Sullivan crop');
console.log('Four new works and Sullivan portrait copied, preserving image provenance');
})().catch(e=>{console.error(e);process.exit(1)});
