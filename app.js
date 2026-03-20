/* ==========================================================================
   BELEZA RARA – Fichas de Anamnese  v3
   ========================================================================== */
'use strict';

let currentProc    = '';
let currentFichaId = null;
let db             = null;

/* ══════════════════════════════════════════════════════════════════════════
   INDEXEDDB
   ══════════════════════════════════════════════════════════════════════════ */
const DB_NAME    = 'belezaRaraDB';
const DB_VERSION = 2;          // bumped: added clientes store
const STORE      = 'fichas';
const STORE_CLI  = 'clientes';

function openDB() {
  return new Promise((resolve, reject) => {
    if (db) { resolve(db); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains(STORE)) {
        const s = d.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        s.createIndex('proc', 'proc', { unique: false });
        s.createIndex('nome', 'nome', { unique: false });
        s.createIndex('data', 'dataRegisto', { unique: false });
      }
      if (!d.objectStoreNames.contains(STORE_CLI)) {
        const c = d.createObjectStore(STORE_CLI, { keyPath: 'id', autoIncrement: true });
        c.createIndex('nome', 'nome', { unique: false });
      }
    };
    req.onsuccess = e => { db = e.target.result; resolve(db); };
    req.onerror   = e => reject(e.target.error);
  });
}

async function dbSave(record) {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = d.transaction(STORE, 'readwrite');
    const req = record.id ? tx.objectStore(STORE).put(record) : tx.objectStore(STORE).add(record);
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}

async function dbGetAll() {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const req = d.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}

async function dbGet(id) {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const req = d.transaction(STORE, 'readonly').objectStore(STORE).get(id);
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}

async function dbDelete(id) {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const req = d.transaction(STORE, 'readwrite').objectStore(STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = e => reject(e.target.error);
  });
}

