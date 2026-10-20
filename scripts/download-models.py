from pathlib import Path
from urllib.request import Request,urlopen
from concurrent.futures import ThreadPoolExecutor
import json, time
ROOT=Path(__file__).resolve().parents[1]/'dist'
BASE='https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/'
items={
'vendor/face-api.min.js':'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js',
'vendor/face-api-LICENSE.txt':BASE+'LICENSE',
'models/tiny_face_detector_model-weights_manifest.json':BASE+'weights/tiny_face_detector_model-weights_manifest.json',
'models/tiny_face_detector_model-shard1':BASE+'weights/tiny_face_detector_model-shard1',
'models/ssd_mobilenetv1_model-weights_manifest.json':BASE+'weights/ssd_mobilenetv1_model-weights_manifest.json',
'models/ssd_mobilenetv1_model-shard1':BASE+'weights/ssd_mobilenetv1_model-shard1',
'models/ssd_mobilenetv1_model-shard2':BASE+'weights/ssd_mobilenetv1_model-shard2',
'models/face_landmark_68_model-weights_manifest.json':BASE+'weights/face_landmark_68_model-weights_manifest.json',
'models/face_landmark_68_model-shard1':BASE+'weights/face_landmark_68_model-shard1',
'models/face_recognition_model-weights_manifest.json':BASE+'weights/face_recognition_model-weights_manifest.json',
'models/face_recognition_model-shard1':BASE+'weights/face_recognition_model-shard1',
'models/face_recognition_model-shard2':BASE+'weights/face_recognition_model-shard2',
}
def fetch(item):
 rel,url=item
 dest=ROOT/rel
 if dest.exists() and dest.stat().st_size>0:return (rel,dest.stat().st_size,'exists')
 for attempt in range(3):
  try:
   data=urlopen(Request(url,headers={'User-Agent':'Mozilla/5.0 JesuitPortraitPrototype/1.0'}),timeout=35).read()
   dest.parent.mkdir(parents=True,exist_ok=True)
   dest.write_bytes(data)
   print(rel,len(data),'saved',flush=True)
   return (rel,len(data),'saved')
  except Exception as e:
   print(rel,'attempt',attempt+1,type(e).__name__,str(e)[:100],flush=True)
   if attempt==2: raise
with ThreadPoolExecutor(max_workers=5) as pool:
 for result in pool.map(fetch,items.items()):pass
print('TOTAL',sum((ROOT/p).stat().st_size for p in items),flush=True)
