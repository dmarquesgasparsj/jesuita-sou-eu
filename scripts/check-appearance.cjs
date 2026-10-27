const assert=require('node:assert/strict'),{pathToFileURL}=require('node:url'),path=require('node:path');
(async()=>{
 const {initAppearance,THEME_KEY,THEME_BROWSER_COLORS}=await import(pathToFileURL(path.resolve(__dirname,'../dist/appearance.js')));
 class Element {constructor(id){this.id=id;this.hidden=id==='appearance-panel';this.attrs={};this.listeners={};this.checked=false;}setAttribute(k,v){this.attrs[k]=v;}addEventListener(k,f){(this.listeners[k]||=[]).push(f);}fire(k,e={}){for(const f of this.listeners[k]||[])f({target:this,...e});}focus(){this.focused=true;}}
 function fixture(saved,blocked=false){const ids=['appearance-open','appearance-panel','appearance-close','appearance-original','appearance-magis','appearance-portugal','browser-theme-color'];const elements=Object.fromEntries(ids.map(id=>[id,new Element(id)]));const listeners={},writes=[];const doc={documentElement:{dataset:{}},getElementById:id=>elements[id],addEventListener(k,f){(listeners[k]||=[]).push(f);},fire(k,event){for(const f of listeners[k]||[])f(event);}};const storage={getItem(key){assert.equal(key,THEME_KEY);if(blocked)throw Error('Storage disabled');return saved;},setItem(key,value){if(blocked)throw Error('Storage disabled');writes.push([key,value]);}};return{doc,elements,storage,writes};}
 const a=fixture('magis'),controller=initAppearance(a.doc,a.storage),el=a.elements;
 assert.equal(a.doc.documentElement.dataset.theme,'magis');assert(el['appearance-magis'].checked);assert.equal(el['browser-theme-color'].attrs.content,THEME_BROWSER_COLORS.magis);assert.deepEqual(a.writes,[],'Loading a preference must not rewrite storage');
 el['appearance-open'].fire('click');assert.equal(el['appearance-panel'].hidden,false);assert.equal(el['appearance-open'].attrs['aria-expanded'],'true');assert(el['appearance-magis'].focused);
 a.doc.fire('pointerdown',{target:{closest:()=>el['appearance-open']}});assert.equal(el['appearance-panel'].hidden,false,'Interaction inside the settings must keep the panel open');
 el['appearance-portugal'].checked=true;el['appearance-portugal'].fire('change');assert.equal(controller.theme,'portugal');assert.equal(a.doc.documentElement.dataset.theme,'portugal');assert(!el['appearance-magis'].checked);assert.equal(el['browser-theme-color'].attrs.content,THEME_BROWSER_COLORS.portugal);assert.deepEqual(a.writes,[[THEME_KEY,'portugal']],'Persist only the selected palette');
 a.doc.fire('keydown',{key:'Escape'});assert(el['appearance-panel'].hidden);assert(el['appearance-open'].focused);assert.equal(el['appearance-open'].attrs['aria-expanded'],'false');
 el['appearance-open'].fire('click');a.doc.fire('pointerdown',{target:{closest:()=>null}});assert(el['appearance-panel'].hidden);
 el['appearance-open'].fire('click');el['appearance-close'].fire('click');assert(el['appearance-panel'].hidden);
 for(const saved of ['<script>','missing',null]){const f=fixture(saved);initAppearance(f.doc,f.storage);assert.equal(f.doc.documentElement.dataset.theme,'original');assert.deepEqual(f.writes,[]);}
 const denied=fixture('portugal',true);initAppearance(denied.doc,denied.storage);assert.equal(denied.doc.documentElement.dataset.theme,'original');denied.elements['appearance-magis'].checked=true;denied.elements['appearance-magis'].fire('change');assert.equal(denied.doc.documentElement.dataset.theme,'magis','Themes must work when storage is blocked');

 const fs=require('node:fs');
 const css=fs.readFileSync(path.resolve(__dirname,'../dist/style.css'),'utf8');
 const palettes={};
 for(const match of css.matchAll(/:root\[data-theme="(magis|portugal)"\]\{([^}]+)\}/g)){
   const values=Object.fromEntries([...match[2].matchAll(/--([a-z-]+):([^;]+)/g)].map(m=>[m[1],m[2].trim()]));
   Object.assign(palettes[match[1]]||=( {} ),values);
 }
 function luminance(hex){const values=hex.slice(1).match(/../g).slice(0,3).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return values[0]*.2126+values[1]*.7152+values[2]*.0722;}
 function contrast(a,b){const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
 assert.equal(Object.keys(palettes).length,2);
 for(const[name,p]of Object.entries(palettes)){
   for(const[a,b]of [['ink','paper'],['muted','paper'],['action-text','action'],['gold','paper']]){
     assert(contrast(p[a],p[b])>=4.5,name+': insufficient text contrast for '+a+'/'+b);
   }
   assert(contrast(p.focus,p.white)>=3,name+': focus visibility');
 }
 console.log(JSON.stringify({status:'passed',themes:3,text_contrast_verified:true,preference_restored:true,only_color_preference_persisted:true,blocked_storage_supported:true,escape_and_outside_close:true,radio_selection_and_browser_color:true}));
})().catch(e=>{console.error(e);process.exit(1)});
