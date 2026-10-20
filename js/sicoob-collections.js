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
   cols={name:ix('sacado'),our:ix('nosso numero'),your:heads.findIndex(v=>v.includes('numero do documento')||v.includes('numero documento')||v.includes('seu numero')),due:ix('vencimento'),amount:ix('valor')};
   if([cols.name,cols.our,cols.due,cols.amount].some(v=>v<0))throw Error('Cabeçalho incompleto.');
   continue;
  }
  if(!cols)continue;
  const company=String(r[cols.name]||'').trim(),reference=String(r[cols.our]||'').trim(),date=iso(r[cols.due]),value=money(r[cols.amount]);
  if(!company||!reference||!date||!Number.isFinite(value)||value<=0)continue;
  parsed.push({company,reference,external_reference:cols.your>=0?String(r[cols.your]||'').trim():'',due_date:date,amount:value});
 }
 if(!cols)throw Error('Cabeçalho Sicoob não encontrado.');
 return [...new Map(parsed.map(x=>[x.reference+'|'+x.due_date,x])).values()];
}
function check(x){if(x.error)throw x.error;return x.data;}
async function fetchData(){const [a,b]=await Promise.all([db.from('sicoob_collections').select('*').order('due_date',{ascending:true}),db.from('sicoob_contacts').select('*')]);items=check(a)||[];contacts=check(b)||[];ready=true;}
async function load(){if(!user)return;try{await fetchData();render();}catch(e){ready=false;render();$('records').prepend(node('p','Não foi possível carregar as cobranças. Verifique as tabelas do Supabase. '+e.message,'hint'));}}
function contact(company){return contacts.find(c=>clean(c.company)===clean(company));}
const docNumber=r=>String(r.external_reference||'').trim();
const emailsFor=c=>String(c?.email||'').split(/[;,\n]+/).map(x=>x.trim()).filter(Boolean);
const validEmail=x=>/^[^\s@;,]+@[^\s@;,]+\.[^\s@;,]+$/.test(x);
function message(r){return `Prezados, bom dia!\n\nIdentificamos em nosso controle financeiro uma pendência referente ao boleto abaixo:\n\nEmpresa: ${r.company}\nNúmero do Documento: ${docNumber(r)||'[NÃO INFORMADO]'}\nVencimento: ${r.due_date.split('-').reverse().join('/')}\nValor original: ${fmt(r.amount)}\n\nSolicitamos, por gentileza, a verificação da pendência e, caso o pagamento já tenha sido realizado, o envio do respectivo comprovante para atualização de nossos registros.\n\nPermanecemos à disposição para quaisquer esclarecimentos.\n\nAtenciosamente,\nVanderson Santos\nSupervisor Administrativo Financeiro\nHotel Serra Negra\nfaturamento@hotelserranegra.com.br`;}
const eligible=r=>r.status==='pending'&&emailsFor(contact(r.company)).length>0&&!!docNumber(r)&&r.due_date<new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
async function saveContact(company,primary,cc){const all=[primary.trim(),...cc.split(/[;,\n]+/).map(x=>x.trim()).filter(Boolean)];if(!all[0]||all.some(x=>!validEmail(x)))throw Error('Confira os endereços de e-mail em Para e CC.');if(new Set(all.map(x=>x.toLowerCase())).size!==all.length)throw Error('Há e-mails repetidos entre Para e CC.');check(await db.from('sicoob_contacts').upsert({owner_id:user.id,company,email:all.join('; ')},{onConflict:'owner_id,company'}));await fetchData();render();}
async function importCsv(file){if(!file)return;try{const text=await file.text();const parsed=parse(csv(text.replace(/^\uFEFF/,'')));if(!parsed.length)throw Error('Nenhum boleto reconhecido.');const ok=confirm(`Foram encontrados ${parsed.length} títulos, totalizando ${fmt(parsed.reduce((s,r)=>s+r.amount,0))}.\n\nImportar e atualizar títulos existentes? Os status atuais serão preservados.`);if(!ok)return;const existing=new Set(items.map(x=>x.reference+'|'+x.due_date));const fresh=parsed.filter(x=>!existing.has(x.reference+'|'+x.due_date));const updates=parsed.filter(x=>existing.has(x.reference+'|'+x.due_date)&&x.external_reference&&x.external_reference!==items.find(y=>y.reference===x.reference&&y.due_date===x.due_date)?.external_reference);if(updates.length){for(const x of updates){const old=items.find(y=>y.reference===x.reference&&y.due_date===x.due_date);check(await db.from('sicoob_collections').update({external_reference:x.external_reference}).eq('id',old.id));}}if(fresh.length)check(await db.from('sicoob_collections').upsert(fresh.map(x=>({...x,owner_id:user.id,status:'pending'})),{onConflict:'owner_id,reference,due_date'}));await fetchData();render();alert(`${fresh.length} títulos novos importados. ${parsed.length-fresh.length} já cadastrados; ${updates.length} número(s) de documento atualizado(s), sem alterar a situação dos boletos.`);}catch(e){alert('Falha na importação: '+e.message);}}
async function setStatus(r,status){if(!confirm(`Alterar ${r.company} / ${r.reference} para ${status==='paid'?'pago':'pendente'}? Confira a situação no Sicoob.`))return;try{check(await db.from('sicoob_collections').update({status}).eq('id',r.id));await fetchData();render();}catch(e){alert(e.message);}}
async function prepareIndividual(r){
 if(busy)return;
 busy=true;
 try{
  if(!eligible(r)){alert('Este boleto não está elegível. Confira vencimento, situação, Número do Documento e destinatários salvos.');return;}
  // A conferência é feita no servidor; dados locais não autorizam envios.
  const {data,error}=await db.functions.invoke('zoho-send-mail',{
   body:{mode:'preview',collection_id:r.id}
  });
  if(error){
   let detail='';
   try{detail=(await error.context?.json())?.error||'';}catch(_e){}
   throw Error(detail||error.message||'Falha na conferência do Supabase.');
  }
  if(!data?.success||data.mode!=='preview'||data.sending_enabled!==false){
   throw Error(data?.error||'Resposta inesperada. Operação bloqueada.');
  }
  const preview=`EMPRESA: ${data.company}\nDOCUMENTO: ${data.document_number}\nVENCIMENTO: ${String(data.due_date).split('-').reverse().join('/')}\nVALOR: ${fmt(data.amount)}\nPARA: ${data.to}\nCC: ${(data.cc||[]).join('; ')||'(nenhum)'}\n\nASSUNTO: ${data.subject}\n\n${data.content}`;
  if(!confirm('PRIMEIRA CONFERÊNCIA — dados validados pelo Supabase:\n\n'+preview+'\n\nProsseguir para a confirmação final?'))return;
  if(!confirm('SEGUNDA CONFIRMAÇÃO\n\nVocê revisou a pendência no Sicoob e os destinatários?\n\nNENHUM e-mail será enviado. Deseja concluir a conferência?'))return;
  alert('Conferência concluída e validada pelo Supabase. Nenhum e-mail foi enviado e nenhum status foi alterado.');
 }catch(e){alert('Não foi possível concluir a conferência: '+(e?.message||String(e)));}
 finally{busy=false;}
}
async function sendBatch(){alert('Envio em lote bloqueado nesta etapa. Vamos validar primeiro o envio individual.');}
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
  stat('E-mails cadastrados',String(pending.filter(r=>emailsFor(contact(r.company)).length>0).length),'Títulos com destinatário')
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
 panel.append(node('p',"Envio real desativado: use 'Conferir envio individual' para revisar com duas confirmações. Nenhum e-mail será disparado nesta etapa.",'sicoob-notice'));
 const count=node('div',undefined,'sicoob-table-heading');
 count.append(node('h2','Boletos importados'),node('span',`${items.length} título(s) · ${selected.size} selecionado(s)`));panel.append(count);
 const cards=node('div',undefined,'sicoob-cards');
 const term=clean($('search').value);
 const visible=items.filter(x=>clean(x.company+' '+x.reference+' '+(x.external_reference||'')).includes(term));
 for(const r of visible){
  const card=node('article',undefined,'sicoob-card');
  const cb=node('input');cb.type='checkbox';cb.className='sicoob-card-check';cb.setAttribute('aria-label',`Selecionar boleto ${r.reference}`);
  cb.checked=selected.has(r.id);cb.disabled=!eligible(r);
  cb.onchange=()=>{if(cb.checked)selected.add(r.id);else selected.delete(r.id);render();};
  const company=node('div',undefined,'sicoob-card-company');
  company.append(node('strong',r.company),node('span',`Número do Documento: ${docNumber(r)||'Não informado'}`),node('small',`Nosso número (controle interno): ${r.reference}`));
  const identity=node('div',undefined,'sicoob-card-identity');identity.append(cb,company);
  const details=node('div',undefined,'sicoob-card-details');
  const field=(label,value,cls='')=>{const el=node('div',undefined,'sicoob-card-field '+cls);el.append(node('span',label),node('strong',value));return el;};
  details.append(field('Vencimento',r.due_date.split('-').reverse().join('/'),'sicoob-card-due'),field('Valor',fmt(r.amount),'sicoob-card-amount'));
  const status=field('Situação',r.status==='paid'?'Pago':r.status==='sent'?'Cobrado':'Pendente','sicoob-card-state');
  status.classList.add('sicoob-state-'+r.status);details.append(status);
  const emailRow=node('div',undefined,'sicoob-card-email sicoob-email-multi');
  const savedEmails=emailsFor(contact(r.company));
  const toLabel=node('label',undefined,'sicoob-email-field');toLabel.append(node('span','Para · e-mail principal'));
  const email=node('input');email.type='email';email.placeholder='financeiro@empresa.com.br';email.value=savedEmails[0]||'';
  email.setAttribute('aria-label',`E-mail principal de ${r.company}`);toLabel.append(email);
  const ccLabel=node('label',undefined,'sicoob-email-field');ccLabel.append(node('span','CC · e-mails adicionais (separados por ponto e vírgula)'));
  const cc=node('textarea');cc.rows=2;cc.placeholder='contasapagar@empresa.com.br; outro@empresa.com.br';cc.value=savedEmails.slice(1).join('; ');
  cc.setAttribute('aria-label',`E-mails em cópia de ${r.company}`);ccLabel.append(cc);
  const save=button('Salvar destinatários',async()=>{try{await saveContact(r.company,email.value,cc.value);}catch(e){alert(e.message);}});
  emailRow.append(toLabel,ccLabel,save);
  const actions=node('div',undefined,'sicoob-card-actions');
  const preview=button('✉ Ver e-mail',()=>{const recipients=emailsFor(contact(r.company));alert(`Para: ${recipients[0]||'(não cadastrado)'}\nCC: ${recipients.slice(1).join('; ')||'(nenhum)'}\nAssunto: Hotel Serra Negra | Aviso de pendência financeira – Boleto nº ${docNumber(r)||'[NÃO INFORMADO]'}\n\n${message(r)}`);});
  preview.classList.add('sicoob-card-preview');
  const individual=button('Conferir envio individual',()=>prepareIndividual(r));individual.disabled=!eligible(r);individual.title=individual.disabled?'Requer boleto pendente e vencido, Número do Documento e destinatários salvos':'Conferir dados com duas confirmações (sem envio real)';actions.append(individual);
  const change=button(r.status==='paid'?'Reabrir boleto':'Marcar pago',()=>setStatus(r,r.status==='paid'?'pending':'paid'));
  change.classList.add('secondary');actions.append(preview,change);
  if(!docNumber(r))card.append(node('p','Número do Documento ausente: reimporte o CSV com a coluna “Seu Número” ou “Número do Documento” antes de enviar.','sicoob-notice'));
  card.append(identity,details,emailRow,actions);cards.append(card);
 }
 if(!visible.length)cards.append(node('p','Nenhum boleto encontrado para a pesquisa.','sicoob-empty'));
 panel.append(cards);box.append(panel);
}

return {load,render,parseCsv:parse};})();
