const TODAY = new Date('2026-06-30T12:00:00');
const initialRequests = [
  {id:1,vendor:'Northstar Logistics',invoice:'NL-4821',amount:24800,requested:'2026-05-28',lastBalance:'2026-06-19',status:'Needs review',owner:'Jordan Davis',color:'#e6efe9',ink:'#346552',notes:'June freight and warehousing services.',events:[['Balance confirmation sent','Jun 19, 2026'],['Follow-up received from vendor','Jun 12, 2026'],['Request received by email','May 28, 2026']]},
  {id:2,vendor:'Meridian Office Co.',invoice:'MO-1098',amount:7250,requested:'2026-06-08',lastBalance:'2026-06-16',status:'Awaiting approval',owner:'Jordan Davis',color:'#eeeafa',ink:'#6557a0',notes:'Quarterly office supply invoice.',events:[['Sent to Maria for approval','Jun 17, 2026'],['Balance confirmation sent','Jun 16, 2026'],['Request received by email','Jun 8, 2026']]},
  {id:3,vendor:'Copper & Pine Studio',invoice:'CP-7740',amount:12450,requested:'2026-06-15',lastBalance:'2026-06-23',status:'Scheduled',owner:'Alex Kim',color:'#faeadf',ink:'#9a603d',notes:'Brand campaign production balance.',events:[['Payment scheduled for Jul 2','Jun 25, 2026'],['Balance confirmation sent','Jun 23, 2026'],['Request received by email','Jun 15, 2026']]},
  {id:4,vendor:'Vertex Cloud Systems',invoice:'VC-3204',amount:18900,requested:'2026-06-18',lastBalance:'2026-06-24',status:'Awaiting approval',owner:'Alex Kim',color:'#e5eff8',ink:'#396c9b',notes:'Annual hosting renewal.',events:[['Sent to Jordan for approval','Jun 25, 2026'],['Balance confirmation sent','Jun 24, 2026'],['Request received by email','Jun 18, 2026']]},
  {id:5,vendor:'Brightline Media',invoice:'BM-5519',amount:5600,requested:'2026-06-22',lastBalance:null,status:'Needs review',owner:'Jordan Davis',color:'#f6e8eb',ink:'#9c5362',notes:'Paid social campaign invoice.',events:[['Request received by email','Jun 22, 2026']]},
  {id:6,vendor:'Atlas Facility Group',invoice:'AF-8827',amount:34200,requested:'2026-06-26',lastBalance:'2026-06-27',status:'Scheduled',owner:'Maria Lopez',color:'#e9eee7',ink:'#5b7054',notes:'Building maintenance and repair.',events:[['Payment scheduled for Jul 5','Jun 28, 2026'],['Balance confirmation sent','Jun 27, 2026'],['Request received by email','Jun 26, 2026']]},
  {id:7,vendor:'Harbor Legal Partners',invoice:'HL-2031',amount:9850,requested:'2026-06-04',lastBalance:'2026-06-10',status:'Paid',owner:'Maria Lopez',color:'#e9f2ef',ink:'#376c5a',notes:'May legal services.',events:[['Payment completed','Jun 20, 2026'],['Balance confirmation sent','Jun 10, 2026'],['Request received by email','Jun 4, 2026']]}
];
let requests = JSON.parse(localStorage.getItem('ledgerly_requests') || 'null') || initialRequests;
const $ = (s) => document.querySelector(s);
const money = (n) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);
const date = (d) => d ? new Date(d+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : 'Not sent';
const age = (d) => Math.max(0,Math.floor((TODAY-new Date(d+'T12:00:00'))/86400000));
const initials = (n) => n.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase();
const slug = (s) => s.toLowerCase().replaceAll(' ','-');
function save(){localStorage.setItem('ledgerly_requests',JSON.stringify(requests));}
function metrics(){
  const open=requests.filter(r=>r.status!=='Paid'), paid=requests.filter(r=>r.status==='Paid');
  const attention=open.filter(r=>age(r.requested)>14 || (!r.lastBalance && age(r.requested)>5));
  $('#openCount').textContent=open.length; $('#vendorCount').textContent=new Set(open.map(r=>r.vendor)).size;
  $('#navCount').textContent=open.length; $('#outstandingTotal').textContent=money(open.reduce((a,r)=>a+r.amount,0));
  $('#averageAge').textContent=Math.round(open.reduce((a,r)=>a+age(r.requested),0)/Math.max(open.length,1));
  $('#overduePill').textContent=`${attention.length} overdue`; $('#needsCount').textContent=attention.length;
  $('#paidTotal').textContent=money(paid.reduce((a,r)=>a+r.amount,0)); $('#paidCount').textContent=paid.length;
}
function render(){
  const q=$('#searchInput').value.toLowerCase(), status=$('#statusFilter').value, minAge=$('#ageFilter').value;
  const filtered=requests.filter(r=>(r.vendor.toLowerCase().includes(q)||r.invoice.toLowerCase().includes(q))&&(status==='all'||r.status===status)&&(minAge==='all'||age(r.requested)>=Number(minAge)));
  $('#requestRows').innerHTML=filtered.map(r=>`<tr data-id="${r.id}"><td><div class="vendor-cell"><div class="vendor-logo" style="background:${r.color};color:${r.ink}">${initials(r.vendor)}</div><div><strong>${r.vendor}</strong><span>${r.invoice}</span></div></div></td><td class="amount">${money(r.amount)}</td><td>${date(r.requested)}<span class="days">${age(r.requested)} days ago</span></td><td>${r.lastBalance?date(r.lastBalance):'<span class="subtext">Not sent yet</span>'}</td><td><span class="status ${slug(r.status)}">${r.status}</span></td><td><span class="owner"><span class="owner-avatar">${initials(r.owner)}</span>${r.owner.split(' ')[0]}</span></td><td><button class="row-menu">•••</button></td></tr>`).join('');
  $('#emptyState').hidden=filtered.length>0; $('#resultCount').textContent=`Showing ${filtered.length} of ${requests.length} requests`;
  document.querySelectorAll('#requestRows tr').forEach(row=>row.addEventListener('click',()=>openDrawer(Number(row.dataset.id))));
  metrics();
}
function openDrawer(id){
  const r=requests.find(x=>x.id===id); if(!r)return;
  $('#drawerContent').innerHTML=`<div class="drawer-vendor"><div class="vendor-logo" style="background:${r.color};color:${r.ink}">${initials(r.vendor)}</div><div><h2>${r.vendor}</h2><p>Invoice ${r.invoice}</p></div></div><div class="drawer-amount">${money(r.amount)}</div><span class="drawer-label">Requested balance</span><div style="margin-top:14px"><span class="status ${slug(r.status)}">${r.status}</span></div><div class="detail-grid"><div class="detail-box"><span>Requested</span><strong>${date(r.requested)}</strong></div><div class="detail-box"><span>Request age</span><strong>${age(r.requested)} days</strong></div><div class="detail-box"><span>Last balance sent</span><strong>${date(r.lastBalance)}</strong></div><div class="detail-box"><span>Owner</span><strong>${r.owner}</strong></div></div><div class="timeline"><h3>Activity</h3>${r.events.map(e=>`<div class="event"><strong>${e[0]}</strong><p>${e[1]}</p></div>`).join('')}</div><div class="drawer-actions"><button class="secondary-button" onclick="markBalance(${r.id})">Mark balance sent</button><button class="primary-button" onclick="advanceStatus(${r.id})">Advance status</button></div>`;
  $('#drawerOverlay').hidden=false; $('#requestDrawer').classList.add('open'); $('#requestDrawer').setAttribute('aria-hidden','false');
}
function closeDrawer(){ $('#requestDrawer').classList.remove('open'); $('#requestDrawer').setAttribute('aria-hidden','true'); setTimeout(()=>$('#drawerOverlay').hidden=true,240); }
window.markBalance=(id)=>{const r=requests.find(x=>x.id===id);r.lastBalance='2026-06-30';r.events.unshift(['Balance confirmation sent','Jun 30, 2026']);save();render();openDrawer(id);toast('Balance sent date updated');};
window.advanceStatus=(id)=>{const r=requests.find(x=>x.id===id), flow=['Needs review','Awaiting approval','Scheduled','Paid'];r.status=flow[Math.min(flow.indexOf(r.status)+1,3)];r.events.unshift([`Status changed to ${r.status}`,'Jun 30, 2026']);save();render();openDrawer(id);toast(`Moved to ${r.status}`);};
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200);}
function openModal(){ $('#modalBackdrop').hidden=false; $('#requestForm [name=requested]').value='2026-06-30'; setTimeout(()=>$('#requestForm [name=vendor]').focus(),0); }
function closeModal(){ $('#modalBackdrop').hidden=true; $('#requestForm').reset(); }
$('#todayText').textContent=TODAY.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'});
$('#searchInput').addEventListener('input',render); $('#statusFilter').addEventListener('change',render); $('#ageFilter').addEventListener('change',render);
$('#reviewBtn').addEventListener('click',()=>{$('#ageFilter').value='14';render();$('#requests').scrollIntoView({behavior:'smooth'});});
$('#newRequestBtn').addEventListener('click',openModal); $('#modalClose').addEventListener('click',closeModal); $('#cancelBtn').addEventListener('click',closeModal);
$('#drawerClose').addEventListener('click',closeDrawer); $('#drawerOverlay').addEventListener('click',closeDrawer);
$('#requestForm').addEventListener('submit',(e)=>{e.preventDefault();const f=new FormData(e.target),vendor=f.get('vendor');requests.unshift({id:Date.now(),vendor,invoice:f.get('invoice'),amount:Number(f.get('amount')),requested:f.get('requested'),lastBalance:null,status:f.get('status'),owner:'Jordan Davis',color:'#e7f1ec',ink:'#356752',notes:f.get('notes'),events:[['Request added manually','Jun 30, 2026']]});save();closeModal();render();toast(`${vendor} request added`);});
$('#exportBtn').addEventListener('click',()=>{const rows=[['Vendor','Invoice','Amount','Requested','Last Balance Sent','Status','Owner'],...requests.map(r=>[r.vendor,r.invoice,r.amount,r.requested,r.lastBalance||'',r.status,r.owner])];const csv=rows.map(x=>x.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='payment-requests.csv';a.click();URL.revokeObjectURL(a.href);toast('Payment requests exported');});
let outlookState={configured:false,connected:false};
async function getOutlookStatus(){
  try{const res=await fetch('/api/outlook/status');if(!res.ok)throw new Error();outlookState=await res.json();updateOutlookCard();return outlookState;}catch{outlookState={configured:false,connected:false,serverMissing:true};updateOutlookCard();return outlookState;}
}
function updateOutlookCard(){
  const card=$('.sync-card'),button=$('#connectEmailBtn');card.classList.toggle('connected',outlookState.connected);
  $('#emailSyncStatus').textContent=outlookState.connected?`Connected as ${outlookState.email||'Outlook user'}`:outlookState.configured?`Ready for ${outlookState.loginHint||'Outlook'}`:`Setup required for ${outlookState.loginHint||'Outlook'}`;
  button.textContent=outlookState.connected?'Sync inbox':'Connect inbox';
}
function openOutlookSetup(){ $('#outlookSetupBackdrop').hidden=false; }
function closeOutlookSetup(){ $('#outlookSetupBackdrop').hidden=true; }
async function syncOutlook(){
  const card=$('.sync-card');card.classList.add('syncing');$('#connectEmailBtn').textContent='Scanning…';
  try{
    const res=await fetch('/api/outlook/scan',{method:'POST'});const data=await res.json();if(!res.ok)throw new Error(data.error||'Inbox scan failed');
    let added=0;for(const email of data.requests){if(requests.some(r=>r.emailId===email.emailId))continue;requests.unshift({...email,id:Date.now()+added,color:'#e7f1ec',ink:'#356752',owner:'Jordan Davis',lastBalance:null,status:'Needs review',events:[['Imported from Outlook',new Date(email.requested+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})]]});added++;}
    save();render();outlookState.connected=true;outlookState.email=data.mailbox;updateOutlookCard();toast(added?`${added} payment request${added===1?'':'s'} imported`:'Inbox is up to date');
  }catch(err){toast(err.message);if(err.message.toLowerCase().includes('connect'))outlookState.connected=false;updateOutlookCard();}finally{card.classList.remove('syncing');}
}
$('#connectEmailBtn').addEventListener('click',async()=>{const state=await getOutlookStatus();if(!state.configured){openOutlookSetup();return;}if(!state.connected){window.location.href='/auth/outlook';return;}syncOutlook();});
$('#outlookSetupClose').addEventListener('click',closeOutlookSetup);$('#outlookSetupBackdrop').addEventListener('click',e=>{if(e.target===e.currentTarget)closeOutlookSetup();});
$('#outlookConfigForm').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.target),payload=Object.fromEntries(f.entries());const button=$('#retryOutlookBtn');button.disabled=true;button.textContent='Saving…';try{const res=await fetch('/api/outlook/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const data=await res.json();if(!res.ok)throw new Error(data.error||'Could not save setup');window.location.href='/auth/outlook';}catch(err){toast(err.message);button.disabled=false;button.textContent='Save & connect';}});
if(new URLSearchParams(window.location.search).get('outlook')==='connected'){history.replaceState({},'',window.location.pathname+window.location.hash);getOutlookStatus().then(syncOutlook);}else getOutlookStatus();
$('#logoutBtn').addEventListener('click',async()=>{await fetch('/api/auth/logout',{method:'POST'});window.location.href='/login.html';});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeDrawer();closeModal();closeOutlookSetup();}});render();