/* ── Cliente CRUD ── */
async function dbSaveCliente(rec) {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = d.transaction(STORE_CLI, 'readwrite');
    const req = rec.id ? tx.objectStore(STORE_CLI).put(rec) : tx.objectStore(STORE_CLI).add(rec);
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}
async function dbGetAllClientes() {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const req = d.transaction(STORE_CLI, 'readonly').objectStore(STORE_CLI).getAll();
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}
async function dbGetCliente(id) {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const req = d.transaction(STORE_CLI, 'readonly').objectStore(STORE_CLI).get(id);
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}
async function dbDeleteCliente(id) {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const req = d.transaction(STORE_CLI, 'readwrite').objectStore(STORE_CLI).delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = e => reject(e.target.error);
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   NAVEGAÇÃO
   ══════════════════════════════════════════════════════════════════════════ */
const TITLES = {
  pestanas:  'Extensão de Pestanas',
  depilacao: 'Depilação',
  laser:     'Depilação Laser de Diodo',
  manicure:  'Manicure'
};

function openForm(proc) {
  currentProc    = proc;
  currentFichaId = null;
  document.querySelectorAll('.screen').forEach(s => { s.style.display='none'; s.classList.remove('active'); });
  document.getElementById('screen-form').style.display   = 'flex';
  document.querySelectorAll('.form-section').forEach(s => s.style.display = 'none');
  document.getElementById('form-' + proc).style.display = 'block';
  document.getElementById('form-title-bar').textContent  = 'Ficha de Anamnese – ' + TITLES[proc];
  clearFormFields();
  initSignaturePad(proc[0]);         // cliente signature
  initSignaturePad(proc[0] + 'p');   // profissional signature
  window.scrollTo(0, 0);
}

function goBack() {
  document.querySelectorAll('.screen').forEach(s => { s.style.display='none'; s.classList.remove('active'); });
  document.getElementById('screen-form').style.display   = 'none';
  document.getElementById('screen-fichas').style.display = 'none';
  const sel = document.getElementById('screen-select');
  sel.style.display = 'flex'; sel.classList.add('active');
}

function showFichas() {
  document.querySelectorAll('.screen').forEach(s => { s.style.display='none'; s.classList.remove('active'); });
  document.getElementById('screen-fichas').style.display = 'flex';
  renderFichasList();
}

function backFromFichas() {
  document.getElementById('screen-fichas').style.display = 'none';
  const sel2 = document.getElementById('screen-select');
  sel2.style.display = 'flex'; sel2.classList.add('active');
}

/* ══════════════════════════════════════════════════════════════════════════
   LISTA DE FICHAS GUARDADAS
   ══════════════════════════════════════════════════════════════════════════ */
const PROC_LABELS = {
  pestanas:  '👁️ Extensão de Pestanas',
  depilacao: '✨ Depilação',
  laser:     '⚡ Laser de Diodo',
  manicure:  '💅 Manicure'
};

async function renderFichasList() {
  const container = document.getElementById('fichas-list');
  container.innerHTML = '<div class="fichas-loading">A carregar…</div>';
  const all = await dbGetAll();
  if (!all.length) {
    container.innerHTML = '<div class="fichas-empty">Nenhuma ficha guardada ainda.<br>Preencha uma ficha e clique em <strong>Guardar</strong>.</div>';
    return;
  }
  all.sort((a, b) => (b.dataRegisto || '').localeCompare(a.dataRegisto || ''));
  container.innerHTML = all.map(f => `
    <div class="ficha-card">
      <div class="ficha-card-left">
        <div class="ficha-card-nome">${f.nome || '(sem nome)'}</div>
        <div class="ficha-card-meta">
          <span class="ficha-badge">${PROC_LABELS[f.proc] || f.proc}</span>
          <span class="ficha-date">${formatDate(f.dataRegisto) || ''}</span>
        </div>
      </div>
      <div class="ficha-card-actions">
        <button class="btn-ficha-open"  onclick="openFicha(${f.id})">✏️ Abrir</button>
        <button class="btn-ficha-print" onclick="loadAndPrint(${f.id})">🖨️ Imprimir</button>
        <button class="btn-ficha-del"   onclick="deleteFicha(${f.id})">🗑️</button>
      </div>
    </div>`).join('');
}

async function openFicha(id) {
  const ficha = await dbGet(id);
  if (!ficha) return;
  currentFichaId = id;
  currentProc    = ficha.proc;
  document.querySelectorAll('.screen').forEach(s => { s.style.display='none'; s.classList.remove('active'); });
  document.getElementById('screen-form').style.display   = 'flex';
  document.querySelectorAll('.form-section').forEach(s => s.style.display = 'none');
  document.getElementById('form-' + ficha.proc).style.display = 'block';
  document.getElementById('form-title-bar').textContent = 'Ficha de Anamnese – ' + TITLES[ficha.proc];
  clearFormFields();
  populateForm(ficha);
  initSignaturePad(ficha.proc[0]);
  initSignaturePad(ficha.proc[0] + 'p');
  window.scrollTo(0, 0);
}

async function deleteFicha(id) {
  if (!confirm('Eliminar esta ficha permanentemente?')) return;
  await dbDelete(id);
  renderFichasList();
}

async function loadAndPrint(id) {
  const ficha = await dbGet(id);
  if (!ficha) return;
  printFromData(ficha.proc, ficha);
}

/* ══════════════════════════════════════════════════════════════════════════
   UTILITÁRIOS DE FORMULÁRIO
   ══════════════════════════════════════════════════════════════════════════ */
function getRadio(name) {
  const el = document.querySelector(`input[name="${name}"]:checked`);
  return el ? el.value : '';
}

function getCheckboxes(name) {
  return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`))
              .map(el => el.value);
}

function val(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

/* ── Cálculo de idade automático ── */
function calcIdade(nascStr) {
  if (!nascStr) return '';
  const nasc = new Date(nascStr);
  const hoje = new Date();
  if (isNaN(nasc)) return '';
  let anos = hoje.getFullYear() - nasc.getFullYear();
  const anivers = new Date(hoje.getFullYear(), nasc.getMonth(), nasc.getDate());
  if (hoje < anivers) anos--;
  const ultimoAnivers = new Date(hoje.getFullYear() - (hoje < anivers ? 1 : 0), nasc.getMonth(), nasc.getDate());
  const dias = Math.floor((hoje - ultimoAnivers) / (1000 * 60 * 60 * 24));
  return `${anos} anos e ${dias} dias`;
}

function onNascChange(nascInputId, idadeInputId) {
  const el = document.getElementById(idadeInputId);
  if (el) el.value = calcIdade(document.getElementById(nascInputId)?.value || '');
}

/* ══════════════════════════════════════════════════════════════════════════
   COLETA DE DADOS
   ══════════════════════════════════════════════════════════════════════════ */
function collectForm() {
  const now = new Date().toISOString().slice(0, 10);

  if (currentProc === 'pestanas') {
    const ynRows = document.querySelectorAll('#form-pestanas .yn-row');
    const obs = i => ynRows[i]?.querySelector('.yn-obs')?.value.trim() || '';
    return {
      proc: 'pestanas', dataRegisto: now,
      nome: val('p-nome'), nasc: val('p-nasc'), idade: val('p-idade'),
      sexo: val('p-sexo'), tel: val('p-tel'), morada: val('p-morada'),
      email: val('p-email'), doc: val('p-doc'),
      nac: val('p-nac'),
      atendData: val('p-atend-data'), profissional: val('p-profissional'),
      sigProfDataURL: sigGetDataURL('pp'),
      estilo: val('p-estilo'), curv: val('p-curvatura'),
      esp: val('p-espessura'), modelo: val('p-modelo'), data: val('p-data'),
      gest: getRadio('p-gestante'), gestObs: obs(0),
      proc_ol: getRadio('p-proced'),
      aler: getRadio('p-alergia'), alerObs: obs(2),
      glau: getRadio('p-glaucoma'), onco: getRadio('p-onco'), rimel: getRadio('p-rimel'),
      cAler: getRadio('c-alergia'), cOcul: getRadio('c-ocular'),
      cCiru: getRadio('c-cirurgia'), cLent: getRadio('c-lentes'), cIrri: getRadio('c-irritacao'),
      imgAuth: getRadio('p-imagem'),
      sigDataURL: sigGetDataURL('p'),
    };
  }

  if (currentProc === 'depilacao') {
    return {
      proc: 'depilacao', dataRegisto: now,
      nome: val('d-nome'), nasc: val('d-nasc'), idade: val('d-idade'),
      sexo: val('d-sexo'), tel: val('d-tel'), morada: val('d-morada'),
      email: val('d-email'), doc: val('d-doc'),
      nac: val('d-nac'),
      atendData: val('d-atend-data'), profissional: val('d-profissional'),
      sigProfDataURL: sigGetDataURL('dp'),
      // Q1
      fez:         getRadio('d-fez'),
      metodo:      getCheckboxes('d-metodo'),
      metodoOutro: val('d-metodo-outro'),
      // Q2
      alergia:     getRadio('d-alergia'),
      alergiaEsp:  val('d-alergia-esp'),
      // Q3
      area:        val('d-area'),
      // Q4
      medic:       getRadio('d-medic'),
      // Q5
      reacao:      getCheckboxes('d-reacao'),
      reacaoOutro: val('d-reacao-outro'),
      // Q6
      freq:        val('d-freq'),
      // Q7
      obj:         getCheckboxes('d-obj'),
      objOutro:    val('d-obj-outro'),
      // Q8
      gravida:     getRadio('d-gravida'),
      imgAuth:     getRadio('d-imagem'),
      sigDataURL:  sigGetDataURL('d'),
    };
  }

  if (currentProc === 'laser') {
    const sessions = [];
    document.querySelectorAll('#sessions-tbody tr').forEach(tr => {
      const row = Array.from(tr.querySelectorAll('input')).map(i => i.value.trim());
      if (row.some(v => v)) sessions.push(row);
    });
    return {
      proc: 'laser', dataRegisto: now,
      nome: val('l-nome'), nasc: val('l-nasc'), idade: val('l-idade'),
      sexo: val('l-sexo'), tel: val('l-tel'), morada: val('l-morada'),
      email: val('l-email'), doc: val('l-doc'),
      nac: val('l-nac'),
      atendData: val('l-atend-data'), profissional: val('l-profissional'),
      sigProfDataURL: sigGetDataURL('lp'),
      saude: getRadio('l-saude'), pele: getRadio('l-pele'),
      grav: getRadio('l-grav'),   ama: getRadio('l-ama'),
      prot: getRadio('l-prot'),   coag: getRadio('l-coag'),
      neuro: getRadio('l-neuro'), onco: getRadio('l-onco'),
      cola: getRadio('l-cola'),   trat: getRadio('l-trat'),
      tatu: getRadio('l-tatu'),   derm: getRadio('l-derm'),
      aler: getRadio('l-aler'),   horm: getRadio('l-horm'),
      meno: getRadio('l-meno'),   auto: getRadio('l-auto'),
      vari: getRadio('l-vari'),   acne: getRadio('l-acne'),
      cica: getRadio('l-cica'),   epil: getRadio('l-epil'),
      diab: getRadio('l-diab'),   viti: getRadio('l-viti'),
      peel: getRadio('l-peel'),   med: getRadio('l-med'),
      sol: getRadio('l-sol'),     crem: getRadio('l-crem'),
      auto2: getRadio('l-auto2'), sola: getRadio('l-sola'),
      prev: getRadio('l-prev'),
      zonasPrev: val('l-zonas-prev'), ultima: val('l-ultima'),
      foto: getRadio('l-foto'), obs: val('l-obs'),
      dataInicio: val('l-data-inicio'),
      imgAuth: getRadio('l-imagem'),
      sigDataURL: sigGetDataURL('l'),
      sessions,
    };
  }

  if (currentProc === 'manicure') {
    return {
      proc: 'manicure', dataRegisto: now,
      nome: val('m-nome'), nasc: val('m-nasc'), idade: val('m-idade'),
      sexo: val('m-sexo'), tel: val('m-tel'), morada: val('m-morada'),
      email: val('m-email'), doc: val('m-doc'),
      nac: val('m-nac'),
      atendData: val('m-atend-data'), profissional: val('m-profissional'),
      sigProfDataURL: sigGetDataURL('mp'),
      // informações de saúde
      alergia: getRadio('m-alergia'),
      alergiaEsp: val('m-alergia-esp'), alergiaMarca: val('m-alergia-marca'),
      condicao: getRadio('m-condicao'), condicaoEsp: val('m-condicao-esp'),
      gravida: getRadio('m-gravida'),
      // histórico
      histo: getRadio('m-histo'),
      tecnica: getCheckboxes('m-tecnica'), tecnicaOutra: val('m-tecnica-outra'),
      problema: getRadio('m-problema'), problemaEsp: val('m-problema-esp'),
      // adicionais
      manutencao: getRadio('m-manutencao'),
      pergunta: getRadio('m-pergunta'), perguntaEsp: val('m-pergunta-esp'),
      data: val('m-data'),
      imgAuth: getRadio('m-imagem'),
      sigDataURL: sigGetDataURL('m'),
    };
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   POPULAR FORMULÁRIO (ao abrir ficha guardada)
   ══════════════════════════════════════════════════════════════════════════ */
function setRadio(name, value) {
  if (!value) return;
  const el = document.querySelector(`input[name="${name}"][value="${value}"]`);
  if (el) el.checked = true;
}

function setVal(id, v) {
  const el = document.getElementById(id);
  if (el && v !== undefined) el.value = v;
}

function populateForm(d) {
  if (d.proc === 'pestanas') {
    setVal('p-nome', d.nome); setVal('p-nasc', d.nasc);
    document.getElementById('p-idade').value = d.nasc ? calcIdade(d.nasc) : (d.idade || '');
    setVal('p-sexo', d.sexo); setVal('p-tel', d.tel);
    setVal('p-morada', d.morada); setVal('p-email', d.email); setVal('p-doc', d.doc);
    setNac('p', d.nac);
    setVal('p-estilo', d.estilo); setVal('p-curvatura', d.curv);
    setVal('p-espessura', d.esp); setVal('p-modelo', d.modelo); setVal('p-data', d.data);
    document.getElementById('p-atend-data') && (document.getElementById('p-atend-data').value = d.atendData||'');
    document.getElementById('p-profissional') && (document.getElementById('p-profissional').value = d.profissional||'');
    if (d.sigProfDataURL) setTimeout(() => sigSetDataURL('pp', d.sigProfDataURL), 100);
        setRadio('p-gestante', d.gest); setRadio('p-proced', d.proc_ol);
    setRadio('p-alergia', d.aler); setRadio('p-glaucoma', d.glau);
    setRadio('p-onco', d.onco); setRadio('p-rimel', d.rimel);
    setRadio('c-alergia', d.cAler); setRadio('c-ocular', d.cOcul);
    setRadio('c-cirurgia', d.cCiru); setRadio('c-lentes', d.cLent);
    setRadio('c-irritacao', d.cIrri); setRadio('p-imagem', d.imgAuth);
    const ynRows = document.querySelectorAll('#form-pestanas .yn-row');
    if (ynRows[0]) { const o = ynRows[0].querySelector('.yn-obs'); if (o) o.value = d.gestObs || ''; }
    if (ynRows[2]) { const o = ynRows[2].querySelector('.yn-obs'); if (o) o.value = d.alerObs || ''; }
    if (d.sigDataURL) setTimeout(() => sigSetDataURL('p', d.sigDataURL), 100);
  }

  if (d.proc === 'depilacao') {
    setVal('d-nome', d.nome); setVal('d-nasc', d.nasc);
    document.getElementById('d-idade').value = d.nasc ? calcIdade(d.nasc) : (d.idade || '');
    setVal('d-sexo', d.sexo); setVal('d-tel', d.tel);
    setVal('d-morada', d.morada); setVal('d-email', d.email); setVal('d-doc', d.doc);
    setNac('d', d.nac);
    document.getElementById('d-atend-data') && (document.getElementById('d-atend-data').value = d.atendData||'');
    document.getElementById('d-profissional') && (document.getElementById('d-profissional').value = d.profissional||'');
    if (d.sigProfDataURL) setTimeout(() => sigSetDataURL('dp', d.sigProfDataURL), 100);
        // Q1
    setRadio('d-fez', d.fez);
    (d.metodo || []).forEach(v => { const el = document.querySelector(`input[name="d-metodo"][value="${v}"]`); if(el) el.checked=true; });
    setVal('d-metodo-outro', d.metodoOutro);
    // Q2
    setRadio('d-alergia', d.alergia); setVal('d-alergia-esp', d.alergiaEsp);
    // Q3
    setVal('d-area', d.area);
    // Q4
    setRadio('d-medic', d.medic);
    // Q5
    (d.reacao || []).forEach(v => { const el = document.querySelector(`input[name="d-reacao"][value="${v}"]`); if(el) el.checked=true; });
    setVal('d-reacao-outro', d.reacaoOutro);
    // Q6
    setVal('d-freq', d.freq);
    // Q7
    (d.obj || []).forEach(v => { const el = document.querySelector(`input[name="d-obj"][value="${v}"]`); if(el) el.checked=true; });
    setVal('d-obj-outro', d.objOutro);
    // Q8
    setRadio('d-gravida', d.gravida);
    setRadio('d-imagem', d.imgAuth);
    if (d.sigDataURL) setTimeout(() => sigSetDataURL('d', d.sigDataURL), 100);
  }

  if (d.proc === 'laser') {
    setVal('l-nome', d.nome); setVal('l-nasc', d.nasc);
    document.getElementById('l-idade').value = d.nasc ? calcIdade(d.nasc) : (d.idade || '');
    setVal('l-sexo', d.sexo); setVal('l-tel', d.tel);
    setVal('l-morada', d.morada); setVal('l-email', d.email); setVal('l-doc', d.doc);
    setNac('l', d.nac);
    document.getElementById('l-atend-data') && (document.getElementById('l-atend-data').value = d.atendData||'');
    document.getElementById('l-profissional') && (document.getElementById('l-profissional').value = d.profissional||'');
    if (d.sigProfDataURL) setTimeout(() => sigSetDataURL('lp', d.sigProfDataURL), 100);
        setVal('l-zonas-prev', d.zonasPrev); setVal('l-ultima', d.ultima);
    setVal('l-obs', d.obs); setVal('l-data-inicio', d.dataInicio);
    ['saude','pele','grav','ama','prot','coag','neuro','onco','cola','trat','tatu',
     'derm','aler','horm','meno','auto','vari','acne','cica','epil','diab','viti',
     'peel','med','sol','crem','auto2','sola','prev'].forEach(r => setRadio('l-'+r, d[r]));
    setRadio('l-foto', d.foto); setRadio('l-imagem', d.imgAuth);
    const tbody = document.getElementById('sessions-tbody');
    tbody.innerHTML = '';
    (d.sessions || []).forEach((row, i) => addSessionRowWithData(row, i+1));
    if (!d.sessions?.length) addSessionRow();
    if (d.sigDataURL) setTimeout(() => sigSetDataURL('l', d.sigDataURL), 100);
  }

  if (d.proc === 'manicure') {
    setVal('m-nome', d.nome); setVal('m-nasc', d.nasc);
    document.getElementById('m-idade').value = d.nasc ? calcIdade(d.nasc) : (d.idade || '');
    setVal('m-sexo', d.sexo); setVal('m-tel', d.tel);
    setVal('m-morada', d.morada); setVal('m-email', d.email);
    setVal('m-doc', d.doc); setNac('m', d.nac);
    document.getElementById('m-atend-data') && (document.getElementById('m-atend-data').value = d.atendData||'');
    document.getElementById('m-profissional') && (document.getElementById('m-profissional').value = d.profissional||'');
    if (d.sigProfDataURL) setTimeout(() => sigSetDataURL('mp', d.sigProfDataURL), 100);
        setRadio('m-alergia', d.alergia); setVal('m-alergia-esp', d.alergiaEsp);
    setVal('m-alergia-marca', d.alergiaMarca);
    setRadio('m-condicao', d.condicao); setVal('m-condicao-esp', d.condicaoEsp);
    setRadio('m-gravida', d.gravida);
    setRadio('m-histo', d.histo);
    (d.tecnica || []).forEach(v => {
      const el = document.querySelector(`input[name="m-tecnica"][value="${v}"]`);
      if (el) el.checked = true;
    });
    setVal('m-tecnica-outra', d.tecnicaOutra);
    setRadio('m-problema', d.problema); setVal('m-problema-esp', d.problemaEsp);
    setRadio('m-manutencao', d.manutencao);
    setRadio('m-pergunta', d.pergunta); setVal('m-pergunta-esp', d.perguntaEsp);
    setVal('m-data', d.data); setRadio('m-imagem', d.imgAuth);
    if (d.sigDataURL) setTimeout(() => sigSetDataURL('m', d.sigDataURL), 100);
  }
}

function clearFormFields() {
  if (!currentProc) return;
  document.getElementById('form-' + currentProc)
    .querySelectorAll('input, select, textarea')
    .forEach(el => {
      if (el.type === 'radio' || el.type === 'checkbox') el.checked = false;
      else el.value = '';
    });
  const tbody = document.getElementById('sessions-tbody');
  if (tbody) { tbody.innerHTML = ''; addSessionRow(); }
  // Clear signature pads (cliente + profissional)
  const pfx = currentProc[0];
  sigClear(pfx);       if (_sig[pfx])       _sig[pfx].hasStroke = false;
  sigClear(pfx + 'p'); if (_sig[pfx + 'p']) _sig[pfx + 'p'].hasStroke = false;
}

/* ══════════════════════════════════════════════════════════════════════════
   GUARDAR
   ══════════════════════════════════════════════════════════════════════════ */
async function saveFicha() {
  const data = collectForm();
  if (!data) return;
  if (!data.nome) { alert('Por favor preencha pelo menos o nome da cliente.'); return; }
  if (currentFichaId) data.id = currentFichaId;
  const savedId = await dbSave(data);
  currentFichaId = data.id || savedId;
  showToast('✅ Ficha guardada com sucesso!');
}

function showToast(msg) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.className = 'toast show';
  setTimeout(() => t.className = 'toast', 2800);
}

function clearForm() {
  if (!confirm('Limpar todos os dados preenchidos?')) return;
  clearFormFields();
}

/* ══════════════════════════════════════════════════════════════════════════
   TABELA DE SESSÕES (laser)
   ══════════════════════════════════════════════════════════════════════════ */
function sessionRowHTML(num, vals) {
  const v  = vals || [];
  const w  = ['35px','130px','80px','55px','58px','58px','62px','58px','48px','110px'];
  const ph = [num||'','','Zona','III','ms','Hz','J/cm²','min','nº','Resultado'];
  const cells = w.map((width, i) =>
    `<td><input type="${i===1?'date':'text'}" value="${v[i]||''}" placeholder="${ph[i]}" style="width:${width}"></td>`
  ).join('');
  return `<tr>${cells}<td><button class="btn-rm-row" onclick="removeRow(this)">✕</button></td></tr>`;
}

function addSessionRow() {
  const tbody = document.getElementById('sessions-tbody');
  tbody.insertAdjacentHTML('beforeend', sessionRowHTML(tbody.rows.length + 1, null));
}

function addSessionRowWithData(vals, num) {
  document.getElementById('sessions-tbody')
    .insertAdjacentHTML('beforeend', sessionRowHTML(num, vals));
}

function removeRow(btn) { btn.closest('tr').remove(); }

/* ══════════════════════════════════════════════════════════════════════════
   UTILITÁRIOS DE IMPRESSÃO
   ══════════════════════════════════════════════════════════════════════════ */
function formatDate(d) {
  if (!d) return '';
  const p = d.split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d;
}

function normYn(v) {
  return (v || '').toUpperCase()
    .replace(/Ã/g,'A').replace(/Â/g,'A').replace(/À/g,'A').replace(/Á/g,'A')
    .replace(/É/g,'E').replace(/Ê/g,'E').replace(/Í/g,'I')
    .replace(/Ó/g,'O').replace(/Ô/g,'O').replace(/Ú/g,'U').replace(/Ç/g,'C').trim();
}

function ynBox(rawVal, target) {
  const v = normYn(rawVal);
  const t = normYn(target);
  return `<span class="print-box${v===t?' checked':''}"></span>`;
}

function fieldLine(label, value, flex) {
  return `<div style="display:flex;align-items:baseline;gap:4px;flex:${flex||1};min-width:0;border-bottom:1px solid #ccc;padding:3px 0;">
    <span class="print-label">${label}&nbsp;</span>
    <span class="print-value">${value||''}</span>
  </div>`;
}

function makeFields(rows) {
  return rows.map(row =>
    `<div style="display:flex;gap:10px;margin-bottom:3px;">${row.map(([l,v,f])=>fieldLine(l,v,f)).join('')}</div>`
  ).join('');
}

function makeYnTable(pairs) {
  return `<table class="pd-yn-table">${pairs.map(([label, rawVal]) => {
    const simOk = normYn(rawVal)==='SIM';
    const naoOk = normYn(rawVal)==='NAO';
    return `<tr>
      <td class="pd-yn-q">${label}</td>
      <td class="pd-yn-a">
        <span class="print-box${simOk?' checked':''}"></span><span class="print-box-label">SIM</span>
        &nbsp;&nbsp;
        <span class="print-box${naoOk?' checked':''}"></span><span class="print-box-label">NÃO</span>
      </td>
    </tr>`;
  }).join('')}</table>`;
}

function sigRow(blocks, sigDataURL, sigProfDataURL) {
  return `<div class="pd-sign-row">${blocks.map(([desc,v], i) => {
    // i=0 → Assinatura da Cliente; i=1 with profDataURL → Assinatura da Técnica
    const isClienteSig = i === 0 && sigDataURL;
    const isProfSig    = i === 1 && sigProfDataURL;
    const lineContent  = isClienteSig ? `<img src="${sigDataURL}" class="pd-sig-img" alt="Assinatura">`
                       : isProfSig    ? `<img src="${sigProfDataURL}" class="pd-sig-img" alt="Ass. Profissional">`
                       : (v || '');
    return `<div class="pd-sign-block">
      <div class="pd-sign-line">${lineContent}</div>
      <div class="pd-sign-desc">${desc}</div>
    </div>`;
  }).join('')}</div>`;
}

function logoSVG() {
  return `<svg viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg" style="width:54px;height:54px;flex-shrink:0;">
    <rect x="0" y="0" width="500" height="500" rx="60" ry="60" fill="#FFF1F2"/>
    <rect x="5" y="5" width="490" height="490" rx="57" ry="57" fill="none" stroke="#E46589" stroke-width="10"/>
    <g stroke="#E46589" stroke-linecap="round">
      <line x1="250" y1="152" x2="250" y2="67"  stroke-width="7.5"/>
      <line x1="250" y1="152" x2="291" y2="72"  stroke-width="5.5"/>
      <line x1="250" y1="152" x2="209" y2="72"  stroke-width="5.5"/>
      <line x1="250" y1="152" x2="329" y2="86"  stroke-width="5.0"/>
      <line x1="250" y1="152" x2="171" y2="86"  stroke-width="5.0"/>
      <line x1="250" y1="152" x2="361" y2="108" stroke-width="4.5"/>
      <line x1="250" y1="152" x2="139" y2="108" stroke-width="4.5"/>
      <line x1="250" y1="152" x2="387" y2="137" stroke-width="4.0"/>
      <line x1="250" y1="152" x2="113" y2="137" stroke-width="4.0"/>
    </g>
    <path d="M104,208 Q250,157 396,208 Q250,259 104,208Z" fill="#FFF1F2" stroke="#E46589" stroke-width="11"/>
    <circle cx="250" cy="234" r="59" fill="#FFF1F2" stroke="#E46589" stroke-width="9.5"/>
    <path d="M250,274 C250,274 208,248 200,231 C193,217 200,207 213,207 C224,207 237,216 250,228 C263,216 276,207 287,207 C300,207 307,217 300,231 C292,248 250,274 250,274Z" fill="#E46589"/>
  </svg>`;
}

function printHeader(title) {
  return `<div class="pd-header">
    <div class="pd-logo-row">${logoSVG()}
      <div class="pd-brand">
        <div class="pd-brand-name">Beleza Rara</div>
        <div class="pd-brand-sub">Valquiria Almeida</div>
      </div>
    </div>
    <div class="pd-title-bar">${title}</div>
  </div>`;
}

/* ── Bloco de Dados da Cliente (comum a todas as fichas) ── */
function dadosClienteBlock(d) {
  const nacDisplay = getNacDisplay(d.nac || '');
  return makeFields([
    [['Nome:', d.nome, 2], ['Data de Nascimento:', formatDate(d.nasc)]],
    [['Idade:', d.idade], ['Sexo:', d.sexo], ['Telefone:', d.tel]],
    [['Morada:', d.morada, 2], ['E-mail:', d.email, 1.5]],
    [['Doc. Identificação (NIF/BI/Passaporte):', d.doc], ['Nacionalidade:', nacDisplay, 1.2]],
  ]);
}

function atendimentoBlock(d) {
  return makeFields([
    [['Data do Procedimento:', formatDate(d.atendData||'')], ['Profissional Responsável:', d.profissional||'']],
  ]);
}

/* ── Bloco de Autorização de Imagem (comum a todas) ── */
function imagemBlock(imgAuth) {
  return `<div style="margin-top:6mm;padding:5mm 0 0;border-top:1px solid #f0c0d6;">
    <div style="font-weight:700;font-size:9pt;color:#E46589;margin-bottom:3mm;letter-spacing:.06em;">AUTORIZAÇÃO DE IMAGEM E VÍDEO</div>
    <div style="font-size:8.5pt;color:#333;margin-bottom:3mm;">
      Autorizo a técnica <b>Valquiria Almeida dos Santos</b> a captar fotografias/vídeos para divulgação em redes sociais, portefólio digital e website oficial. Autorização gratuita e revogável por escrito a qualquer momento.
    </div>
    <div style="display:flex;gap:16px;">
      <div style="display:flex;align-items:center;gap:6px;font-size:10pt;">
        <span class="print-box${imgAuth==='Autorizo'?' checked':''}"></span> Autorizo o uso da minha imagem.
      </div>
      <div style="display:flex;align-items:center;gap:6px;font-size:10pt;">
        <span class="print-box${imgAuth==='Não autorizo'?' checked':''}"></span> Não autorizo o uso da minha imagem.
      </div>
    </div>
  </div>`;
}

/* ══════════════════════════════════════════════════════════════════════════
   CONSTRUÇÃO DE HTML PARA IMPRESSÃO
   ══════════════════════════════════════════════════════════════════════════ */

/* ── PESTANAS ── */
function buildPestanasHTML(d) {
  const dataFmt = formatDate(d.data);

  const p1 = `<div class="pd-page">
    ${printHeader('FICHA DE ANAMNESE – EXTENSÃO DE PESTANAS')}
    ${dadosClienteBlock(d)}
    ${atendimentoBlock(d)}
    <div class="pd-section-title">AVALIAÇÃO</div>
    ${makeYnTable([
      ['É gestante ou lactante?' + (d.gestObs ? ' – ' + d.gestObs : ''), d.gest],
      ['Já fez procedimento nos olhos?', d.proc_ol],
      ['Possui alergia a esmalte ou cosméticos?' + (d.alerObs ? ' – ' + d.alerObs : ''), d.aler],
      ['Possui glaucoma ou problema ocular?', d.glau],
      ['Faz tratamento oncológico?', d.onco],
      ['Está de rímel?', d.rimel],
    ])}
    <div class="pd-section-title">PROCEDIMENTO</div>
    ${makeFields([[['Estilo:', d.estilo]],[['Curvatura:', d.curv],['Espessura:', d.esp],['Modelo dos fios:', d.modelo]]])}
    ${sigRow([['Assinatura da Cliente',''],['Data do Procedimento', dataFmt]], d.sigDataURL, d.sigProfDataURL)}
  </div>`;

  const p2 = `<div class="pd-page">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:6mm;">
      ${logoSVG()}
      <div class="pd-title-bar" style="flex:1;margin:0;">TERMO DE CONSENTIMENTO E RESPONSABILIDADE: EXTENSÃO DE PESTANAS</div>
    </div>
    ${fieldLine('Nome:', d.nome)}
    <div style="margin-top:5mm;" class="pd-consent-text">
      <p><b>1. Natureza do Procedimento</b> — Declaro que fui devidamente esclarecida sobre a técnica de extensão de pestanas, que consiste na aplicação de fios sintéticos individuais ou em leque sobre as minhas pestanas naturais, utilizando uma cola (adesivo) específica para uso ocular.</p>
      <p><b>2. Riscos Possíveis</b> — Embora o procedimento seja estético e não invasivo, podem ocorrer: <b>Irritação Ocular</b> (vermelhidão, lacrimejo nas primeiras 24h); <b>Reações Alérgicas</b> (inchaço, prurido ou dermatite de contacto); <b>Sensibilidade aos Vapores</b> (ardência momentânea); <b>Queda Prematura</b> (se não forem cumpridos os cuidados de manutenção).</p>
      <p><b>3. Questionário de Saúde</b></p>
    </div>
    ${makeYnTable([
      ['Sofre de alguma alergia conhecida (látex, esmalte, colas)?', d.cAler],
      ['Tem antecedentes de problemas oculares (terçolhos, conjuntivites, blefarite)?', d.cOcul],
      ['Realizou alguma cirurgia ocular nos últimos 6 meses?', d.cCiru],
      ['Utiliza lentes de contacto?', d.cLent],
      ['Está com alguma irritação ou sensibilidade ocular hoje?', d.cIrri],
    ])}
    <div class="pd-consent-text" style="margin-top:4mm;">
      <p><b>4. Pós-Tratamento</b> — Comprometo-me a: 1) Não molhar nas primeiras 24h; 2) Evitar vapores quentes nas primeiras 48h; 3) Não usar produtos oleosos na zona ocular; 4) Higienizar diariamente com lash shampoo; 5) Remoção obrigatória por profissional.</p>
      <p><b>5. Consentimento</b> — Autorizo a realização do procedimento e assumo responsabilidade pelos cuidados posteriores.</p>
      <p style="font-size:7.5pt;color:#888;"><i>RGPD: Dados recolhidos exclusivamente para gestão da ficha de cliente.</i></p>
    </div>
    ${imagemBlock(d.imgAuth)}
    ${sigRow([['Assinatura da Cliente',''],['Assinatura da Técnica',''],['Data do Procedimento', dataFmt]], d.sigDataURL, d.sigProfDataURL)}
  </div>`;

  return p1 + p2;
}

/* ── DEPILAÇÃO ── */
function buildDepilacaoHTML(d) {
  // helper: render checkbox list + optional outro
  function chkList(arr, outro) {
    const items = (arr || []).join(', ');
    if (!items && !outro) return '—';
    return [items, outro ? '+ ' + outro : ''].filter(Boolean).join('; ');
  }

  // helper: yn row for print
  function pYn(label, val) {
    const sim = normYn(val) === 'SIM';
    const nao = normYn(val) === 'NAO';
    return `<tr>
      <td class="pd-yn-q">${label}</td>
      <td class="pd-yn-a">
        <span class="print-box${sim?' checked':''}"></span><span class="print-box-label">SIM</span>
        &nbsp;&nbsp;
        <span class="print-box${nao?' checked':''}"></span><span class="print-box-label">NÃO</span>
      </td>
    </tr>`;
  }

  // helper: checkbox row for print
  function pChk(label, options, selected, outro) {
    const boxes = options.map(o => {
      const chk = (selected || []).includes(o);
      return `<span class="print-box${chk?' checked':''}"></span><span class="print-box-label">${o}</span>`;
    }).join('&nbsp;&nbsp;');
    const outroPart = outro
      ? `&nbsp;&nbsp;<span class="print-box${(selected||[]).includes('Outro')?' checked':''}"></span><span class="print-box-label">Outro: ${outro}</span>`
      : '';
    return `<tr>
      <td class="pd-yn-q" colspan="2" style="padding-bottom:5px;">
        <div style="font-weight:600;margin-bottom:3px;">${label}</div>
        <div style="font-size:8.5pt;">${boxes}${outroPart}</div>
      </td>
    </tr>`;
  }

  // helper: open text row
  function pText(label, value) {
    return `<tr>
      <td class="pd-yn-q">${label}</td>
      <td style="border-bottom:1px solid #ccc;font-weight:bold;font-size:9pt;padding:4px 6px;">${value||''}</td>
    </tr>`;
  }

  return `<div class="pd-page">
    ${printHeader('FICHA DE ANAMNESE – DEPILAÇÃO')}
    ${dadosClienteBlock(d)}
    ${atendimentoBlock(d)}
    <div class="pd-section-title">HISTÓRICO</div>
    <table class="pd-yn-table">
      ${pYn('1) Já fez depilação antes?', d.fez)}
      ${pChk('Se sim, qual foi o método?', ['Cera','Lâmina','Laser'], d.metodo, d.metodoOutro)}
      ${pYn('2) Tem alguma alergia a produtos de depilação ou sensibilidade na pele?', d.alergia)}
      <tr><td colspan="2" style="padding:2px 4px 5px;font-size:8.5pt;">
        Se sim, especifique: <span style="border-bottom:1px solid #bbb;display:inline-block;min-width:140px;font-weight:bold;">${d.alergiaEsp||''}</span>
      </td></tr>
      ${pText('3) Qual é a área que deseja depilar hoje?', d.area)}
      ${pYn('4) Está a tomar algum medicamento ou usando produtos tópicos que possam afetar a depilação?', d.medic)}
      ${pChk('5) Teve alguma reação adversa à depilação no passado?', ['Irritação','Pelos encravados','Queimaduras'], d.reacao, d.reacaoOutro)}
      ${pText('6) Com que frequência faz depilação?', d.freq)}
      ${pChk('7) Qual é o seu objetivo com a depilação?', ['Remoção temporária','Redução permanente','Manutenção'], d.obj, d.objOutro)}
      ${pYn('8) Está grávida ou a amamentar?', d.gravida)}
    </table>
    ${imagemBlock(d.imgAuth)}
    ${sigRow([['Assinatura da Cliente',''],['Data','&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;']], d.sigDataURL, d.sigProfDataURL)}
  </div>`;
}

/* ── LASER ── */
function buildLaserHTML(d) {
  const dataFmt = formatDate(d.dataInicio);
  const ynRows1 = [
    ['Algum problema grave de saúde ou doença?', d.saude],
    ['Sensibilidade da Pele?', d.pele],['Gravidez?', d.grav],['Amamentação?', d.ama],
    ['Tem prótese metálica, bypass, desfibrilhador ou cardioversor?', d.prot],
    ['Alterações de coagulação?', d.coag],['Doenças neuromusculares?', d.neuro],
    ['Antecedentes oncológicos?', d.onco],
    ['Implantes recentes de colagénio na zona a tratar?', d.cola],
    ['Está a fazer tratamento estético na zona a tratar?', d.trat],
    ['Tem tatuagens na zona a tratar?', d.tatu],
    ['Tem dermatites (eczema, psoríase, fungos na pele)?', d.derm],
    ['Tem alergias?', d.aler],['Tem problemas hormonais?', d.horm],
    ['Está a decorrer a menopausa ou andropausa?', d.meno],
    ['Tem doenças autoimunes?', d.auto],
    ['Tem grande concentração de varizes ou derrames?', d.vari],
    ['Tem acne activo?', d.acne],['Tem cicatrizes?', d.cica],
    ['Tem epilepsia?', d.epil],['Tem diabetes?', d.diab],['Tem vitiligo?', d.viti],
  ];
  const ynRows2 = [
    ['Fez peeling mecânico nos últimos 15 dias?', d.peel],
    ['Fez medicação oral ou tópica que torne a pele sensível?', d.med],
    ['Esteve exposto ao sol nas últimas 48h?', d.sol],
    ['Utilizou creme depilatório nas últimas 72h?', d.crem],
    ['Utilizou autobronzeador nos últimos 5 dias?', d.auto2],
    ['Fez recentemente solário?', d.sola],
    ['Alguma vez fez tratamentos de depilação a laser?', d.prev],
  ];

  const fotoBoxes = ['I','II','III','IV','V','VI'].map(f =>
    `<span class="pd-fototipo-box${d.foto===f?' sel':''}">${f}</span>`).join('');

  const sessRows  = (d.sessions||[]);
  const empty     = Math.max(0, 10 - sessRows.length);
  const sessHTML  = sessRows.map(r=>`<tr>${r.slice(0,10).map(v=>`<td>${v}</td>`).join('')}</tr>`).join('')
                  + Array(empty).fill(`<tr>${Array(10).fill('<td>&nbsp;</td>').join('')}</tr>`).join('');

  const p1 = `<div class="pd-page">
    ${printHeader('FICHA DE ANAMNESE – DEPILAÇÃO A LASER DE DIODO')}
    ${dadosClienteBlock(d)}
    ${atendimentoBlock(d)}
    <div class="pd-section-title">AVALIAÇÃO</div>${makeYnTable(ynRows1)}
    <div class="pd-section-title">AVALIAÇÃO PRÉ-TRATAMENTO</div>${makeYnTable(ynRows2)}
    ${makeFields([[['Se SIM, em quais zonas?', d.zonasPrev, 2],['Última vez que fez?', d.ultima]]])}
    <div style="margin:4mm 0 2mm;font-weight:700;font-size:9pt;color:#E46589;">FOTOTIPO:</div>
    <div style="display:flex;gap:6px;margin-bottom:4mm;">${fotoBoxes}</div>
    <div style="font-weight:700;font-size:9pt;margin-bottom:2px;">Observações:</div>
    <div style="border:1.5px solid #E46589;border-radius:3px;min-height:12mm;padding:5px 8px;font-size:9pt;">${d.obs||''}</div>
    <div style="margin:6mm 0 3mm;font-size:8.5pt;line-height:1.55;color:#333;">Tomei conhecimento de todas as precauções e contra-indicações do tratamento. Assumo comunicar em qualquer sessão qualquer alteração da minha situação.</div>
    ${imagemBlock(d.imgAuth)}
    ${sigRow([['Assinatura da Cliente',''],['Assinatura da Técnica',''],['Data do Procedimento', dataFmt]], d.sigDataURL, d.sigProfDataURL)}
  </div>`;

  const p2 = `<div class="pd-page">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:5mm;">${logoSVG()}
      <div><div style="font-style:italic;font-size:8pt;color:#888;">Data do início:</div><div style="font-weight:700;font-size:10pt;">${dataFmt}</div></div>
    </div>
    <table class="pd-sessions-table">
      <thead><tr><th>Sessão</th><th>Data</th><th>Zona</th><th>FotoTipo</th><th>Pulso</th><th>Frequência</th><th>Energia</th><th>Duração</th><th>Passagens na Zona</th><th>Resultados Sessão Anterior</th></tr></thead>
      <tbody>${sessHTML}</tbody>
    </table>
  </div>`;

  return p1 + p2;
}

/* ── MANICURE ── */
function buildManicureHTML(d) {
  const dataFmt = formatDate(d.data);

  // técnicas seleccionadas
  const tecnicasArr = d.tecnica || [];
  const tecList = ['Acrílico','Gel','Fibra','Outra'].map(t => {
    const sel = tecnicasArr.includes(t);
    return `<span class="print-box${sel?' checked':''}"></span><span class="print-box-label">${t}${t==='Outra'&&d.tecnicaOutra?' ('+d.tecnicaOutra+')':''}</span>`;
  }).join('&nbsp;&nbsp;');

  const p1 = `<div class="pd-page">
    ${printHeader('FICHA DE ANAMNESE – MANICURE')}
    ${dadosClienteBlock(d)}
    ${atendimentoBlock(d)}
    <div class="pd-section-title">INFORMAÇÕES DE SAÚDE</div>
    <table class="pd-yn-table">
      <tr>
        <td class="pd-yn-q" style="width:68%;">1) Tem alguma alergia a produtos químicos ou materiais usados em tratamentos de unhas? (cola, acrílico, gel, etc.)</td>
        <td class="pd-yn-a">
          <span class="print-box${normYn(d.alergia)==='SIM'?' checked':''}"></span><span class="print-box-label">SIM</span>&nbsp;&nbsp;<span class="print-box${normYn(d.alergia)==='NAO'?' checked':''}"></span><span class="print-box-label">NÃO</span>
        </td>
      </tr>
    </table>
    <div style="font-size:8.5pt;margin:2px 0 4px;">
      Se SIM, especifique: <span style="border-bottom:1px solid #aaa;display:inline-block;min-width:120px;">${d.alergiaEsp||''}</span>
      &nbsp;&nbsp; Alergia a marca específica: <span style="border-bottom:1px solid #aaa;display:inline-block;min-width:100px;">${d.alergiaMarca||''}</span>
    </div>
    ${makeYnTable([
      ['2) Tem alguma condição médica que afeta as unhas ou pele das mãos? (fungos, psoríase, eczema, etc.)', d.condicao],
    ])}
    <div style="font-size:8.5pt;margin:2px 0 4px;">
      Se SIM, especifique: <span style="border-bottom:1px solid #aaa;display:inline-block;min-width:200px;">${d.condicaoEsp||''}</span>
    </div>
    ${makeYnTable([
      ['3) Está grávida ou a amamentar?', d.gravida],
    ])}

    <div class="pd-section-title">HISTÓRICO DE ALONGAMENTO DE UNHAS</div>
    ${makeYnTable([
      ['4) Já fez alongamento de unhas anteriormente?', d.histo],
    ])}
    <div style="margin:3mm 0 2mm;font-size:9pt;font-weight:600;">5) Qual técnica foi usada?</div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:4mm;">${tecList}</div>
    ${makeYnTable([
      ['6) Teve algum problema de alergia, infecção ou dano às unhas naturais como resultado de procedimento anterior?', d.problema],
    ])}
    <div style="font-size:8.5pt;margin:2px 0 6px;">
      Se SIM, especifique: <span style="border-bottom:1px solid #aaa;display:inline-block;min-width:200px;">${d.problemaEsp||''}</span>
    </div>

    <div class="pd-section-title">INFORMAÇÕES ADICIONAIS</div>
    ${makeYnTable([
      ['7) Está ciente de que a manutenção regular é necessária para preservar o alongamento das suas unhas?', d.manutencao],
      ['8) Tem alguma pergunta ou preocupação específica sobre o procedimento de alongamento de unhas?', d.pergunta],
    ])}
    <div style="font-size:8.5pt;margin:2px 0 6px;">
      Se SIM, especifique: <span style="border-bottom:1px solid #aaa;display:inline-block;min-width:200px;">${d.perguntaEsp||''}</span>
    </div>

    <div style="margin:5mm 0 3mm;font-size:8.5pt;line-height:1.55;color:#333;">
      <b>Assinatura do Cliente:</b> Declaro que as informações fornecidas acima são verdadeiras e completas. Entendo os riscos e benefícios do alongamento de unhas e concordo com o procedimento.
    </div>
    ${imagemBlock(d.imgAuth)}
    ${sigRow([['Assinatura da Cliente',''],['Profissional Responsável',''],['Data', dataFmt]], d.sigDataURL, d.sigProfDataURL)}
  </div>`;

  return p1;
}

/* ══════════════════════════════════════════════════════════════════════════
   IMPRESSÃO
   ══════════════════════════════════════════════════════════════════════════ */
function printForms() {
  const data = collectForm();
  if (!data) return;
  printFromData(currentProc, data);
}

function printFromData(proc, data) {
  let html = '';
  if (proc === 'pestanas')  html = buildPestanasHTML(data);
  if (proc === 'depilacao') html = buildDepilacaoHTML(data);
  if (proc === 'laser')     html = buildLaserHTML(data);
  if (proc === 'manicure')  html = buildManicureHTML(data);

  const win = window.open('', '_blank', 'width=900,height=700');
  win.document.write(`<!DOCTYPE html><html lang="pt"><head>
    <meta charset="UTF-8">
    <title>Beleza Rara – ${TITLES[proc]}</title>
    <style>${getPrintCSS()}</style>
  </head><body class="print-body">${html}</body></html>`);
  win.document.close();
  win.onload = () => { win.focus(); win.print(); };
}

/* ══════════════════════════════════════════════════════════════════════════
   CSS DE IMPRESSÃO
   ══════════════════════════════════════════════════════════════════════════ */
function getPrintCSS() {
  return `
    *{box-sizing:border-box;margin:0;padding:0;}
    body.print-body{background:white;font-family:Arial,Helvetica,sans-serif;}
    .pd-page{width:210mm;min-height:297mm;background:white;padding:14mm 17mm 12mm;margin:0 auto;page-break-after:always;font-size:9.5pt;color:#222;}
    .pd-page:last-child{page-break-after:auto;}
    .pd-header{margin-bottom:6mm;}
    .pd-logo-row{display:flex;align-items:center;gap:12px;justify-content:center;margin-bottom:4px;}
    .pd-brand-name{font-family:Georgia,serif;font-size:20pt;color:#E46589;font-style:italic;line-height:1;}
    .pd-brand-sub{font-size:8pt;color:#999;letter-spacing:.05em;}
    .pd-title-bar{background:#E46589;color:white;text-align:center;padding:5px 0;font-size:9.5pt;font-weight:bold;letter-spacing:.12em;border-radius:3px;}
    .print-label{font-size:8pt;color:#555;white-space:nowrap;}
    .print-value{font-size:9.5pt;font-weight:bold;flex:1;min-width:0;}
    .pd-section-title{background:#E46589;color:white;text-align:center;padding:4px 0;font-size:9pt;font-weight:bold;letter-spacing:.1em;margin:5mm 0 2mm;border-radius:3px;}
    .pd-yn-table{width:100%;border-collapse:collapse;font-size:9pt;margin-bottom:1mm;}
    .pd-yn-table tr{border-bottom:1px solid #eee;}
    .pd-yn-table td{padding:3.5px 4px;vertical-align:middle;}
    .pd-yn-q{width:68%;font-weight:600;}
    .pd-yn-a{width:32%;text-align:right;white-space:nowrap;}
    .print-box{display:inline-block;width:12px;height:12px;border:1.5px solid #E46589;border-radius:2px;vertical-align:middle;margin-right:2px;}
    .print-box.checked{background:#E46589;}
    .print-box-label{font-size:8.5pt;color:#333;margin-right:6px;vertical-align:middle;}
    .pd-sign-row{display:flex;justify-content:space-between;gap:14mm;margin-top:12mm;}
    .pd-sign-block{flex:1;text-align:center;}
    .pd-sign-line{border-top:1px solid #888;min-height:18px;padding-top:3px;font-size:9pt;font-weight:bold;margin-bottom:3px;}
    .pd-sign-desc{font-size:8pt;color:#666;}
    .pd-consent-text p{font-size:8.5pt;line-height:1.55;margin-bottom:2.5mm;text-align:justify;}
    .pd-fototipo-box{border:1.5px solid #E46589;padding:3px 8px;border-radius:3px;font-size:8.5pt;font-weight:bold;display:inline-block;}
    .pd-fototipo-box.sel{background:#E46589;color:white;}
    .pd-sessions-table{width:100%;border-collapse:collapse;font-size:7.5pt;}
    .pd-sessions-table th{background:#E46589;color:white;padding:5px 4px;text-align:center;font-size:7pt;}
    .pd-sessions-table td{border:1px solid #ddd;padding:5px 4px;text-align:center;}
    .pd-sessions-table tr:nth-child(even) td{background:#fff5f9;}
    .pd-sig-img{max-width:180px;max-height:65px;display:block;margin:2px auto 0;object-fit:contain;}
    @media print{@page{size:A4 portrait;margin:0;}body{margin:0;}.pd-page{margin:0;width:100%;min-height:100vh;}}
  `;
}




/* ══════════════════════════════════════════════════════════════════════════
   CLIENTES — navegação, CRUD e busca inline
   ══════════════════════════════════════════════════════════════════════════ */
let currentClienteId = null;
let allClientes       = [];   // cache for fast search

function showClientes() {
  document.querySelectorAll('.screen').forEach(s => { s.style.display='none'; s.classList.remove('active'); });
  document.getElementById('screen-clientes').style.display = 'flex';
  renderClientesList('');
}

function backFromClientes() {
  document.getElementById('screen-clientes').style.display = 'none';
  const sel = document.getElementById('screen-select');
  sel.style.display = 'flex'; sel.classList.add('active');
}

function backFromClienteForm() {
  document.getElementById('screen-cliente-form').style.display = 'none';
  document.getElementById('screen-clientes').style.display     = 'flex';
}

/* ── List rendering ── */
async function renderClientesList(query) {
  const container = document.getElementById('clientes-list');
  container.innerHTML = '<div class="fichas-loading">A carregar…</div>';
  allClientes = await dbGetAllClientes();
  allClientes.sort((a,b) => (a.nome||'').localeCompare(b.nome||'', 'pt'));
  filterClientes(query || document.getElementById('clientes-search')?.value || '');
}

function filterClientes(query) {
  const container = document.getElementById('clientes-list');
  if (!container) return;
  const q = query.toLowerCase().trim();
  const list = q
    ? allClientes.filter(c =>
        (c.nome||'').toLowerCase().includes(q) ||
        (c.tel||'').toLowerCase().includes(q)  ||
        (c.email||'').toLowerCase().includes(q))
    : allClientes;

  if (!list.length) {
    container.innerHTML = '<div class="clientes-empty">'
      + (q ? 'Nenhuma cliente encontrada para "' + query + '".'
           : 'Nenhuma cliente cadastrada ainda.<br>Clique em <strong>+ Nova Cliente</strong> para começar.')
      + '</div>';
    return;
  }

  container.innerHTML = list.map(c => {
    const initials = (c.nome||'?').trim().split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    const meta = [c.tel, c.email].filter(Boolean).join(' · ');
    const nac  = getNacDisplay(c.nac||'');
    return `<div class="cliente-card">
      <div class="cliente-avatar">${initials}</div>
      <div class="cliente-card-info">
        <div class="cliente-card-nome">${c.nome||'(sem nome)'}</div>
        <div class="cliente-card-meta">
          ${meta ? `<span>${meta}</span>` : ''}
          ${nac  ? `<span class="dot">·</span><span>${nac}</span>` : ''}
        </div>
      </div>
      <div class="cliente-card-actions">
        <button class="btn-cl-edit" onclick="openClienteForm(${c.id})">✏️ Editar</button>
        <button class="btn-cl-del"  onclick="deleteCliente(${c.id})">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

/* ── Form open/save ── */
async function openClienteForm(id) {
  currentClienteId = id;
  document.getElementById('screen-clientes').style.display     = 'none';
  document.getElementById('screen-cliente-form').style.display = 'flex';
  document.getElementById('cliente-form-title').textContent    = id ? 'Editar Cliente' : 'Nova Cliente';
  clearClienteForm();
  if (id) {
    const c = await dbGetCliente(id);
    if (c) populateClienteForm(c);
  }
}

function clearClienteForm() {
  ['cl-nome','cl-nasc','cl-idade','cl-sexo','cl-tel','cl-morada','cl-email','cl-doc','cl-obs']
    .forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = '';
    });
  // reset nationality
  const lbl = document.getElementById('nac-lbl-cl');
  const flg = document.getElementById('nac-flag-cl');
  const hid = document.getElementById('cl-nac');
  if (lbl) { lbl.textContent = 'Selecionar país…'; lbl.classList.add('placeholder'); }
  if (flg) flg.textContent = '';
  if (hid) hid.value = '';
  const list = document.getElementById('nac-list-cl');
  if (list) { list.innerHTML = ''; list.dataset.built = ''; }
}

function populateClienteForm(c) {
  const sv = (id, v) => { const el=document.getElementById(id); if(el&&v) el.value=v; };
  sv('cl-nome', c.nome); sv('cl-nasc', c.nasc);
  document.getElementById('cl-idade').value = c.nasc ? calcIdade(c.nasc) : (c.idade||'');
  sv('cl-sexo', c.sexo); sv('cl-tel', c.tel);
  sv('cl-morada', c.morada); sv('cl-email', c.email);
  sv('cl-doc', c.doc); sv('cl-obs', c.obs);
  setNac('cl', c.nac);
}

function getClienteFormData() {
  return {
    nome:   document.getElementById('cl-nome')?.value.trim() || '',
    nasc:   document.getElementById('cl-nasc')?.value || '',
    idade:  document.getElementById('cl-idade')?.value || '',
    sexo:   document.getElementById('cl-sexo')?.value || '',
    tel:    document.getElementById('cl-tel')?.value.trim() || '',
    morada: document.getElementById('cl-morada')?.value.trim() || '',
    email:  document.getElementById('cl-email')?.value.trim() || '',
    doc:    document.getElementById('cl-doc')?.value.trim() || '',
    nac:    document.getElementById('cl-nac')?.value || '',
    obs:    document.getElementById('cl-obs')?.value.trim() || '',
  };
}

async function saveCliente() {
  const data = getClienteFormData();
  if (!data.nome) { alert('Por favor preencha o nome da cliente.'); return; }
  if (currentClienteId) data.id = currentClienteId;
  await dbSaveCliente(data);
  showToast('✅ Cliente guardada com sucesso!');
  backFromClienteForm();
  renderClientesList('');
}

async function deleteCliente(id) {
  if (!confirm('Eliminar esta cliente permanentemente?')) return;
  await dbDeleteCliente(id);
  await renderClientesList('');
}

/* ── Busca inline dentro da ficha ── */
async function buscaClienteInline(pfx, query) {
  const resultsDiv = document.getElementById(pfx + '-busca-results');
  if (!resultsDiv) return;
  const q = query.trim().toLowerCase();
  if (!q) { resultsDiv.style.display = 'none'; return; }

  if (!allClientes.length) allClientes = await dbGetAllClientes();
  const found = allClientes.filter(c =>
    (c.nome||'').toLowerCase().includes(q) ||
    (c.tel||'').toLowerCase().includes(q)  ||
    (c.email||'').toLowerCase().includes(q)
  ).slice(0, 8);

  if (!found.length) {
    resultsDiv.style.display = 'block';
    resultsDiv.innerHTML = '<div class="busca-item"><div class="busca-item-info"><div class="busca-item-sub" style="padding:8px 4px;">Nenhuma cliente encontrada</div></div></div>';
    return;
  }

  resultsDiv.style.display = 'block';
  resultsDiv.innerHTML = found.map(c => {
    const initials = (c.nome||'?').trim().split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    const sub = [c.tel, getNacDisplay(c.nac)].filter(Boolean).join(' · ');
    return `<div class="busca-item" onclick="preencherDadosCliente('${pfx}', ${c.id})">
      <div class="busca-item-avatar">${initials}</div>
      <div class="busca-item-info">
        <div class="busca-item-nome">${c.nome}</div>
        ${sub ? `<div class="busca-item-sub">${sub}</div>` : ''}
      </div>
      <span class="busca-item-badge">Usar</span>
    </div>`;
  }).join('');
}

async function preencherDadosCliente(pfx, clienteId) {
  const c = await dbGetCliente(clienteId);
  if (!c) return;

  const sv = (id, v) => { const el=document.getElementById(id); if(el&&v!==undefined) el.value=v; };

  sv(`${pfx}-nome`,   c.nome);
  sv(`${pfx}-nasc`,   c.nasc);
  const idadeEl = document.getElementById(`${pfx}-idade`);
  if (idadeEl) idadeEl.value = c.nasc ? calcIdade(c.nasc) : (c.idade||'');
  sv(`${pfx}-sexo`,   c.sexo);
  sv(`${pfx}-tel`,    c.tel);
  sv(`${pfx}-morada`, c.morada);
  sv(`${pfx}-email`,  c.email);
  sv(`${pfx}-doc`,    c.doc);
  setNac(pfx, c.nac);

  // Close results and clear search
  const res = document.getElementById(`${pfx}-busca-results`);
  const inp = document.getElementById(`${pfx}-busca-cliente`);
  if (res) res.style.display = 'none';
  if (inp) inp.value = '';

  showToast(`✅ Dados de ${c.nome} preenchidos!`);
}

// Close busca results when clicking outside
document.addEventListener('click', e => {
  if (!e.target.closest('.cliente-search-inline')) {
    document.querySelectorAll('.cliente-busca-results').forEach(el => el.style.display = 'none');
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   ASSINATURA DIGITAL — Canvas pad
   ══════════════════════════════════════════════════════════════════════════ */

const _sig = {};   // state per prefix: { drawing, lastX, lastY, hasStroke }

function sigInit(pfx) {
  const canvas = document.getElementById('sig-canvas-' + pfx);
  if (!canvas || _sig[pfx]) return;   // already initialised

  const state = { drawing: false, lastX: 0, lastY: 0, hasStroke: false };
  _sig[pfx] = state;

  // Size canvas pixels to match its CSS display size
  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr  = window.devicePixelRatio || 1;
    canvas.width  = rect.width  * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth   = 2.2;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
  }
  resize();
  new ResizeObserver(resize).observe(canvas);

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const src  = e.touches ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  }

  function startDraw(e) {
    e.preventDefault();
    state.drawing = true;
    const { x, y } = getPos(e);
    state.lastX = x;
    state.lastY = y;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.arc(x, y, 1.1, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a2e';
    ctx.fill();
    canvas.closest('.sig-canvas-wrap').classList.add('active');
    hidePlaceholder(pfx);
  }

  function draw(e) {
    if (!state.drawing) return;
    e.preventDefault();
    const { x, y } = getPos(e);
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth   = 2.2;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    ctx.moveTo(state.lastX, state.lastY);
    ctx.lineTo(x, y);
    ctx.stroke();
    state.lastX = x;
    state.lastY = y;
    state.hasStroke = true;
  }

  function endDraw(e) {
    if (!state.drawing) return;
    state.drawing = false;
    canvas.closest('.sig-canvas-wrap').classList.remove('active');
    if (state.hasStroke) {
      const status = document.getElementById('sig-status-' + pfx);
      if (status) status.textContent = '✅ Assinatura registada';
    }
  }

  // Pointer events (covers mouse, touch, stylus uniformly)
  canvas.addEventListener('pointerdown', startDraw, { passive: false });
  canvas.addEventListener('pointermove', draw,      { passive: false });
  canvas.addEventListener('pointerup',   endDraw);
  canvas.addEventListener('pointerleave', endDraw);
  // Also handle touch explicitly for older iOS
  canvas.addEventListener('touchstart', startDraw, { passive: false });
  canvas.addEventListener('touchmove',  draw,      { passive: false });
  canvas.addEventListener('touchend',   endDraw);
}

function hidePlaceholder(pfx) {
  const ph = document.getElementById('sig-ph-' + pfx);
  if (ph) ph.classList.add('hidden');
}

function showPlaceholder(pfx) {
  const ph = document.getElementById('sig-ph-' + pfx);
  if (ph) ph.classList.remove('hidden');
}

function sigClear(pfx) {
  const canvas = document.getElementById('sig-canvas-' + pfx);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (_sig[pfx]) _sig[pfx].hasStroke = false;
  showPlaceholder(pfx);
  const status = document.getElementById('sig-status-' + pfx);
  if (status) status.textContent = '';
}

function sigGetDataURL(pfx) {
  const canvas = document.getElementById('sig-canvas-' + pfx);
  if (!canvas) return '';
  if (_sig[pfx] && !_sig[pfx].hasStroke) return '';
  return canvas.toDataURL('image/png');
}

function sigSetDataURL(pfx, dataURL) {
  if (!dataURL) return;
  const canvas = document.getElementById('sig-canvas-' + pfx);
  if (!canvas) return;
  const img = new Image();
  img.onload = () => {
    const ctx = canvas.getContext('2d');
    // Draw at CSS display size
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, rect.width, rect.height);
    if (_sig[pfx]) _sig[pfx].hasStroke = true;
    hidePlaceholder(pfx);
    const status = document.getElementById('sig-status-' + pfx);
    if (status) status.textContent = '✅ Assinatura registada';
  };
  img.src = dataURL;
}

/* Initialise canvases when a form becomes visible */
function initSignaturePad(pfx) {
  // Small delay to ensure canvas is laid out and sized
  setTimeout(() => sigInit(pfx), 80);
}

/* ══════════════════════════════════════════════════════════════════════════
   DROPDOWN DE NACIONALIDADE
   ══════════════════════════════════════════════════════════════════════════ */

/* Top countries always shown first */
const NAC_TOP = [
  { code:'BR', flag:'🇧🇷', name:'Brasil' },
  { code:'PT', flag:'🇵🇹', name:'Portugal' },
  { code:'AO', flag:'🇦🇴', name:'Angola' },
  { code:'FR', flag:'🇫🇷', name:'França' },
  { code:'GB', flag:'🇬🇧', name:'Grã-Bretanha (Inglaterra)' },
  { code:'UA', flag:'🇺🇦', name:'Ucrânia' },
  { code:'IN', flag:'🇮🇳', name:'Índia' },
  { code:'CV', flag:'🇨🇻', name:'Cabo Verde' },
  { code:'MZ', flag:'🇲🇿', name:'Moçambique' },
  { code:'ES', flag:'🇪🇸', name:'Espanha' },
];

/* All other countries — alphabetical */
const NAC_ALL = [
  {code:'AF',flag:'🇦🇫',name:'Afeganistão'},{code:'ZA',flag:'🇿🇦',name:'África do Sul'},
  {code:'AL',flag:'🇦🇱',name:'Albânia'},{code:'DE',flag:'🇩🇪',name:'Alemanha'},
  {code:'AD',flag:'🇦🇩',name:'Andorra'},{code:'AG',flag:'🇦🇬',name:'Antígua e Barbuda'},
  {code:'SA',flag:'🇸🇦',name:'Arábia Saudita'},{code:'DZ',flag:'🇩🇿',name:'Argélia'},
  {code:'AR',flag:'🇦🇷',name:'Argentina'},{code:'AM',flag:'🇦🇲',name:'Arménia'},
  {code:'AU',flag:'🇦🇺',name:'Austrália'},{code:'AT',flag:'🇦🇹',name:'Áustria'},
  {code:'AZ',flag:'🇦🇿',name:'Azerbaijão'},{code:'BS',flag:'🇧🇸',name:'Bahamas'},
  {code:'BD',flag:'🇧🇩',name:'Bangladesh'},{code:'BB',flag:'🇧🇧',name:'Barbados'},
  {code:'BE',flag:'🇧🇪',name:'Bélgica'},{code:'BZ',flag:'🇧🇿',name:'Belize'},
  {code:'BJ',flag:'🇧🇯',name:'Benim'},{code:'BO',flag:'🇧🇴',name:'Bolívia'},
  {code:'BA',flag:'🇧🇦',name:'Bósnia e Herzegovina'},{code:'BW',flag:'🇧🇼',name:'Botswana'},
  {code:'BN',flag:'🇧🇳',name:'Brunei'},{code:'BG',flag:'🇧🇬',name:'Bulgária'},
  {code:'BF',flag:'🇧🇫',name:'Burkina Faso'},{code:'BI',flag:'🇧🇮',name:'Burundi'},
  {code:'BT',flag:'🇧🇹',name:'Butão'},{code:'KH',flag:'🇰🇭',name:'Camboja'},
  {code:'CM',flag:'🇨🇲',name:'Camarões'},{code:'CA',flag:'🇨🇦',name:'Canadá'},
  {code:'QA',flag:'🇶🇦',name:'Catar'},{code:'KZ',flag:'🇰🇿',name:'Cazaquistão'},
  {code:'TD',flag:'🇹🇩',name:'Chade'},{code:'CL',flag:'🇨🇱',name:'Chile'},
  {code:'CN',flag:'🇨🇳',name:'China'},{code:'CY',flag:'🇨🇾',name:'Chipre'},
  {code:'CO',flag:'🇨🇴',name:'Colômbia'},{code:'KM',flag:'🇰🇲',name:'Comores'},
  {code:'CG',flag:'🇨🇬',name:'Congo'},{code:'CD',flag:'🇨🇩',name:'Congo (RDC)'},
  {code:'KP',flag:'🇰🇵',name:'Coreia do Norte'},{code:'KR',flag:'🇰🇷',name:'Coreia do Sul'},
  {code:'CI',flag:'🇨🇮',name:"Costa do Marfim"},{code:'CR',flag:'🇨🇷',name:'Costa Rica'},
  {code:'HR',flag:'🇭🇷',name:'Croácia'},{code:'CU',flag:'🇨🇺',name:'Cuba'},
  {code:'DK',flag:'🇩🇰',name:'Dinamarca'},{code:'DJ',flag:'🇩🇯',name:'Djibouti'},
  {code:'DM',flag:'🇩🇲',name:'Dominica'},{code:'EG',flag:'🇪🇬',name:'Egito'},
  {code:'AE',flag:'🇦🇪',name:'Emirados Árabes Unidos'},{code:'EC',flag:'🇪🇨',name:'Equador'},
  {code:'ER',flag:'🇪🇷',name:'Eritreia'},{code:'SK',flag:'🇸🇰',name:'Eslováquia'},
  {code:'SI',flag:'🇸🇮',name:'Eslovênia'},{code:'SZ',flag:'🇸🇿',name:'Essuatíni'},
  {code:'ET',flag:'🇪🇹',name:'Etiópia'},{code:'FJ',flag:'🇫🇯',name:'Fiji'},
  {code:'PH',flag:'🇵🇭',name:'Filipinas'},{code:'FI',flag:'🇫🇮',name:'Finlândia'},
  {code:'GA',flag:'🇬🇦',name:'Gabão'},{code:'GM',flag:'🇬🇲',name:'Gâmbia'},
  {code:'GH',flag:'🇬🇭',name:'Gana'},{code:'GE',flag:'🇬🇪',name:'Geórgia'},
  {code:'GD',flag:'🇬🇩',name:'Granada'},{code:'GR',flag:'🇬🇷',name:'Grécia'},
  {code:'GT',flag:'🇬🇹',name:'Guatemala'},{code:'GN',flag:'🇬🇳',name:'Guiné'},
  {code:'GW',flag:'🇬🇼',name:'Guiné-Bissau'},{code:'GQ',flag:'🇬🇶',name:'Guiné Equatorial'},
  {code:'GY',flag:'🇬🇾',name:'Guiana'},{code:'HT',flag:'🇭🇹',name:'Haiti'},
  {code:'HN',flag:'🇭🇳',name:'Honduras'},{code:'HU',flag:'🇭🇺',name:'Hungria'},
  {code:'YE',flag:'🇾🇪',name:'Iémen'},{code:'MH',flag:'🇲🇭',name:'Ilhas Marshall'},
  {code:'ID',flag:'🇮🇩',name:'Indonésia'},{code:'IQ',flag:'🇮🇶',name:'Iraque'},
  {code:'IR',flag:'🇮🇷',name:'Irão'},{code:'IE',flag:'🇮🇪',name:'Irlanda'},
  {code:'IS',flag:'🇮🇸',name:'Islândia'},{code:'IL',flag:'🇮🇱',name:'Israel'},
  {code:'IT',flag:'🇮🇹',name:'Itália'},{code:'JM',flag:'🇯🇲',name:'Jamaica'},
  {code:'JP',flag:'🇯🇵',name:'Japão'},{code:'JO',flag:'🇯🇴',name:'Jordânia'},
  {code:'KE',flag:'🇰🇪',name:'Quénia'},{code:'KW',flag:'🇰🇼',name:'Kuwait'},
  {code:'LA',flag:'🇱🇦',name:'Laos'},{code:'LS',flag:'🇱🇸',name:'Lesoto'},
  {code:'LV',flag:'🇱🇻',name:'Letónia'},{code:'LB',flag:'🇱🇧',name:'Líbano'},
  {code:'LR',flag:'🇱🇷',name:'Libéria'},{code:'LY',flag:'🇱🇾',name:'Líbia'},
  {code:'LI',flag:'🇱🇮',name:'Liechtenstein'},{code:'LT',flag:'🇱🇹',name:'Lituânia'},
  {code:'LU',flag:'🇱🇺',name:'Luxemburgo'},{code:'MK',flag:'🇲🇰',name:'Macedónia do Norte'},
  {code:'MG',flag:'🇲🇬',name:'Madagáscar'},{code:'MW',flag:'🇲🇼',name:'Malawi'},
  {code:'MY',flag:'🇲🇾',name:'Malásia'},{code:'MV',flag:'🇲🇻',name:'Maldivas'},
  {code:'ML',flag:'🇲🇱',name:'Mali'},{code:'MT',flag:'🇲🇹',name:'Malta'},
  {code:'MA',flag:'🇲🇦',name:'Marrocos'},{code:'MR',flag:'🇲🇷',name:'Mauritânia'},
  {code:'MU',flag:'🇲🇺',name:'Maurícia'},{code:'MX',flag:'🇲🇽',name:'México'},
  {code:'FM',flag:'🇫🇲',name:'Micronésia'},{code:'MD',flag:'🇲🇩',name:'Moldávia'},
  {code:'MC',flag:'🇲🇨',name:'Mónaco'},{code:'MN',flag:'🇲🇳',name:'Mongólia'},
  {code:'ME',flag:'🇲🇪',name:'Montenegro'},{code:'MM',flag:'🇲🇲',name:'Myanmar'},
  {code:'NA',flag:'🇳🇦',name:'Namíbia'},{code:'NR',flag:'🇳🇷',name:'Nauru'},
  {code:'NP',flag:'🇳🇵',name:'Nepal'},{code:'NI',flag:'🇳🇮',name:'Nicarágua'},
  {code:'NE',flag:'🇳🇪',name:'Níger'},{code:'NG',flag:'🇳🇬',name:'Nigéria'},
  {code:'NO',flag:'🇳🇴',name:'Noruega'},{code:'NZ',flag:'🇳🇿',name:'Nova Zelândia'},
  {code:'OM',flag:'🇴🇲',name:'Omã'},{code:'NL',flag:'🇳🇱',name:'Países Baixos'},
  {code:'PW',flag:'🇵🇼',name:'Palau'},{code:'PA',flag:'🇵🇦',name:'Panamá'},
  {code:'PG',flag:'🇵🇬',name:'Papua Nova Guiné'},{code:'PK',flag:'🇵🇰',name:'Paquistão'},
  {code:'PY',flag:'🇵🇾',name:'Paraguai'},{code:'PE',flag:'🇵🇪',name:'Peru'},
  {code:'PL',flag:'🇵🇱',name:'Polónia'},{code:'PR',flag:'🇵🇷',name:'Porto Rico'},
  {code:'CF',flag:'🇨🇫',name:'República Centro-Africana'},{code:'DO',flag:'🇩🇴',name:'República Dominicana'},
  {code:'CZ',flag:'🇨🇿',name:'República Checa'},{code:'RO',flag:'🇷🇴',name:'Roménia'},
  {code:'RW',flag:'🇷🇼',name:'Ruanda'},{code:'RU',flag:'🇷🇺',name:'Rússia'},
  {code:'WS',flag:'🇼🇸',name:'Samoa'},{code:'LC',flag:'🇱🇨',name:'Santa Lúcia'},
  {code:'ST',flag:'🇸🇹',name:'São Tomé e Príncipe'},{code:'VC',flag:'🇻🇨',name:'São Vicente e Granadinas'},
  {code:'SN',flag:'🇸🇳',name:'Senegal'},{code:'SL',flag:'🇸🇱',name:'Serra Leoa'},
  {code:'RS',flag:'🇷🇸',name:'Sérvia'},{code:'SC',flag:'🇸🇨',name:'Seychelles'},
  {code:'SG',flag:'🇸🇬',name:'Singapura'},{code:'SY',flag:'🇸🇾',name:'Síria'},
  {code:'SO',flag:'🇸🇴',name:'Somália'},{code:'LK',flag:'🇱🇰',name:'Sri Lanka'},
  {code:'SD',flag:'🇸🇩',name:'Sudão'},{code:'SS',flag:'🇸🇸',name:'Sudão do Sul'},
  {code:'SE',flag:'🇸🇪',name:'Suécia'},{code:'CH',flag:'🇨🇭',name:'Suíça'},
  {code:'SR',flag:'🇸🇷',name:'Suriname'},{code:'TH',flag:'🇹🇭',name:'Tailândia'},
  {code:'TW',flag:'🇹🇼',name:'Taiwan'},{code:'TZ',flag:'🇹🇿',name:'Tanzânia'},
  {code:'TJ',flag:'🇹🇯',name:'Tajiquistão'},{code:'TL',flag:'🇹🇱',name:'Timor-Leste'},
  {code:'TG',flag:'🇹🇬',name:'Togo'},{code:'TO',flag:'🇹🇴',name:'Tonga'},
  {code:'TT',flag:'🇹🇹',name:'Trindade e Tobago'},{code:'TN',flag:'🇹🇳',name:'Tunísia'},
  {code:'TM',flag:'🇹🇲',name:'Turquemenistão'},{code:'TR',flag:'🇹🇷',name:'Turquia'},
  {code:'TV',flag:'🇹🇻',name:'Tuvalu'},{code:'UG',flag:'🇺🇬',name:'Uganda'},
  {code:'UY',flag:'🇺🇾',name:'Uruguai'},{code:'UZ',flag:'🇺🇿',name:'Usbequistão'},
  {code:'VU',flag:'🇻🇺',name:'Vanuatu'},{code:'VA',flag:'🇻🇦',name:'Vaticano'},
  {code:'VE',flag:'🇻🇪',name:'Venezuela'},{code:'VN',flag:'🇻🇳',name:'Vietname'},
  {code:'ZM',flag:'🇿🇲',name:'Zâmbia'},{code:'ZW',flag:'🇿🇼',name:'Zimbabué'},
];

/* Build the filtered list HTML */
function nacListHTML(pfx, query) {
  query = (query || '').toLowerCase().trim();
  const topCodes = new Set(NAC_TOP.map(c => c.code));
  const matches  = c => c.name.toLowerCase().includes(query) || c.code.toLowerCase().includes(query);

  const topFiltered  = NAC_TOP.filter(matches);
  const restFiltered = NAC_ALL.filter(c => !topCodes.has(c.code) && matches(c));
  const selVal = document.getElementById(pfx + '-nac')?.value || '';

  const item = c => `<div class="nac-item${c.code===selVal?' selected':''}" onclick="selectNac('${pfx}','${c.code}','${c.flag}','${c.name.replace(/'/g,"\\'")}')">
    <span class="nac-item-flag">${c.flag}</span>
    <span class="nac-item-name">${c.name}</span>
  </div>`;

  let html = '';
  if (topFiltered.length) {
    if (!query) html += '<div class="nac-group-label">Mais frequentes</div>';
    html += topFiltered.map(item).join('');
    if (restFiltered.length) html += '<hr class="nac-separator">';
    if (!query) html += '<div class="nac-group-label">Todos os países</div>';
  }
  html += restFiltered.map(item).join('');
  if (!html) html = '<div style="padding:10px 14px;color:#aaa;font-size:12px;">Nenhum país encontrado</div>';
  return html;
}

/* Initialise a dropdown (called on first open) */
function initNac(pfx) {
  const list = document.getElementById('nac-list-' + pfx);
  if (list && !list.dataset.built) {
    list.innerHTML = nacListHTML(pfx, '');
    list.dataset.built = '1';
  }
}

function toggleNac(pfx) {
  const wrap = document.getElementById('nac-' + pfx);
  const drop = document.getElementById('nac-drop-' + pfx);
  const search = drop.querySelector('.nac-search');
  const isOpen = wrap.classList.contains('open');

  // close all other open dropdowns
  document.querySelectorAll('.nac-wrapper.open').forEach(w => {
    w.classList.remove('open');
    w.querySelector('.nac-dropdown').style.display = 'none';
  });

  if (!isOpen) {
    wrap.classList.add('open');
    drop.style.display = 'block';
    initNac(pfx);
    if (search) { search.value = ''; search.focus(); }
  }
}

function filterNac(pfx, query) {
  const list = document.getElementById('nac-list-' + pfx);
  if (list) list.innerHTML = nacListHTML(pfx, query);
}

function selectNac(pfx, code, flag, name) {
  document.getElementById(pfx + '-nac').value = code;
  const lbl  = document.getElementById('nac-lbl-' + pfx);
  const flg  = document.getElementById('nac-flag-' + pfx);
  if (lbl)  { lbl.textContent = name; lbl.classList.remove('placeholder'); }
  if (flg)  { flg.textContent = flag; }
  // close
  const wrap = document.getElementById('nac-' + pfx);
  const drop = document.getElementById('nac-drop-' + pfx);
  if (wrap) wrap.classList.remove('open');
  if (drop) drop.style.display = 'none';
  // rebuild list to update selected state
  const list = document.getElementById('nac-list-' + pfx);
  if (list) { list.innerHTML = nacListHTML(pfx, ''); }
}

/* Set nationality value (for populateForm) */
function setNac(pfx, code) {
  if (!code) return;
  const all = [...NAC_TOP, ...NAC_ALL];
  const c   = all.find(x => x.code === code);
  if (c) selectNac(pfx, c.code, c.flag, c.name);
}

/* Get nationality display string for printing */
function getNacDisplay(code) {
  if (!code) return '';
  const all = [...NAC_TOP, ...NAC_ALL];
  const c   = all.find(x => x.code === code);
  return c ? c.flag + ' ' + c.name : code;
}

/* Close dropdown when clicking outside */
document.addEventListener('click', e => {
  if (!e.target.closest('.nac-wrapper')) {
    document.querySelectorAll('.nac-wrapper.open').forEach(w => {
      w.classList.remove('open');
      w.querySelector('.nac-dropdown').style.display = 'none';
    });
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => { bootApp().catch(console.error); });

/* Utility: toggle password visibility */
function togglePass(inputId, btn) {
  const inp = document.getElementById(inputId);
  if (!inp) return;
  inp.type = inp.type === 'password' ? 'text' : 'password';
  btn.textContent = inp.type === 'password' ? '👁' : '🙈';
}
