import json,os,hashlib
from PIL import Image,ImageDraw
data=json.load(open('docs/qa/cached-menu-image-candidates.json',encoding='utf-8'))
groups={};bad=[]
for record in data['images']:
 try:
  im=Image.open('.'+record['image']);im.verify();im=Image.open('.'+record['image']);record['width'],record['height']=im.size
  if im.format=='GIF':
   record['originalImage']=record['image'];record['originalSha256']=record['sha256'];record['image']=record['image'][:-4]+'-still.png';im.seek(0);im.convert('RGBA').save('.'+record['image'])
   content=open('.'+record['image'],'rb').read();record['sha256']=hashlib.sha256(content).hexdigest();record['bytes']=len(content);record['transformation']='Static first frame of the original source-post GIF; original retained.'
  if min(im.size)<100:continue
  groups.setdefault(record['id'],[]).append(record)
 except Exception as error:bad.append({'id':record['id'],'image':record['image'],'error':str(error)})
selected=[max(records,key=lambda r:r['width']*r['height']) for key,records in sorted(groups.items())]
json.dump({'images':selected,'invalid':bad},open('docs/qa/cached-menu-image-selection.json','w',encoding='utf-8'),ensure_ascii=False,indent=2)
os.makedirs('docs/qa/menu-image-sheets',exist_ok=True)
for start in range(0,len(selected),24):
 sheet=Image.new('RGB',(1440,960),'#171717');draw=ImageDraw.Draw(sheet)
 for i,record in enumerate(selected[start:start+24]):
  x=(i%4)*360;y=(i//4)*160;im=Image.open('.'+record['image']).convert('RGB');im.thumbnail((352,126));sheet.paste(im,(x+(352-im.width)//2,y))
  draw.text((x+4,y+127),str(start+i)+' '+record['id'].replace('discord-','')[:51],fill='white');draw.text((x+4,y+142),record['name'][:50],fill='white')
 sheet.save(f'docs/qa/menu-image-sheets/sheet-{start//24:02}.jpg')
print({'selected':len(selected),'invalid':len(bad),'sheets':(len(selected)+23)//24})
