"""Recover encrypted bytes from the public creator link; decryption/verification is separate."""
import concurrent.futures,json,time,urllib.request
import shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
STAGE=ROOT/'docs/tmp/wii-brawl-galaxy'
metadata=json.loads((STAGE/'neo-transfer.json').read_text())
folder=STAGE/'neo-encrypted-ranges'
folder.mkdir(exist_ok=True)
chunk=4*1024**2
def transfer(start):
    end=min(start+chunk,metadata['bytes'])-1
    target=folder/f'{start}-{end}.part'
    if target.exists() and target.stat().st_size==end-start+1:return
    for attempt in range(3):
        partial=target.with_name(target.name+f'.partial-{time.time_ns()}')
        try:
            previous=sorted(folder.glob(target.name+'.partial-*'),key=lambda p:p.stat().st_size,reverse=True)
            count=previous[0].stat().st_size if previous else 0
            if count>=end-start+1:raise ValueError('Unexpected prior partial size')
            if count:shutil.copyfile(previous[0],partial)
            with urllib.request.urlopen(metadata['g']+f'/{start+count}-{end}',timeout=45) as response,partial.open('ab' if count else 'xb') as out:
                while data:=response.read(1024**2):
                    count+=len(data)
                    if count>end-start+1:raise ValueError('Range exceeds bound')
                    out.write(data)
            if count!=end-start+1:raise ValueError('Incomplete range')
            partial.rename(target)
            print('Neo encrypted range',round((end+1)/1024**2),'MiB saved',flush=True)
            return
        except Exception as error:
            print('Neo range',start,'attempt',attempt+1,str(error),flush=True)
            if attempt==2:raise
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:list(pool.map(transfer,range(0,metadata['bytes'],chunk)))
target=STAGE/'neo-encrypted-complete.bin'
if not target.exists():
    with target.open('xb') as out:
        for start in range(0,metadata['bytes'],chunk):
            end=min(start+chunk,metadata['bytes'])-1
            out.write((folder/f'{start}-{end}.part').read_bytes())
print('Neo encrypted transfer complete',target.stat().st_size,flush=True)
