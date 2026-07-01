const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
loadEnv(path.join(ROOT,'.env'));
const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || (process.env.NODE_ENV === 'production' ? undefined : '127.0.0.1');
const ALLOW_CONFIG_UI = process.env.ALLOW_CONFIG_UI !== 'false';
const LEDGERLY_USERNAME = process.env.LEDGERLY_USERNAME || '';
const LEDGERLY_PASSWORD = process.env.LEDGERLY_PASSWORD || '';
let TENANT = process.env.MICROSOFT_TENANT_ID || 'common';
let CLIENT_ID = process.env.MICROSOFT_CLIENT_ID || '';
let CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET || '';
let REDIRECT_URI = process.env.MICROSOFT_REDIRECT_URI || `http://localhost:${PORT}/auth/outlook/callback`;
let LOGIN_HINT = process.env.OUTLOOK_LOGIN_HINT || 'nlevine@mintpurchasing.com';
const SCOPES = 'openid profile email offline_access User.Read Mail.Read';
const sessions = new Map();
const authStates = new Map();
const loginAttempts = new Map();

function loadEnv(file){
  if(!fs.existsSync(file))return;
  for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)){
    const match=line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);if(!match||match[1].startsWith('#'))continue;
    let value=match[2];if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);
    if(process.env[match[1]]===undefined)process.env[match[1]]=value;
  }
}
function cookies(req){return Object.fromEntries((req.headers.cookie||'').split(';').filter(Boolean).map(v=>{const i=v.indexOf('=');return[decodeURIComponent(v.slice(0,i).trim()),decodeURIComponent(v.slice(i+1))];}));}
function session(req,res){let sid=cookies(req).ledgerly_sid;if(!sid||!sessions.has(sid)){sid=crypto.randomBytes(24).toString('hex');sessions.set(sid,{created:Date.now(),authenticated:false});const secure=process.env.NODE_ENV==='production'?'; Secure':'';res.setHeader('Set-Cookie',`ledgerly_sid=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${secure}`);}return sessions.get(sid);}
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
function redirect(res,url){res.writeHead(302,{Location:url,'Cache-Control':'no-store'});res.end();}
function configured(){return Boolean(CLIENT_ID&&CLIENT_SECRET&&TENANT);}
function randomBase64Url(bytes=32){return crypto.randomBytes(bytes).toString('base64url');}
function mime(file){return({'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.md':'text/markdown; charset=utf-8','.json':'application/json; charset=utf-8'}[path.extname(file)]||'application/octet-stream');}
function readJson(req){return new Promise((resolve,reject)=>{let body='';req.on('data',chunk=>{body+=chunk;if(body.length>20000)reject(new Error('Request is too large'));});req.on('end',()=>{try{resolve(JSON.parse(body||'{}'));}catch{reject(new Error('Invalid request'));}});req.on('error',reject);});}
function safeEqual(a,b){const ah=crypto.createHash('sha256').update(String(a)).digest(),bh=crypto.createHash('sha256').update(String(b)).digest();return crypto.timingSafeEqual(ah,bh);}
function clientKey(req){return String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'unknown').split(',')[0].trim();}
async function tokenRequest(params){
  const response=await fetch(`https://login.microsoftonline.com/${encodeURIComponent(TENANT)}/oauth2/v2.0/token`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(params)});
  const data=await response.json();if(!response.ok)throw new Error(data.error_description||'Microsoft sign-in failed');return data;
}
async function accessToken(s){
  if(s.accessToken&&Date.now()<s.expiresAt-60000)return s.accessToken;if(!s.refreshToken)throw new Error('Please connect Outlook again');
  const token=await tokenRequest({client_id:CLIENT_ID,client_secret:CLIENT_SECRET,grant_type:'refresh_token',refresh_token:s.refreshToken,scope:SCOPES});s.accessToken=token.access_token;s.expiresAt=Date.now()+token.expires_in*1000;if(token.refresh_token)s.refreshToken=token.refresh_token;return s.accessToken;
}
async function graph(s,endpoint){
  const token=await accessToken(s);const response=await fetch(`https://graph.microsoft.com/v1.0${endpoint}`,{headers:{Authorization:`Bearer ${token}`,'Prefer':'outlook.body-content-type="text"'}});const data=await response.json();if(!response.ok)throw new Error(data.error?.message||'Microsoft Graph request failed');return data;
}
function paymentCandidate(message){
  const text=`${message.subject||''} ${message.bodyPreview||''}`.toLowerCase();const positive=['payment request','invoice','balance due','amount due','past due','statement','remittance','payment status','payment due'];const negative=['newsletter','webinar','receipt for your payment','payment received','order confirmation'];return positive.some(k=>text.includes(k))&&!negative.some(k=>text.includes(k));
}
function extractAmount(message){
  const text=`${message.subject||''} ${message.bodyPreview||''}`;const matches=[...text.matchAll(/\$\s?([0-9]{1,3}(?:,[0-9]{3})*(?:\.\d{2})?|[0-9]+(?:\.\d{2})?)/g)].map(m=>Number(m[1].replaceAll(',',''))).filter(Number.isFinite);return matches.length?Math.max(...matches):0;
}
function extractInvoice(message){
  const text=`${message.subject||''} ${message.bodyPreview||''}`;return text.match(/(?:invoice|inv)[\s#:.-]*([a-z0-9-]{3,})/i)?.[1]?.toUpperCase()||`EMAIL-${String(message.id).slice(-6).toUpperCase()}`;
}
async function route(req,res){
  const url=new URL(req.url,`http://${req.headers.host}`);const s=session(req,res);
  if(url.pathname==='/api/auth/status')return json(res,200,{configured:Boolean(LEDGERLY_USERNAME&&LEDGERLY_PASSWORD),authenticated:Boolean(s.authenticated),username:s.authenticated?LEDGERLY_USERNAME:null});
  if(url.pathname==='/api/auth/login'&&req.method==='POST'){
    if(!LEDGERLY_USERNAME||!LEDGERLY_PASSWORD)return json(res,503,{error:'Login has not been configured by the administrator'});
    const key=clientKey(req),now=Date.now(),record=loginAttempts.get(key)||{count:0,since:now};if(now-record.since>15*60*1000){record.count=0;record.since=now;}if(record.count>=5)return json(res,429,{error:'Too many attempts. Try again in 15 minutes'});
    try{const data=await readJson(req),validUser=safeEqual(String(data.username||'').trim().toLowerCase(),LEDGERLY_USERNAME.trim().toLowerCase()),validPassword=safeEqual(data.password||'',LEDGERLY_PASSWORD);if(!validUser||!validPassword){record.count++;loginAttempts.set(key,record);return json(res,401,{error:'Incorrect email or password'});}loginAttempts.delete(key);s.authenticated=true;s.loginAt=now;return json(res,200,{ok:true});}catch(err){return json(res,400,{error:err.message});}
  }
  if(url.pathname==='/api/auth/logout'&&req.method==='POST'){s.authenticated=false;delete s.accessToken;delete s.refreshToken;return json(res,200,{ok:true});}
  const publicFiles=new Set(['/login.html','/login.css','/login.js']);
  if(!s.authenticated&&!publicFiles.has(url.pathname)){
    if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/auth/'))return json(res,401,{error:'Authentication required'});
    return redirect(res,'/login.html');
  }
  if(s.authenticated&&url.pathname==='/login.html')return redirect(res,'/');
  if(url.pathname==='/api/outlook/status')return json(res,200,{configured:configured(),connected:Boolean(s.refreshToken),email:s.email||null,loginHint:LOGIN_HINT,configurable:ALLOW_CONFIG_UI});
  if(url.pathname==='/api/outlook/config'&&req.method==='POST'){
    if(!ALLOW_CONFIG_UI)return json(res,403,{error:'Configure Microsoft credentials in the hosting environment'});
    const allowedOrigins=[`http://localhost:${PORT}`,`http://127.0.0.1:${PORT}`];if(req.headers.origin&&!allowedOrigins.includes(req.headers.origin))return json(res,403,{error:'Invalid request origin'});
    try{
      const data=await readJson(req),guid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;if(!guid.test(data.clientId||'')||!guid.test(data.tenantId||''))return json(res,400,{error:'Client ID and tenant ID must be valid Microsoft IDs'});if(!data.clientSecret||String(data.clientSecret).length<8)return json(res,400,{error:'Enter the client secret Value from Microsoft Entra'});if(!/^\S+@\S+\.\S+$/.test(data.loginHint||''))return json(res,400,{error:'Enter a valid Outlook email address'});
      CLIENT_ID=String(data.clientId).trim();TENANT=String(data.tenantId).trim();CLIENT_SECRET=String(data.clientSecret).trim();LOGIN_HINT=String(data.loginHint).trim();REDIRECT_URI=`http://localhost:${PORT}/auth/outlook/callback`;
      const contents=`MICROSOFT_CLIENT_ID=${CLIENT_ID}\nMICROSOFT_TENANT_ID=${TENANT}\nMICROSOFT_CLIENT_SECRET=${CLIENT_SECRET}\nMICROSOFT_REDIRECT_URI=${REDIRECT_URI}\nOUTLOOK_LOGIN_HINT=${LOGIN_HINT}\nPORT=${PORT}\n`;fs.writeFileSync(path.join(ROOT,'.env'),contents,{encoding:'utf8',mode:0o600});return json(res,200,{configured:true});
    }catch(err){return json(res,400,{error:err.message});}
  }
  if(url.pathname==='/auth/outlook'){
    if(!configured())return redirect(res,'/?outlook=setup');
    const state=randomBase64Url(),verifier=randomBase64Url(48),challenge=crypto.createHash('sha256').update(verifier).digest('base64url');authStates.set(state,{verifier,created:Date.now(),session:s});
    const params=new URLSearchParams({client_id:CLIENT_ID,response_type:'code',redirect_uri:REDIRECT_URI,response_mode:'query',scope:SCOPES,state,code_challenge:challenge,code_challenge_method:'S256',prompt:'select_account',login_hint:LOGIN_HINT});return redirect(res,`https://login.microsoftonline.com/${encodeURIComponent(TENANT)}/oauth2/v2.0/authorize?${params}`);
  }
  if(url.pathname==='/auth/outlook/callback'){
    const state=url.searchParams.get('state'),record=authStates.get(state);authStates.delete(state);if(url.searchParams.get('error')||!record||Date.now()-record.created>600000)return redirect(res,'/?outlook=error');
    try{
      const token=await tokenRequest({client_id:CLIENT_ID,client_secret:CLIENT_SECRET,grant_type:'authorization_code',code:url.searchParams.get('code'),redirect_uri:REDIRECT_URI,scope:SCOPES,code_verifier:record.verifier});s.accessToken=token.access_token;s.refreshToken=token.refresh_token;s.expiresAt=Date.now()+token.expires_in*1000;
      const me=await graph(s,'/me?$select=displayName,mail,userPrincipalName');s.email=me.mail||me.userPrincipalName;s.name=me.displayName;return redirect(res,'/?outlook=connected');
    }catch(err){console.error(err.message);return redirect(res,'/?outlook=error');}
  }
  if(url.pathname==='/api/outlook/scan'&&req.method==='POST'){
    try{
      const cutoff=new Date(Date.now()-90*86400000).toISOString();const query=new URLSearchParams({'$top':'100','$orderby':'receivedDateTime desc','$filter':`receivedDateTime ge ${cutoff}`,'$select':'id,subject,from,receivedDateTime,bodyPreview,internetMessageId,webLink'});const result=await graph(s,`/me/mailFolders/inbox/messages?${query}`);
      const found=result.value.filter(paymentCandidate).map(m=>({emailId:m.internetMessageId||m.id,vendor:m.from?.emailAddress?.name||m.from?.emailAddress?.address||'Unknown vendor',vendorEmail:m.from?.emailAddress?.address||'',invoice:extractInvoice(m),amount:extractAmount(m),requested:m.receivedDateTime.slice(0,10),notes:m.subject||'Imported from Outlook',emailUrl:m.webLink||''}));return json(res,200,{mailbox:s.email,scanned:result.value.length,requests:found});
    }catch(err){return json(res,401,{error:err.message});}
  }
  let file=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1));if(file.startsWith('.')||!['.html','.css','.js'].includes(path.extname(file)))return json(res,404,{error:'Not found'});file=path.resolve(ROOT,file);if(!file.startsWith(path.resolve(ROOT))||!fs.existsSync(file)||fs.statSync(file).isDirectory())return json(res,404,{error:'Not found'});res.writeHead(200,{'Content-Type':mime(file),'Cache-Control':'no-cache'});fs.createReadStream(file).pipe(res);
}
const server=http.createServer((req,res)=>route(req,res).catch(err=>{console.error(err);if(!res.headersSent)json(res,500,{error:'Unexpected server error'});}));
server.listen(PORT,HOST,()=>console.log(`Ledgerly running on port ${PORT}`));
