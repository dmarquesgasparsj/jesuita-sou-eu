const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '../dist');
async function main() {
  const gallery = JSON.parse(fs.readFileSync(path.join(root, 'gallery.json')));
  const extras = JSON.parse(fs.readFileSync(path.join(root, 'biography-photos.json')));
  assert.deepEqual(Object.keys(extras).sort(), gallery.map(p => p.id).sort());
  let additionalImages = 0;
  for (const person of gallery) {
    const photos = extras[person.id];
    assert(photos.length >= 1 && photos.length <= 2, person.id + ': two or three images including the original');
    for (const photo of photos) {
      additionalImages++;
      assert(photo.image.startsWith('./assets/biography/'));
      assert(fs.statSync(path.join(root, photo.image)).size > 1000);
      assert(photo.sourceUrl.startsWith('https://commons.wikimedia.org/'));
      assert(photo.author && photo.license && photo.licenseUrl.startsWith('https://'));
      for (const code of ['pt', 'es', 'fr', 'en', 'ko']) assert(photo.captions[code]?.trim());
      assert.notEqual(photo.image, person.image);
    }
    assert.equal(new Set(photos.map(p => p.image)).size, photos.length);
  }
  const { mountPhotoGallery } = await import(pathToFileURL(path.join(root, 'photo-gallery.js')));
  class Host extends EventTarget {
    constructor() { super(); this.attrs = {}; this.innerHTML = ''; this.focused = null; }
    setAttribute(k, v) { this.attrs[k] = v; }
    querySelector(selector) { return { focus: () => { this.focused = selector; } }; }
    fire(type, data) { const e = new Event(type, { cancelable: true }); for (const [k,v] of Object.entries(data)) Object.defineProperty(e, k, { value: v }); this.dispatchEvent(e); return e; }
  }
  const host = new Host(), changes = [], enlarged = [];
  const photos = gallery.slice(0,3).map((p,i) => ({ image: p.image, caption: 'Caption '+i, author: p.imageAuthor, license: p.license, sourceUrl:p.imageSource, licenseUrl:p.licenseUrl }));
  const labels = { previous:'Previous', next:'Next', enlarge:'Enlarge', gallery:'Gallery', counter:(i,n)=>`${i} of ${n}`, credit:'Image', source:'Source' };
  const control = mountPhotoGallery(host, photos, labels, {onChange:i=>changes.push(i),onEnlarge:p=>enlarged.push(p)});
  const button = action => ({dataset:{photoAction:action},closest:()=>({dataset:{photoAction:action}})});
  const key = k => host.fire('keydown', {key:k,target:button('next')});
  assert(host.innerHTML.includes('1 of 3'));
  host.fire('click',{target:button('next')}); assert.equal(control.index,1); assert(host.innerHTML.includes('Caption 1')); assert(host.innerHTML.includes(photos[1].licenseUrl));
  assert(host.focused.includes('next'));
  assert(key('ArrowRight').defaultPrevented); assert.equal(control.index,2);
  key('ArrowRight'); assert.equal(control.index,0,'Wrap from the last image to the first');
  key('ArrowLeft'); assert.equal(control.index,2,'Wrap backwards');
  host.fire('click',{target:button('enlarge')}); assert.equal(enlarged[0],photos[2]);
  const viewport = {closest:()=>({}),setPointerCapture() {}};
  function swipe(x,y) {
    host.fire('pointerdown',{pointerType:'touch',isPrimary:true,pointerId:1,clientX:200,clientY:100,target:viewport});
    return host.fire('pointerup',{pointerId:1,clientX:200+x,clientY:100+y,target:viewport});
  }
  swipe(-100,5); assert.equal(control.index,0,'Swipe left advances');
  host.fire('click',{target:button('enlarge')}); assert.equal(enlarged.length,1,'A swipe must not also open the lightbox');
  swipe(100,5); assert.equal(control.index,2,'Swipe right goes back');
  swipe(10,120); assert.equal(control.index,2,'Vertical scrolling must not change images');
  host.fire('pointerdown',{pointerType:'touch',isPrimary:true,pointerId:1,clientX:200,clientY:100,target:viewport});
  host.fire('pointercancel',{});
  host.fire('pointerup',{pointerId:1,clientX:20,clientY:100,target:viewport}); assert.equal(control.index,2);
  control.destroy(); const count=changes.length; key('ArrowRight'); assert.equal(changes.length,count,'Disposed galleries must not retain listeners');
  const reopened=mountPhotoGallery(host,photos,labels,{index:2}); assert(host.innerHTML.includes('3 of 3')); reopened.destroy();
  const one=mountPhotoGallery(host,photos.slice(0,1),labels); assert(host.innerHTML.includes('class="photo-navigation" hidden')); one.destroy();
  console.log(JSON.stringify({status:'passed',profiles:gallery.length,additionalImages,arrows:true,keyboard:true,swipe:true,vertical_scroll_preserved:true,enlarge:true,credits_follow_image:true,listener_cleanup:true}));
}
main().catch(error=>{console.error(error);process.exit(1);});
