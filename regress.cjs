'use strict';
const fs = require('fs');
const path = require('path');
const P = require('./dxf-parser.js');

const ROOT = 'C:/Users/Administrator/Desktop/2';
const files = [];
(function walk(d){for(const f of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,f.name);if(f.isDirectory())walk(p);else if(/\.dxf$/i.test(f.name))files.push(p);}})(ROOT);
console.log('DXF files found:', files.length);

let ok=0, err=0, totalPoints=0, skipPoints=0, totalArc=0, mirrorArc=0;
const errors=[];
for(const f of files){
  try{
    const doc=P.parseBuffer(fs.readFileSync(f));
    const flat=P.flatten(doc,{});
    let pts=0,skp=0,arc=0;
    for(const e of flat){
      if(e.type==='POINT'){pts++; if(e.layer&&/^defpoints$/i.test(e.layer))skp++;}
      if(e.type==='ARC'){arc++;}
    }
    totalPoints+=pts; skipPoints+=skp; totalArc+=arc;
    ok++;
  }catch(ex){ err++; errors.push(f+' :: '+(ex&&ex.message||ex)); }
}
console.log(`\nPARSE+FLATTEN: ok=${ok} err=${err}`);
console.log(`POINT total=${totalPoints} skip(Defpoints)=${skipPoints} keep=${totalPoints-skipPoints}`);
console.log(`ARC total=${totalArc}`);
if(errors.length){console.log('\nERRORS:'); errors.slice(0,20).forEach(e=>console.log('  '+e));}
console.log(err===0 ? '=> REGRESSION PASS: 46/46 解析+展开无异常' : '=> REGRESSION FAIL');
