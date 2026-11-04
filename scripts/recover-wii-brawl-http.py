"""Resume bounded official HTTP ranges; retain every earlier partial/chunk. Never execute downloads."""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import time
import sys
import urllib.request

ROOT=Path(__file__).resolve().parent.parent
STAGE=ROOT/'docs/tmp/wii-brawl-galaxy'
CHUNK=16*1024**2

def main():
    jobs=[j for j in json.loads((ROOT/'docs/wii-brawl-galaxy-jobs.json').read_text(encoding='utf-8'))['jobs'] if j['id'] in ('project-plus','brawl-minus')]
    tasks=[]
    for job in jobs:
        if (STAGE/job['filename']).exists():
            continue
        folder=STAGE/(job['id']+'-http-ranges')
        folder.mkdir(exist_ok=True)
        # A completed prefix from the same official release can seed complete chunks.
        prefixes=sorted(STAGE.glob(('Project+.v3.2.1.Wii.Lite.zip' if job['id']=='project-plus' else job['filename'])+'.partial*'),key=lambda p:p.stat().st_size,reverse=True)
        prefix=prefixes[0] if prefixes else None
        for start in range(0,job['expectedBytes'],CHUNK):
            end=min(start+CHUNK,job['expectedBytes'])-1
            target=folder/f'{start}-{end}.part'
            if target.exists():
                if target.stat().st_size!=end-start+1:
                    raise ValueError('Unexpected existing range length')
                continue
            if prefix and prefix.stat().st_size>=end+1:
                with prefix.open('rb') as src,target.open('xb') as out:
                    src.seek(start);out.write(src.read(end-start+1))
            else:
                tasks.append((job,start,end,target))

    def transfer(task):
        job,start,end,target=task
        source=job.get('originalSourceUrl',job['url'])
        for attempt in range(5):
            partial=target.with_name(target.name+f'.partial-{time.time_ns()}')
            try:
                url=source+('?archive_range=' if '?' not in source else '&archive_range=')+f'{start}-{time.time_ns()}'
                request=urllib.request.Request(url,headers={'Range':f'bytes={start}-{end}','User-Agent':'whatsite-official-archive/1.0'})
                with urllib.request.urlopen(request,timeout=60) as response:
                    if response.status!=206 or response.headers.get('Content-Range')!=f"bytes {start}-{end}/{job['expectedBytes']}":
                        raise ValueError('Wrong HTTP range response')
                    count=0
                    with partial.open('xb') as out:
                        while data:=response.read(1024**2):
                            count+=len(data)
                            if count>end-start+1:
                                raise ValueError('Range exceeds bound')
                            out.write(data)
                if count!=end-start+1:
                    raise ValueError('Incomplete range')
                partial.rename(target)
                print(job['id'],round((end+1)/1024**2),'MiB range saved',flush=True)
                return
            except Exception as error:
                print(job['id'],'range',start,'attempt',attempt+1,type(error).__name__,flush=True)
                if attempt==4:
                    raise
                time.sleep(1)

    workers=int(next((a.split('=',1)[1] for a in sys.argv if a.startswith('--workers=')),'8'))
    if not 1 <= workers <= 16:raise ValueError('Workers must be 1–16')
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        list(pool.map(transfer,tasks))
    results=[]
    for job in jobs:
        final=STAGE/job['filename']
        if not final.exists():
            temporary=final.with_name(final.name+f'.assembled-{time.time_ns()}')
            with temporary.open('xb') as out:
                for start in range(0,job['expectedBytes'],CHUNK):
                    end=min(start+CHUNK,job['expectedBytes'])-1
                    with (STAGE/(job['id']+'-http-ranges')/f'{start}-{end}.part').open('rb') as src:
                        while data:=src.read(1024**2):out.write(data)
            if temporary.stat().st_size!=job['expectedBytes']:
                raise ValueError('Assembled size mismatch')
            temporary.rename(final)
        digest=hashlib.file_digest(final.open('rb'),'sha256').hexdigest()
        results.append({'id':job['id'],'status':'downloaded','filename':job['filename'],'bytes':final.stat().st_size,'sha256':digest,'sourceUrl':job.get('originalSourceUrl',job['url']),'version':job['version'],'stagedFile':str(final)})
        print(job['id'],'complete',digest,flush=True)
    (STAGE/'downloads-brawl-recovery.json').write_text(json.dumps({'results':results},indent=2)+'\n')

if __name__=='__main__':main()
