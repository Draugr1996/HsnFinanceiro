/* Cobranças Sicoob: conferência humana obrigatória. Sem credenciais Zoho no navegador. */
window.HSN_SICOOB=(()=>{'use strict';
let items=[], contacts=[], ready=false, busy=false, selected=new Set();
const $=id=>document.getElementById(id), node=(tag,txt,cls)=>{const e=document.createElement(tag);if(txt!==undefined)e.textContent=txt;if(cls)e.className=cls;return e;};
const button=(txt,fn)=>{const b=node('button',txt,'secondary');b.type='button';b.onclick=fn;return b;};
const fmt=n=>Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const iso=s=>{s=String(s||'').trim();if(/^\d{2}\/\d{2}\/\d{4}$/.test(s)){const [d,m,y]=s.split('/');return `${y}-${m}-${d}`;}return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:'';};
const money=s=>Number(String(s||'0').replace(/[^\d,.-]/g,'').replace(/\.(?=\d{3}(\D|$))/g,'').replace(',','.'));
function csv(text){const rows=[];let row=[],field='',quote=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quote&&text[i+1]==='"'){field+='"';i++;}else quote=!quote;}else if(c===','&&!quote){row.push(field);field='';}else if((c==='\n'||c==='\r')&&!quote){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(x=>x.trim()))rows.push(row);row=[];field='';}else field+=c;}row.push(field);if(row.some(x=>x.trim()))rows.push(row);return rows;}
const clean=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
function parse(rows){
 const parsed=[];let cols=null;
 for(const r of rows){
  const heads=r.map(clean);
  if(heads.some(v=>v==='sacado')&&heads.some(v=>v.includes('vencimento'))){
   const ix=s=>heads.findIndex(v=>v.includes(s));
   cols={name:ix('sacado'),our:ix('nosso numero'),your:ix('seu numero'),due:ix('vencimento'),amount:ix('valor')};
   if(Object.values(cols).some(v=>v<0))throw Error('Cabeçalho incompleto.');
   continue;
  }
  if(!cols)continue;
  const company=String(r[cols.name]||'').trim(),reference=String(r[cols.our]||'').trim(),date=iso(r[cols.due]),value=money(r[cols.amount]);
  if(!company||!reference||!date||!Number.isFinite(value)||value<=0)continue;
  parsed.push({company,reference,external_reference:String(r[cols.your]||'').trim(),due_date:date,amount:value});
 }
 if(!cols)throw Error('Cabeçalho Sicoob não encontrado.');
 return [...new Map(parsed.map(x=>[x.reference+'|'+x.due_date,x])).values()];
}
function check(x){if(x.error)throw x.error;return x.data;}
async function fetchData(){const [a,b]=await Promise.all([db.from('sicoob_collections').select('*').order('due_date',{ascending:true}),db.from('sicoob_contacts').select('*')]);items=check(a)||[];contacts=check(b)||[];ready=true;}
async function load(){if(!user)return;try{await fetchData();render();}catch(e){ready=false;render();$('records').prepend(node('p','Não foi possível carregar as cobranças. Verifique as tabelas do Supabase. '+e.message,'hint'));}}
function contact(company){return contacts.find(c=>clean(c.company)===clean(company));}
function message(r){return `Prezados, bom dia!\n\nIdentificamos em nosso controle financeiro uma pendência referente ao boleto abaixo:\n\nEmpresa: ${r.company}\nBoleto: ${r.reference}\nVencimento: ${r.due_date.split('-').reverse().join('/')}\nValor original: ${fmt(r.amount)}\n\nSolicitamos, por gentileza, a verificação da pendência e, caso o pagamento já tenha sido realizado, o envio do respectivo comprovante para atualização de nossos registros.\n\nPermanecemos à disposição para quaisquer esclarecimentos.\n\nAtenciosamente,\nVanderson Santos\nSupervisor Administrativo Financeiro\nHotel Serra Negra\nfaturamento@hotelserranegra.com.br`;}
const eligible=r=>r.status==='pending'&&!!contact(r.company)?.email&&r.due_date<new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
async function saveContact(company,email){if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('E-mail inválido.');check(await db.from('sicoob_contacts').upsert({owner_id:user.id,company,email},{onConflict:'owner_id,company'}));await fetchData();render();}
async function importCsv(file){if(!file)return;try{const text=await file.text();const parsed=parse(csv(text.replace(/^\uFEFF/,'')));if(!parsed.length)throw Error('Nenhum boleto reconhecido.');const ok=confirm(`Foram encontrados ${parsed.length} títulos, totalizando ${fmt(parsed.reduce((s,r)=>s+r.amount,0))}.\n\nImportar e atualizar títulos existentes? Os status atuais serão preservados.`);if(!ok)return;const existing=new Set(items.map(x=>x.reference+'|'+x.due_date));const fresh=parsed.filter(x=>!existing.has(x.reference+'|'+x.due_date));if(fresh.length)check(await db.from('sicoob_collections').upsert(fresh.map(x=>({...x,owner_id:user.id,status:'pending'})),{onConflict:'owner_id,reference,due_date'}));await fetchData();render();alert(`${fresh.length} títulos novos importados. ${parsed.length-fresh.length} já estavam cadastrados e foram preservados.`);}catch(e){alert('Falha na importação: '+e.message);}}
async function setStatus(r,status){if(!confirm(`Alterar ${r.company} / ${r.reference} para ${status==='paid'?'pago':'pendente'}? Confira a situação no Sicoob.`))return;try{check(await db.from('sicoob_collections').update({status}).eq('id',r.id));await fetchData();render();}catch(e){alert(e.message);}}
async function sendBatch(){alert('Envio bloqueado nesta versão: falta instalar e validar a função segura de envio de cobranças no Supabase. Os boletos e destinatários podem ser preparados e revisados sem disparar e-mails.');}
function render(){
 if(view!=='sicoob_collections')return;
 $('view-title').textContent='Cobranças Sicoob';
 $('view-description').textContent='Importe, confira e prepare cada cobrança individualmente.';
 document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view==='sicoob_collections'));
 $('new').hidden=true;
 for(const id of ['finance-controls','calendar-board','commission-calendar-summary','summary','records'])$(id).replaceChildren();
 const box=$('records');box.classList.add('sicoob-workspace');
 $('summary').classList.add('sicoob-summary');
 if(!ready){box.append(node('p','Preparando a central de cobranças…'));return;}
 const pending=items.filter(r=>r.status==='pending');
 const stat=(label,value,detail)=>{const el=node('article',undefined,'sicoob-stat');el.append(node('span',label,'sicoob-stat-label'),node('strong',value,'sicoob-stat-value'),node('small',detail,'sicoob-stat-detail'));return el;};
 $('summary').append(
  stat('Títulos pendentes',String(pending.length),'Aguardando conferência'),
  stat('Valor pendente',fmt(pending.reduce((s,r)=>s+Number(r.amount),0)),'Valor original dos títulos'),
  stat('Empresas',String(new Set(pending.map(r=>clean(r.company))).size),'Sacados com pendências'),
  stat('E-mails cadastrados',String(pending.filter(r=>!!contact(r.company)?.email).length),'Títulos com destinatário')
 );
 const panel=node('section',undefined,'sicoob-panel');
 const bar=node('div',undefined,'sicoob-actions');
 const importLabel=node('label',undefined,'sicoob-import');
 importLabel.append(node('span','Importar relatório CSV'));
 const input=node('input');input.type='file';input.accept='.csv,text/csv';
 input.onchange=()=>{const file=input.files?.[0];importCsv(file);input.value='';};
 importLabel.append(input);bar.append(importLabel);
 bar.append(button('Selecionar elegíveis',()=>{items.filter(eligible).forEach(r=>selected.add(r.id));render();}),button('Limpar seleção',()=>{selected.clear();render();}));
 const send=button(`Enviar selecionados (${[...selected].filter(id=>items.some(r=>r.id===id&&eligible(r))).length})`,sendBatch);
 send.disabled=true;send.title='Envio desativado até validação da função segura no Supabase';bar.append(send);
 panel.append(bar);
 panel.append(node('p','O envio de e-mails permanece desativado. Antes de cobrar, confirme no Sicoob se o boleto continua em aberto.','sicoob-notice'));
 const count=node('div',undefined,'sicoob-table-heading');
 count.append(node('h2','Boletos importados'),node('span',`${items.length} título(s) · ${selected.size} selecionado(s)`));panel.append(count);
 const table=node('table',undefined,'sicoob-table'),thead=node('thead'),head=node('tr');
 ['Selecionar','Sacado / empresa','Nosso número','Vencimento','Valor','E-mail do destinatário','Situação','Ações'].forEach(t=>head.append(node('th',t)));
 thead.append(head);table.append(thead);const body=node('tbody');
 const term=clean($('search').value);
 const visible=items.filter(x=>clean(x.company+' '+x.reference).includes(term));
 for(const r of visible){
  const tr=node('tr'),td=(label)=>{const el=node('td');el.dataset.label=label;return el;};
  let cell=td('Selecionar'),cb=node('input');cb.type='checkbox';cb.setAttribute('aria-label',`Selecionar boleto ${r.reference}`);
  cb.checked=selected.has(r.id);cb.disabled=!eligible(r);
  cb.onchange=()=>{if(cb.checked)selected.add(r.id);else selected.delete(r.id);render();};cell.append(cb);tr.append(cell);
  const vals=[['Sacado / empresa',r.company],['Nosso número',r.reference],['Vencimento',r.due_date.split('-').reverse().join('/')],['Valor',fmt(r.amount)]];
  for(const [label,value] of vals){cell=td(label);cell.textContent=value;if(label==='Valor')cell.classList.add('sicoob-money');tr.append(cell);}
  cell=td('E-mail do destinatário');const group=node('div',undefined,'sicoob-email-group');
  const email=node('input');email.type='email';email.placeholder='email@empresa.com';email.value=contact(r.company)?.email||'';
  email.setAttribute('aria-label',`E-mail de ${r.company}`);
  const save=button('Salvar',async()=>{try{await saveContact(r.company,email.value.trim());}catch(e){alert(e.message);}});
  group.append(email,save);cell.append(group);tr.append(cell);
  cell=td('Situação');cell.append(node('span',r.status==='paid'?'Pago':r.status==='sent'?'Cobrado':'Pendente',`sicoob-status sicoob-${r.status}`));tr.append(cell);
  cell=td('Ações');const actions=node('div',undefined,'sicoob-row-actions');
  actions.append(button('Ver mensagem',()=>alert(`Assunto: Hotel Serra Negra | Aviso de pendência financeira – Boleto nº ${r.reference}\n\n${message(r)}`)),button(r.status==='paid'?'Reabrir':'Marcar pago',()=>setStatus(r,r.status==='paid'?'pending':'paid')));
  cell.append(actions);tr.append(cell);body.append(tr);
 }
 table.append(body);const wrap=node('div',undefined,'sicoob-table-wrap');
 if(!visible.length)wrap.append(node('p','Nenhum boleto encontrado para a pesquisa.','sicoob-empty'));
 else wrap.append(table);
 panel.append(wrap);box.append(panel);
}

return {load,render,parseCsv:parse};})();
