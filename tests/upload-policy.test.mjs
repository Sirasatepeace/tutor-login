import test from 'node:test';
import assert from 'node:assert/strict';
import {UPLOAD_CHUNK_BYTES,MAX_VIDEO_BYTES,MAX_PDF_BYTES,uploadSizeAllowed} from '../lib/upload-policy.mjs';
test('video accepts 25 GiB including the boundary, rejects oversized and invalid sizes',()=>{
 for(const n of [2*1024**3+1,25_000_000_000,MAX_VIDEO_BYTES])assert.equal(uploadSizeAllowed('video',n),true);
 for(const n of [MAX_VIDEO_BYTES+1,0,-1,NaN,Infinity,1.5])assert.equal(uploadSizeAllowed('video',n),false);
 assert.equal(uploadSizeAllowed('pdf',MAX_PDF_BYTES),true);
 assert.equal(uploadSizeAllowed('pdf',MAX_PDF_BYTES+1),false);
 assert.equal(uploadSizeAllowed('other',100),false);
});
test('25 GiB fits multipart limits with 3200 bounded 8 MiB parts',()=>{
 const count=Math.ceil(MAX_VIDEO_BYTES/UPLOAD_CHUNK_BYTES);
 assert.equal(count,3200);assert.ok(count<=10000);assert.ok(UPLOAD_CHUNK_BYTES>=5*1024**2);
 assert.equal((count-1)*UPLOAD_CHUNK_BYTES+UPLOAD_CHUNK_BYTES,MAX_VIDEO_BYTES);
});
