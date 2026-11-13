'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),net=require('node:net'),path=require('node:path');
const {Client}=require('../vendor/basic-ftp/dist/index.js');
const core=require('../console-files-core.cjs');
const {Readable}=require('node:stream');
test('real FTP library performs passive upload, list, verified config backup and rename',async t=>{
  const files=new Map([['/data/GoldHEN/plugins.ini',Buffer.from('; original\n')]]),sockets=new Set(),dataServers=new Set();
  const server=net.createServer(socket=>{
    sockets.add(socket);socket.on('close',()=>sockets.delete(socket));socket.setEncoding('utf8');socket.write('220 Test FTP\r\n');
    let buffer='',dataSocket,passive,renameFrom,cwd='/';
    const reply=(code,message)=>socket.write(code+' '+message+'\r\n');
    function transfer(command,arg){reply(150,'Opening data connection');const data=dataSocket;if(!data)return reply(425,'No data connection');
      if(command==='STOR'){const chunks=[];data.on('data',b=>chunks.push(b));data.on('end',()=>{files.set(arg,Buffer.concat(chunks));data.end();reply(226,'Stored');});}
      else {let bytes;if(command==='RETR')bytes=files.get(arg);else bytes=Buffer.from([...files].filter(([name])=>path.posix.dirname(name)===(arg||cwd)).map(([name,b])=>'type=file;size='+b.length+';modify=20260101000000; '+path.posix.basename(name)+'\r\n').join(''));data.end(bytes||Buffer.alloc(0),()=>reply(226,'Complete'));}
      passive.close();dataServers.delete(passive);
    }
    socket.on('data',chunk=>{buffer+=chunk;let at;while((at=buffer.indexOf('\r\n'))>=0){const line=buffer.slice(0,at);buffer=buffer.slice(at+2);const space=line.indexOf(' '),cmd=space<0?line:line.slice(0,space),arg=space<0?'':line.slice(space+1);
      if(cmd==='USER')reply(331,'Password');else if(cmd==='PASS')reply(230,'Welcome');else if(cmd==='FEAT')socket.write('211-Features\r\n MLST type*;size*;modify*;\r\n UTF8\r\n211 End\r\n');else if(['TYPE','OPTS','STRU'].includes(cmd))reply(200,'OK');else if(cmd==='PWD')reply(257,'"'+cwd+'"');else if(cmd==='CWD'){cwd=arg;reply(250,'Changed');}else if(cmd==='EPSV'){passive=net.createServer(s=>{dataSocket=s;sockets.add(s);s.on('close',()=>sockets.delete(s));});dataServers.add(passive);passive.listen(0,'127.0.0.1',()=>reply(229,'Entering Extended Passive Mode (|||'+passive.address().port+'|)'));}
      else if(['MLSD','RETR','STOR'].includes(cmd))transfer(cmd,arg);else if(cmd==='SIZE')files.has(arg)?reply(213,files.get(arg).length):reply(550,'Missing');else if(cmd==='RNFR'){renameFrom=arg;reply(350,'Rename target');}else if(cmd==='RNTO'){files.set(arg,files.get(renameFrom));files.delete(renameFrom);reply(250,'Renamed');}else if(cmd==='DELE'){files.delete(arg);reply(250,'Deleted');}else if(cmd==='QUIT')socket.end('221 Bye\r\n');else reply(502,'Unsupported '+cmd);
    }});
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>{for(const s of sockets)s.destroy();for(const s of dataServers)s.close();server.close();});
  const client=new Client(3000);t.after(()=>client.close());await client.access({host:'127.0.0.1',port:server.address().port,user:'anonymous',password:''});
  await core.upload(client,Readable.from('inert module fixture'),'/data/GoldHEN/plugins/sample.sprx',20);
  assert.equal(files.get('/data/GoldHEN/plugins/sample.sprx').toString(),'inert module fixture');
  const original=await core.readIni(client),saved=await core.saveIni(client,'; original\n[CUSA00001]\n; /data/GoldHEN/plugins/sample.sprx\n',original.sha256);
  assert.equal(files.get(saved.backup).toString(),'; original\n');assert.ok(files.get(core.INI).toString().includes('[CUSA00001]'));
  await client.rename('/data/GoldHEN/plugins/sample.sprx','/data/GoldHEN/plugins/moved.sprx');
  assert.ok(files.has('/data/GoldHEN/plugins/moved.sprx'));assert.equal((await client.list('/data/GoldHEN/plugins')).length,1);
});
