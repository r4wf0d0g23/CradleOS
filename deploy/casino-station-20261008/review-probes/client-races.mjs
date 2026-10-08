import vm from 'node:vm';import {createHash} from 'node:crypto';import fs from 'node:fs';import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../../../services/casino-station/client.html',import.meta.url),'utf8');
const script=source.match(/<script>([\s\S]*?)<\/script>/)[1];
function setup(codec){
 const supports=[],paints=[],draws=[],sockets=[];
 const els={canvas:{getContext:()=>({drawImage:i=>draws.push(i)})},'#join':{},'#leave':{},'#readout':{}};
 const controls=['ArrowLeft','w','ArrowRight','s'].map(key=>({dataset:{key},setPointerCapture(){}}));
 class WS{constructor(url){this.url=url;this.readyState=0;this.closed=false;sockets.push(this);}send(){}close(){this.closed=true;this.readyState=3;this.onclose?.();}}
 const ctx={console,document:{querySelector:k=>els[k],querySelectorAll:()=>controls,addEventListener(){},hidden:false},location:{origin:'http://127.0.0.1:5318',search:''},WebSocket:WS,setInterval(){},setTimeout,clearTimeout,Blob,Uint8Array,DataView,createImageBitmap:()=>new Promise(resolve=>paints.push(resolve)),addEventListener(){}};
 if(codec)ctx.VideoDecoder=class {static isConfigSupported(){return new Promise(resolve=>supports.push(resolve));}};
 ctx.window=ctx;vm.createContext(ctx);vm.runInContext(script,ctx);return {ctx,els,controls,supports,paints,draws,sockets};
}
const a=setup(true),one=a.els['#join'].onclick(),two=a.els['#join'].onclick();
assert.equal(a.supports.length,2);for(const r of a.supports)r({supported:true});await Promise.all([one,two]);
const join={created:a.sockets.length,firstClosed:a.sockets[0].closed};assert.equal(join.created,2);assert.equal(join.firstClosed,false);
const b=setup(false);await b.els['#join'].onclick();const s=b.sockets[0];s.readyState=1;s.onmessage({data:new ArrayBuffer(4)});assert.equal(b.paints.length,1);b.els['#leave'].onclick();b.paints[0]({close(){}});await new Promise(resolve=>setImmediate(resolve));
const stale={socketClosed:s.closed,drawsAfterClose:b.draws.length};assert.equal(stale.drawsAfterClose,1);
console.log(JSON.stringify({sourceSHA256:createHash('sha256').update(source).digest('hex'),probeType:'isolated source VM, not browser',rapidJoin:join,staleJpeg:stale},null,2));
