/* ==========================================================================
   BELEZA RARA – Fichas de Anamnese  v3
   ========================================================================== */
'use strict';

/* ── Escape HTML para prevenir XSS ── */
function esc(str) {
  if (!str && str !== 0) return '';
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#x27;');
}


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
  pestanas:     'Extensão de Pestanas',
  depilacao:    'Depilação',
  laser:        'Depilação Laser de Diodo',
  manicure:     'Manicure',
  facial:       'Anamnese Facial',
  microblading: 'Microblading',
};

// Map proc names to their canvas prefixes (cliente, profissional)
const SIG_PREFIXES = {
  pestanas:     ['p',  'pp'],
  depilacao:    ['d',  'dp'],
  laser:        ['l',  'lp'],
  manicure:     ['m',  'mp'],
  facial:       ['fa', 'fap'],
  microblading: ['mb', 'mbp'],
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
  const [sigCli, sigProf] = SIG_PREFIXES[proc] || [proc[0], proc[0]+'p'];
  initSignaturePad(sigCli);    // assinatura da cliente
  initSignaturePad(sigProf);   // assinatura do profissional
  window.scrollTo(0, 0);
}

function _doGoBack() {
  document.querySelectorAll('.screen').forEach(s => { s.style.display='none'; s.classList.remove('active'); });
  document.getElementById('screen-form').style.display   = 'none';
  document.getElementById('screen-fichas').style.display = 'none';
  const sel = document.getElementById('screen-select');
  sel.style.display = 'flex'; sel.classList.add('active');
}
function goBack() {
  checkBackupBeforeExit(_doGoBack);
}

function showFichas() {
  document.querySelectorAll('.screen').forEach(s => { s.style.display='none'; s.classList.remove('active'); });
  document.getElementById('screen-fichas').style.display = 'flex';
  renderFichasList();
}

function _doBackFromFichas() {
  document.getElementById('screen-fichas').style.display = 'none';
  const sel2 = document.getElementById('screen-select');
  sel2.style.display = 'flex'; sel2.classList.add('active');
}
function backFromFichas() {
  checkBackupBeforeExit(_doBackFromFichas);
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
        <div class="ficha-card-nome">${esc(f.nome) || '(sem nome)'}</div>
        <div class="ficha-card-meta">
          <span class="ficha-badge">${PROC_LABELS[f.proc] || f.proc}</span>
          <span class="ficha-date">${formatDate(f.dataRegisto) || ''}</span>
        </div>
      </div>
      <div class="ficha-card-actions">
        <button class="btn-ficha-open"  onclick="openFicha(${f.id})">✏️ Abrir</button>
        <button class="btn-ficha-print" onclick="loadAndPrint(${f.id})">📄 PDF</button>
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
      // Procedimento
      estilo:       val('p-estilo') === 'Outro' ? val('p-estilo-outro') : val('p-estilo'),
      curv:         getRadio('p-curvatura') === 'Outra' ? val('p-curvatura-outro') : getRadio('p-curvatura'),
      esp:          stepperGet('p-espessura'),
      comprimento:  stepperGet('p-comprimento'),
      volume:       getRadio('p-volume'),
      densidade:    getRadio('p-densidade'),
      modelo:       val('p-modelo'),
      fezExt:       getRadio('p-fez-ext'),
      extDuracao:   val('p-ext-duracao'),
      // Avaliação — obs com IDs explícitos (não depende de índice)
      gest:    getRadio('p-gestante'), gestObs:   val('p-obs-gest'),
      proc_ol: getRadio('p-proced'),  procObs:   val('p-obs-proced'),
      aler:    getRadio('p-alergia'), alerObs:   val('p-obs-aler'),
      glau:    getRadio('p-glaucoma'),glauObs:   val('p-obs-glau'),
      onco:    getRadio('p-onco'),    oncoObs:   val('p-obs-onco'),
      rimel:   getRadio('p-rimel'),   rimelObs:  val('p-obs-rimel'),
      // Consentimento — 14 perguntas
      cAler: getRadio('c-alergia'),         cAlerEsp: val('c-alergia-esp'),
      cOcul: getRadio('c-ocular'),          cOculEsp: val('c-ocular-esp'),
      cCiru: getRadio('c-cirurgia'),        cCiruEsp: val('c-cirurgia-esp'),
      cLent: getRadio('c-lentes'),          cLentRetira: getRadio('c-lentes-retira'),
      cIrri: getRadio('c-irritacao'),       cIrriEsp: val('c-irritacao-esp'),
      cAlPatch: getRadio('c-alergia-patches'),
      cReacExt: getRadio('c-reacao-ext'),   cReacExtEsp: val('c-reacao-ext-esp'),
      cColirio: getRadio('c-colirio'),      cColirioEsp: val('c-colirio-esp'),
      cCiruPrev: getRadio('c-cirurgia-prev'), cCiruPrevEsp: val('c-cirurgia-prev-esp'),
      cFotofobia: getRadio('c-fotofobia'),
      cDermato: getRadio('c-dermato'),      cDermatoEsp: val('c-dermato-esp'),
      cMaquiagem: getRadio('c-maquiagem'),
      cEsfregar: getRadio('c-esfregar'),
      cNatacao: getRadio('c-natacao'),
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
      // Procedimento Desejado
      nailType:      val('m-nail-type') === 'Outro' ? val('m-nail-type-outro') : val('m-nail-type'),
      material:      getRadio('m-material') === 'Outro' ? val('m-material-outro') : getRadio('m-material'),
      molde:         getRadio('m-molde') === 'Outro' ? val('m-molde-outro') : getRadio('m-molde'),
      corNova:       getRadio('m-cor-nova') === 'Outras' ? val('m-cor-nova-outro') : getRadio('m-cor-nova'),
      corCodigo:     val('m-cor-codigo'),
      // Histórico (actualizado)
      histoTecnica:  getRadio('m-tecnica-histo') === 'Outro' ? val('m-tecnica-outro') : getRadio('m-tecnica-histo'),
      corHisto:      getRadio('m-cor-histo') === 'Outras' ? val('m-cor-histo-outro') : getRadio('m-cor-histo'),
      // informações de saúde
      alergia: getRadio('m-alergia'),
      alergiaEsp: val('m-alergia-esp'),
      alergiaMarcaYN: getRadio('m-alergia-marca-yn'), alergiaMarca: val('m-alergia-marca'),
      condicao: getRadio('m-condicao'), condicaoEsp: val('m-condicao-esp'),
      gravida: getRadio('m-gravida'),
      // histórico
      histo: getRadio('m-histo'),
      tecnica: getCheckboxes('m-tecnica'), tecnicaOutra: val('m-tecnica-outra'),
      problema: getRadio('m-problema'), problemaEsp: val('m-problema-esp'),
      // adicionais
      manutencao: getRadio('m-manutencao'),
      pergunta: getRadio('m-pergunta'), perguntaEsp: val('m-pergunta-esp'),
      imgAuth: getRadio('m-imagem'),
      sigDataURL: sigGetDataURL('m'),
    };
  }

  // ── FACIAL ──
  if (currentProc === 'facial') {
    const sess = [];
    document.querySelectorAll('#fa-sessoes-body tr').forEach(tr => {
      const cells = tr.querySelectorAll('input,textarea');
      if (cells.length >= 3) {
        const row = [cells[0].value, cells[1].value, cells[2].value];
        if (row.some(v => v.trim())) sess.push(row);
      }
    });
    return {
      proc: 'facial', dataRegisto: now,
      nome: val('fa-nome'), nasc: val('fa-nasc'), idade: val('fa-idade'),
      sexo: getRadio('fa-sexo'), tel: val('fa-tel'), social: val('fa-social'),
      morada: val('fa-morada'), email: val('fa-email'), doc: val('fa-doc'),
      nac: val('fa-nac'),
      atendData: val('fa-atend-data'), profissional: val('fa-profissional'),
      sigProfDataURL: sigGetDataURL('fap'),
      sol: getRadio('fa-sol'), glicemico: getRadio('fa-glicemico'),
      intestinal: getRadio('fa-intestinal'),
      tratAnt: getRadio('fa-trat-ant'), tratAntEsp: val('fa-trat-ant-esp'),
      agua: getRadio('fa-agua'), alcool: getRadio('fa-alcool'),
      filtro: getRadio('fa-filtro'), menstrual: getRadio('fa-menstrual'),
      sono: getRadio('fa-sono'), protese: getRadio('fa-protese'),
      tabaco: getRadio('fa-tabaco'), cardiaco: getRadio('fa-cardiaco'),
      marcapasso: getRadio('fa-marcapasso'),
      gestante: getRadio('fa-gestante'), gestanteSemanas: val('fa-gestante-semanas'),
      cremes: getRadio('fa-cremes'), cremesEsp: val('fa-cremes-esp'),
      atividade: getRadio('fa-atividade'), atividadeEsp: val('fa-atividade-esp'),
      anticonc: getRadio('fa-anticonc'), anticoncEsp: val('fa-anticonc-esp'),
      alergia: getRadio('fa-alergia'), alergiaEsp: val('fa-alergia-esp'),
      roacutan: getRadio('fa-roacutan'),
      pele: getRadio('fa-pele'), peleEsp: val('fa-pele-esp'),
      biotipo: getRadio('fa-biotipo'),
      cravos: getRadio('fa-cravos'), pustulas: getRadio('fa-pustulas'),
      nodulos: getRadio('fa-nodulos'), millium: getRadio('fa-millium'),
      espessura: getRadio('fa-espessura'), fototipo: getRadio('fa-fototipo'),
      envelhecimento: getRadio('fa-envelhecimento'),
      ostios: getRadio('fa-ostios'), cicHiper: getRadio('fa-cic-hiper'),
      queloide: getRadio('fa-queloide'),
      melasma: getRadio('fa-melasma'), cloasma: getRadio('fa-cloasma'),
      hpi: getRadio('fa-hpi'), efelides: getRadio('fa-efelides'),
      melanose: getRadio('fa-melanose'),
      hipoLesao: getRadio('fa-hipo-lesao'), hipoRad: getRadio('fa-hipo-rad'),
      hipoOutro: getRadio('fa-hipo-outro'), hipoOutroEsp: val('fa-hipo-outro-esp'),
      cuidados: val('fa-cuidados'),
      indicacaoTrat: val('fa-indicacao-trat'), homeCare: val('fa-home-care'),
      sessions: sess,
      imgAuth: getRadio('fa-imagem'), sigDataURL: sigGetDataURL('fa'),
    };
  }

  // ── MICROBLADING ──
  if (currentProc === 'microblading') {
    return {
      proc: 'microblading', dataRegisto: now,
      nome: val('mb-nome'), nasc: val('mb-nasc'), idade: val('mb-idade'),
      sexo: getRadio('mb-sexo'), tel: val('mb-tel'), email: val('mb-email'),
      morada: val('mb-morada'), doc: val('mb-doc'), nac: val('mb-nac'),
      atendData: val('mb-atend-data'), profissional: val('mb-profissional'),
      sigProfDataURL: sigGetDataURL('mbp'),
      gestante: getRadio('mb-gestante'), gestanteEsp: val('mb-gestante-esp'),
      diabetes: getRadio('mb-diabetes'), coagulacao: getRadio('mb-coagulacao'),
      queloide: getRadio('mb-queloide'), doencasSang: getRadio('mb-doencas-sang'),
      alergia: getRadio('mb-alergia'), alergiaEsp: val('mb-alergia-esp'),
      anticoag: getRadio('mb-anticoag'), pele: getRadio('mb-pele'),
      cirurgia: getRadio('mb-cirurgia'), onco: getRadio('mb-onco'),
      epilepsia: getRadio('mb-epilepsia'), autoimune: getRadio('mb-autoimune'),
      acneTrat: getRadio('mb-acne-trat'), glaucoma: getRadio('mb-glaucoma'),
      solar: getRadio('mb-solar'),
      tatooPrev: getRadio('mb-tatoo-prev'), tatooEsp: val('mb-tatoo-prev-esp'),
      es: val('mb-es'), ts: val('mb-ts'), tc: val('mb-tc'), tca: val('mb-tca'),
      epi: getRadio('mb-epi'), epc: val('mb-epc'),
      apib: val('mb-apib'), apia: val('mb-apia'),
      apcb: val('mb-apcb'), apca: val('mb-apca'), apf: val('mb-apf'),
      obsTecnica: val('mb-obs-tecnica'),
      imgAuth: getRadio('mb-imagem'), sigDataURL: sigGetDataURL('mb'),
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
    // Procedimento
    setVal('p-estilo', d.estilo); estiloSelectChange('p-estilo','p-estilo-outro');
    if (d.curv) {
      const knownCurves = ['A(j)','B','C','C+','CC','D','DD/U','I','L','LC/L+','M'];
      if (knownCurves.includes(d.curv)) { setRadio('p-curvatura', d.curv); }
      else { setRadio('p-curvatura','Outra'); setVal('p-curvatura-outro', d.curv); }
      pillaOutroChange('p-curvatura','p-curvatura-outro');
    }
    stepperSet('p-espessura', d.esp || '0.10');
    stepperSet('p-comprimento', d.comprimento || '10');
    setRadio('p-volume', d.volume); setRadio('p-densidade', d.densidade);
    setVal('p-modelo', d.modelo);
    setRadio('p-fez-ext', d.fezExt); setVal('p-ext-duracao', d.extDuracao); fezExtChange();
    // Atendimento
    document.getElementById('p-atend-data') && (document.getElementById('p-atend-data').value = d.atendData||'');
    document.getElementById('p-profissional') && (document.getElementById('p-profissional').value = d.profissional||'');
    if (d.sigProfDataURL) setTimeout(() => sigSetDataURL('pp', d.sigProfDataURL), 100);
    // Avaliação — restore radio + obs
    setRadio('p-gestante', d.gest);  setVal('p-obs-gest',  d.gestObs);
    setRadio('p-proced',   d.proc_ol); setVal('p-obs-proced', d.procObs);
    setRadio('p-alergia',  d.aler);  setVal('p-obs-aler',  d.alerObs);
    setRadio('p-glaucoma', d.glau);  setVal('p-obs-glau',  d.glauObs);
    setRadio('p-onco',     d.onco);  setVal('p-obs-onco',  d.oncoObs);
    setRadio('p-rimel',    d.rimel); setVal('p-obs-rimel', d.rimelObs);
    // Consentimento — 14 perguntas
    setRadio('c-alergia', d.cAler);            setVal('c-alergia-esp', d.cAlerEsp);
    setRadio('c-ocular', d.cOcul);             setVal('c-ocular-esp', d.cOculEsp);
    setRadio('c-cirurgia', d.cCiru);           setVal('c-cirurgia-esp', d.cCiruEsp);
    setRadio('c-lentes', d.cLent);
    if (d.cLent === 'SIM') {
      const lSub = document.getElementById('c-lentes-sub');
      if (lSub) lSub.style.display = 'flex';
    }
    setRadio('c-lentes-retira', d.cLentRetira);
    setRadio('c-irritacao', d.cIrri);          setVal('c-irritacao-esp', d.cIrriEsp);
    setRadio('c-alergia-patches', d.cAlPatch);
    setRadio('c-reacao-ext', d.cReacExt);      setVal('c-reacao-ext-esp', d.cReacExtEsp);
    setRadio('c-colirio', d.cColirio);         setVal('c-colirio-esp', d.cColirioEsp);
    setRadio('c-cirurgia-prev', d.cCiruPrev);  setVal('c-cirurgia-prev-esp', d.cCiruPrevEsp);
    setRadio('c-fotofobia', d.cFotofobia);
    setRadio('c-dermato', d.cDermato);         setVal('c-dermato-esp', d.cDermatoEsp);
    setRadio('c-maquiagem', d.cMaquiagem);
    setRadio('c-esfregar', d.cEsfregar);
    setRadio('c-natacao', d.cNatacao);
    setRadio('p-imagem', d.imgAuth);
    // Restore conditional sub-fields visibility
    ['c-alergia','c-ocular','c-cirurgia','c-lentes','c-irritacao',
     'c-reacao-ext','c-colirio','c-cirurgia-prev','c-dermato'].forEach(name => {
      const el = document.querySelector(`input[name="${name}"][value="SIM"]`);
      if (el && el.checked) toggleSub(name+'-sub', el, 'SIM');
    });
    // obs fields restored above by explicit ID
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

  if (d.proc === 'facial') { populateFacial(d); return; }
  if (d.proc === 'microblading') { populateMicroblading(d); return; }
    if (d.proc === 'manicure') {
    setVal('m-nome', d.nome); setVal('m-nasc', d.nasc);
    document.getElementById('m-idade').value = d.nasc ? calcIdade(d.nasc) : (d.idade || '');
    setVal('m-sexo', d.sexo); setVal('m-tel', d.tel);
    setVal('m-morada', d.morada); setVal('m-email', d.email);
    setVal('m-doc', d.doc); setNac('m', d.nac);
    // Atendimento
    document.getElementById('m-atend-data') && (document.getElementById('m-atend-data').value = d.atendData||'');
    document.getElementById('m-profissional') && (document.getElementById('m-profissional').value = d.profissional||'');
    if (d.sigProfDataURL) setTimeout(() => sigSetDataURL('mp', d.sigProfDataURL), 100);
    // Procedimento Desejado
    if (d.nailType) {
      const knownNail = ['Amêndoa (Almond)','Flecha (Arrow)','Bailarina (Coffin/Ballerina)','Aresta (Edge)',
        'Leque (Flare)','Batom (Lipstick)','Pico de Montanha (Mountain Peak)','Ovais (Oval)',
        'Arredondada (Rounded)','Quadrada (Square)','Quadrada com Canto Arredondado (Squoval)','Stiletto'];
      const nsEl = document.getElementById('m-nail-type');
      if (nsEl) {
        if (knownNail.some(n => n === d.nailType)) { nsEl.value = d.nailType; }
        else { nsEl.value = 'Outro'; const ot=document.getElementById('m-nail-type-outro'); if(ot){ot.value=d.nailType;ot.style.display='block';} }
      }
    }
    (['m-material','m-molde']).forEach(name => {
      const fieldKey = name === 'm-material' ? 'material' : 'molde';
      if (d[fieldKey]) {
        setRadio(name, d[fieldKey]);
        const r = document.querySelector(`input[name="${name}"]:checked`);
        const o = document.getElementById(name+'-outro');
        if (r && r.value === 'Outro' && o) { o.value = d[fieldKey]; o.style.display='block'; }
      }
    });
    if (d.corNova) {
      const knownCor = ['Claras / Nude','Escuras / Profundas','Pastel','Vibrantes / Neon','Neutras / Simples'];
      if (knownCor.includes(d.corNova)) setRadio('m-cor-nova', d.corNova);
      else { setRadio('m-cor-nova','Outras'); const oc=document.getElementById('m-cor-nova-outro'); if(oc){oc.value=d.corNova;oc.style.display='block';} }
    }
    setVal('m-cor-codigo', d.corCodigo);
    // Histórico
    setRadio('m-histo', d.histo);
    const mHistoSIMEl = document.querySelector('input[name="m-histo"][value="SIM"]');
    if (mHistoSIMEl && mHistoSIMEl.checked) { const sub=document.getElementById('m-histo-sub'); if(sub)sub.style.display='flex'; }
    if (d.histoTecnica) {
      const knownTec = ['Gel','Acrílico (Porcelana)','Fibra de vidro'];
      if (knownTec.includes(d.histoTecnica)) setRadio('m-tecnica-histo', d.histoTecnica);
      else { setRadio('m-tecnica-histo','Outro'); const ot2=document.getElementById('m-tecnica-outro'); if(ot2){ot2.value=d.histoTecnica;ot2.style.display='block';} }
    }
    if (d.corHisto) {
      const knownCorH = ['Claras / Nude','Escuras / Profundas','Pastel','Vibrantes / Neon','Neutras / Simples'];
      if (knownCorH.includes(d.corHisto)) setRadio('m-cor-histo', d.corHisto);
      else { setRadio('m-cor-histo','Outras'); const och=document.getElementById('m-cor-histo-outro'); if(och){och.value=d.corHisto;och.style.display='block';} }
    }
    setRadio('m-alergia', d.alergia);
    if (d.alergia === 'SIM') { const s=document.getElementById('m-alergia-sub'); if(s)s.style.display='flex'; }
    setVal('m-alergia-esp', d.alergiaEsp);
    setRadio('m-alergia-marca-yn', d.alergiaMarcaYN);
    if (d.alergiaMarcaYN === 'SIM') { const s=document.getElementById('m-alergia-marca-sub'); if(s)s.style.display='flex'; }
    setVal('m-alergia-marca', d.alergiaMarca); setVal('m-alergia-esp', d.alergiaEsp);
    setVal('m-alergia-marca', d.alergiaMarca);
    setRadio('m-condicao', d.condicao);
    if (d.condicao === 'SIM') { const s=document.getElementById('m-condicao-sub'); if(s)s.style.display='flex'; } setVal('m-condicao-esp', d.condicaoEsp);
    setRadio('m-gravida', d.gravida);
    setRadio('m-histo', d.histo);
    (d.tecnica || []).forEach(v => {
      const el = document.querySelector(`input[name="m-tecnica"][value="${v}"]`);
      if (el) el.checked = true;
    });
    setVal('m-tecnica-outra', d.tecnicaOutra);
    setRadio('m-problema', d.problema); setVal('m-problema-esp', d.problemaEsp);
    setRadio('m-manutencao', d.manutencao);
    setRadio('m-pergunta', d.pergunta);
    if (d.pergunta === 'SIM') { const s=document.getElementById('m-pergunta-sub'); if(s)s.style.display='flex'; } setVal('m-pergunta-esp', d.perguntaEsp);
    setRadio('m-imagem', d.imgAuth);
    if (d.sigDataURL) setTimeout(() => sigSetDataURL('m', d.sigDataURL), 100);
  }
}

function clearFormFields() {
  if (!currentProc) return;
  document.getElementById('form-' + currentProc)
    .querySelectorAll('input, select, textarea')
    .forEach(el => {
      if (el.type === 'radio' || el.type === 'checkbox') el.checked = false;
      else if (el.classList.contains('stepper-input')) {
        // Reset steppers to their default values instead of clearing
        const cfg = STEPPER_CFG[el.id];
        if (cfg) el.value = cfg.default !== undefined
          ? cfg.default.toFixed(cfg.decimals)
          : cfg.min.toFixed(cfg.decimals);
      }
      else el.value = '';
    });
  const tbody = document.getElementById('sessions-tbody');
  if (tbody) { tbody.innerHTML = ''; addSessionRow(); }
  // Clear signature pads (cliente + profissional)
  const [sigCli2, sigProf2] = SIG_PREFIXES[currentProc] || [currentProc[0], currentProc[0]+'p'];
  sigClear(sigCli2);  if (_sig[sigCli2])  _sig[sigCli2].hasStroke  = false;
  sigClear(sigProf2); if (_sig[sigProf2]) _sig[sigProf2].hasStroke = false;
  // Reset NAC visual display (flag + label) for current form
  const nacPfx = currentProc === 'facial' ? 'fa' : currentProc === 'microblading' ? 'mb' : currentProc[0];
  const nacLbl = document.getElementById('nac-lbl-' + nacPfx);
  const nacFlg = document.getElementById('nac-flag-' + nacPfx);
  const nacHid = document.getElementById(nacPfx + '-nac');
  if (nacLbl) { nacLbl.textContent = 'Selecionar país…'; nacLbl.classList.add('placeholder'); }
  if (nacFlg) nacFlg.textContent = '';
  if (nacHid) nacHid.value = '';
  const nacList = document.getElementById('nac-list-' + nacPfx);
  if (nacList) { nacList.innerHTML = ''; nacList.dataset.built = ''; }
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
  return `<svg viewBox="0 0 463 463" xmlns="http://www.w3.org/2000/svg" style="width:44px;height:44px;flex-shrink:0;">
    <rect x="0" y="0" width="463" height="463" rx="72" fill="white"/>
    <rect x="4" y="4" width="455" height="455" rx="69" fill="none" stroke="#e36485" stroke-width="8"/>
    <g fill="#e36485"><path d="m359.5,16h-96c-0.089,0-0.176,0.01-0.264,0.013-7.203-9.708-18.746-16.013-31.736-16.013s-24.533,6.305-31.736,16.013c-0.088-0.003-0.175-0.013-0.264-0.013h-96c-26.191,0-47.5,21.309-47.5,47.5v352c0,26.191 21.309,47.5 47.5,47.5h256c26.191,0 47.5-21.309 47.5-47.5v-352c0-26.191-21.309-47.5-47.5-47.5zm-128-1c13.51,0 24.5,10.991 24.5,24.5v8c0,4.142 3.357,7.5 7.5,7.5h32c4.687,0 8.5,3.813 8.5,8.5s-3.813,8.5-8.5,8.5h-128c-4.687,0-8.5-3.813-8.5-8.5s3.813-8.5 8.5-8.5h32c4.143,0 7.5-3.358 7.5-7.5v-8c0-13.509 10.99-24.5 24.5-24.5zm160,329.5h-256c-0.275,0-0.5-0.224-0.5-0.5v-352c0-0.276 0.225-0.5 0.5-0.5h40.513c-0.004,0.167-0.013,0.332-0.013,0.5 0,12.958 10.542,23.5 23.5,23.5h128c12.958,0 23.5-10.542 23.5-23.5 0-0.168-0.009-0.333-0.013-0.5h40.513c0.275,0 0.5,0.224 0.5,0.5v352c0,0.276-0.225,0.5-0.5,0.5z"/><path d="m231.5,63c4.143,0 7.5-3.358 7.5-7.5v-16c0-4.142-3.357-7.5-7.5-7.5s-7.5,3.358-7.5,7.5v16c0,4.142 3.357,7.5 7.5,7.5z"/><path d="m223.5,175h96c4.143,0 7.5-3.358 7.5-7.5s-3.357-7.5-7.5-7.5h-96c-4.143,0-7.5,3.358-7.5,7.5s3.357,7.5 7.5,7.5z"/><path d="m138.196,162.197c-2.929,2.929-2.929,7.678 0,10.606l16,16c1.465,1.464 3.385,2.197 5.304,2.197s3.839-0.732 5.304-2.197l32-32c2.929-2.929 2.929-7.678 0-10.606-2.93-2.929-7.678-2.929-10.607,0l-26.697,26.697-10.696-10.697c-2.93-2.929-7.678-2.929-10.608,0z"/><path d="m223.5,255h96c4.143,0 7.5-3.358 7.5-7.5s-3.357-7.5-7.5-7.5h-96c-4.143,0-7.5,3.358-7.5,7.5s3.357,7.5 7.5,7.5z"/><path d="m186.196,226.197l-26.696,26.697-10.696-10.697c-2.93-2.929-7.678-2.929-10.607,0s-2.929,7.678 0,10.606l16,16c1.465,1.464 3.385,2.197 5.304,2.197s3.839-0.732 5.304-2.197l32-32c2.929-2.929 2.929-7.678 0-10.606-2.931-2.929-7.679-2.929-10.609,0z"/><path d="m223.5,335h96c4.143,0 7.5-3.358 7.5-7.5s-3.357-7.5-7.5-7.5h-96c-4.143,0-7.5,3.358-7.5,7.5s3.357,7.5 7.5,7.5z"/><path d="m186.196,306.197l-26.696,26.697-10.696-10.697c-2.93-2.929-7.678-2.929-10.607,0s-2.929,7.678 0,10.606l16,16c1.465,1.464 3.385,2.197 5.304,2.197s3.839-0.732 5.304-2.197l32-32c2.929-2.929 2.929-7.678 0-10.606-2.931-2.929-7.679-2.929-10.609,0z"/></g>
  </svg>`;
}

function printHeader(title) {
  return `<div class="pd-header">
    <div class="pd-logo-row">
      ${logoSVG()}
      <div class="pd-title-bar" style="flex:1;margin:0;">${title}</div>
    </div>
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
  const dataFmt = formatDate(d.atendData || d.data || '');

  const p1 = `<div class="pd-page">
    ${printHeader('FICHA DE ANAMNESE – EXTENSÃO DE PESTANAS')}
    ${dadosClienteBlock(d)}
    ${atendimentoBlock(d)}
    <div class="pd-section-title">AVALIAÇÃO</div>
    ${makeYnTable([
      ['É gestante ou lactante?' + (d.gestObs ? ' – ' + d.gestObs : ''), d.gest],
      ['Já fez procedimento nos olhos?'           + (d.procObs  ? ' – ' + d.procObs  : ''), d.proc_ol],
      ['Possui alergia a esmalte ou cosméticos?'   + (d.alerObs  ? ' – ' + d.alerObs  : ''), d.aler],
      ['Possui glaucoma ou problema ocular?'        + (d.glauObs  ? ' – ' + d.glauObs  : ''), d.glau],
      ['Faz tratamento oncológico?'                 + (d.oncoObs  ? ' – ' + d.oncoObs  : ''), d.onco],
      ['Está de rímel?'                             + (d.rimelObs ? ' – ' + d.rimelObs : ''), d.rimel],
    ])}
    <div class="pd-section-title">PROCEDIMENTO</div>
    ${makeFields([
      [['Estilo:', d.estilo]],
      [['Curvatura:', d.curv], ['Espessura:', (d.esp||'')+'mm'], ['Comprimento:', (d.comprimento||'')+'mm']],
      [['Volume:', d.volume], ['Densidade:', d.densidade]],
      [['Modelo dos fios:', d.modelo]],
      [['Já fez extensão antes?', d.fezExt==='SIM'?'Sim — duração: '+(d.extDuracao||'N/D'):d.fezExt==='NÃO'?'Não':'']],
    ])}
    <div class="pd-section-title">CONSENTIMENTO – QUESTIONÁRIO DE SAÚDE</div>
    <table class="pd-yn-table">
      ${[
        ['1) Alergia a látex, acrilatos, esmalte, cosméticos, colas?', d.cAler, d.cAlerEsp ? 'Substância/reação: '+d.cAlerEsp : ''],
        ['2) Antecedentes de problemas oculares?', d.cOcul, d.cOculEsp ? 'Problema: '+d.cOculEsp : ''],
        ['3) Cirurgia ocular nos últimos 6 meses?', d.cCiru, d.cCiruEsp ? 'Procedimento: '+d.cCiruEsp : ''],
        ['4) Utiliza lentes de contacto?', d.cLent, d.cLentRetira ? 'Retira antes: '+d.cLentRetira : ''],
        ['5) Irritação ou sensibilidade ocular hoje?', d.cIrri, d.cIrriEsp ? 'Qual: '+d.cIrriEsp : ''],
        ['6) Alergia a colas, micropore, fita ou patches?', d.cAlPatch, ''],
        ['7) Reação alérgica prévia a extensões?', d.cReacExt, d.cReacExtEsp ? 'Sintomas: '+d.cReacExtEsp : ''],
        ['8) Uso de colírio medicamentoso?', d.cColirio, d.cColirioEsp ? 'Qual: '+d.cColirioEsp : ''],
        ['9) Já realizou cirurgia ocular (LASIK, catarata)?', d.cCiruPrev, d.cCiruPrevEsp ? 'Há quanto tempo: '+d.cCiruPrevEsp : ''],
        ['10) Sensibilidade à luz (fotofobia)?', d.cFotofobia, ''],
        ['11) Tratamento dermatológico no rosto actualmente?', d.cDermato, d.cDermatoEsp ? 'Especificação: '+d.cDermatoEsp : ''],
        ['12) Usa maquiagem pesada nos olhos com frequência?', d.cMaquiagem, ''],
        ['13) Esfrega os olhos com frequência?', d.cEsfregar, ''],
        ['14) Pratica natação ou actividades aquáticas?', d.cNatacao, ''],
      ].map(([q, v, obs]) => {
        const sim = normYn(v)==='SIM', nao = normYn(v)==='NAO';
        return `<tr>
          <td class="pd-yn-q" style="width:60%">${q}${obs ? `<div style="font-size:8pt;color:#555;margin-top:2px;">↳ ${obs}</div>` : ''}</td>
          <td class="pd-yn-a">
            <span class="print-box${sim?' checked':''}"></span><span class="print-box-label">SIM</span>
            &nbsp;<span class="print-box${nao?' checked':''}"></span><span class="print-box-label">NÃO</span>
            ${v && v!=='SIM' && v!=='NÃO' ? `<span style="font-size:8pt;color:#555;">&nbsp;${v}</span>` : ''}
          </td>
        </tr>`;
      }).join('')}
    </table>
        ${sigRow([['Assinatura da Cliente',''],['Data do Procedimento', dataFmt]], d.sigDataURL, d.sigProfDataURL)}
  </div>`;

  const p2 = `<div class="pd-page">
    ${printHeader('TERMO DE CONSENTIMENTO E RESPONSABILIDADE: EXTENSÃO DE PESTANAS')}
    ${fieldLine('Nome:', d.nome)}
    <div style="margin-top:5mm;" class="pd-consent-text">
      <p><b>1. Natureza do Procedimento</b> — Declaro que fui devidamente esclarecida sobre a técnica de extensão de pestanas, que consiste na aplicação de fios sintéticos individuais ou em leque sobre as minhas pestanas naturais, utilizando uma cola (adesivo) específica para uso ocular.</p>
      <p><b>2. Riscos Possíveis</b> — Embora o procedimento seja estético e não invasivo, podem ocorrer: <b>Irritação Ocular</b> (vermelhidão, lacrimejo nas primeiras 24h); <b>Reações Alérgicas</b> (inchaço, prurido ou dermatite de contacto); <b>Sensibilidade aos Vapores</b> (ardência momentânea); <b>Queda Prematura</b> (se não forem cumpridos os cuidados de manutenção).</p>
      <p><b>3. Pós-Tratamento</b> — Comprometo-me a: 1) Não molhar nas primeiras 24h; 2) Evitar vapores quentes nas primeiras 48h; 3) Não usar produtos oleosos na zona ocular; 4) Higienizar diariamente com lash shampoo; 5) Remoção obrigatória por profissional.</p>
      <p><b>4. Consentimento</b> — Autorizo a realização do procedimento e assumo responsabilidade pelos cuidados posteriores.</p>
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
  </div>`;

  const p2 = `<div class="pd-page">
    ${printHeader('REGISTO DE SESSÕES – DEPILAÇÃO A LASER DE DIODO')}
    <div style="margin-bottom:3mm;font-size:8.5pt;color:#555;">Data de início: <strong>${dataFmt}</strong> &nbsp;|&nbsp; Cliente: <strong>${d.nome||''}</strong></div>
    <table class="pd-sessions-table">
      <thead><tr><th>Sessão</th><th>Data</th><th>Zona</th><th>FotoTipo</th><th>Pulso</th><th>Frequência</th><th>Energia</th><th>Duração</th><th>Passagens na Zona</th><th>Resultados Sessão Anterior</th></tr></thead>
      <tbody>${sessHTML}</tbody>
    </table>
    ${imagemBlock(d.imgAuth)}
    ${sigRow([['Assinatura da Cliente',''],['Assinatura da Técnica',''],['Data do Procedimento', dataFmt]], d.sigDataURL, d.sigProfDataURL)}
  </div>`;

  return p1 + p2;
}

/* ── MANICURE ── */
function buildManicureHTML(d) {
  const dataFmt = formatDate(d.atendData || d.data || '');

  // ── helpers ──
  function ynBox(v, label) {
    const chk = normYn(v) === label.replace('Ã','A').replace('Ã','A');
    return `<span class="print-box${chk?' checked':''}"></span><span class="print-box-label">${label}</span>`;
  }

  // ── Histórico: técnica usada ──
  const tecnicaHisto = d.histoTecnica || '';
  const knownTec = ['Gel','Acrílico (Porcelana)','Fibra de vidro'];
  const tecHistoLine = tecnicaHisto
    ? `Técnica: <strong>${tecnicaHisto}</strong>`
    : '—';

  // ── Cor histórico ──
  const corHistoLine = d.corHisto || '—';

  // ── Procedimento Desejado ──
  const nailTypeLine   = d.nailType   || '—';
  const materialLine   = d.material   || '—';
  const moldeLine      = d.molde      || '—';
  const corNovaLine    = d.corNova    || '—';
  const corCodigoLine  = d.corCodigo  || '—';

  const p1 = `<div class="pd-page">
    ${printHeader('FICHA DE ANAMNESE – MANICURE')}
    ${dadosClienteBlock(d)}
    ${atendimentoBlock(d)}

    <div class="pd-section-title">CONSENTIMENTO – QUESTIONÁRIO DE SAÚDE</div>
    <table class="pd-yn-table">
      <tr>
        <td class="pd-yn-q" style="width:68%;">1) Tem alguma alergia a produtos químicos ou materiais? (cola, acrílico, gel, etc.)</td>
        <td class="pd-yn-a">
          <span class="print-box${normYn(d.alergia)==='SIM'?' checked':''}"></span><span class="print-box-label">SIM</span>&nbsp;&nbsp;<span class="print-box${normYn(d.alergia)==='NAO'?' checked':''}"></span><span class="print-box-label">NÃO</span>
        </td>
      </tr>
    </table>
    ${d.alergia==='SIM' ? `<div style="font-size:8.5pt;margin:2px 0 3px;padding-left:4px;">↳ ${esc(d.alergiaEsp||'—')}</div>` : ''}
    ${makeYnTable([
      ['1b) Tem alergia a alguma marca específica de produto?', d.alergiaMarcaYN],
    ])}
    ${d.alergiaMarcaYN==='SIM' ? `<div style="font-size:8.5pt;margin:2px 0 3px;padding-left:4px;">↳ Marca: ${esc(d.alergiaMarca||'—')}</div>` : ''}
    ${makeYnTable([
      ['2) Tem alguma condição médica que afeta as unhas ou pele das mãos? (fungos, psoríase, eczema, etc.)', d.condicao],
    ])}
    ${d.condicao==='SIM' ? `<div style="font-size:8.5pt;margin:2px 0 3px;padding-left:4px;">↳ ${esc(d.condicaoEsp||'—')}</div>` : ''}
    ${makeYnTable([
      ['3) Está grávida ou a amamentar?', d.gravida],
    ])}

    <div class="pd-section-title">HISTÓRICO DE ALONGAMENTO DE UNHAS</div>
    ${makeYnTable([
      ['4) Já fez alongamento de unhas anteriormente?', d.histo],
    ])}
    ${d.histo==='SIM' ? `<div style="font-size:8.5pt;margin:2px 0 3px;padding-left:4px;">↳ ${tecHistoLine}</div>` : ''}
    <div style="font-size:8.5pt;margin:3px 0 4px;">5) Cor Usada (Paleta): <strong>${corHistoLine}</strong></div>
    ${makeYnTable([
      ['6) Teve algum problema de alergia, infecção ou dano às unhas naturais em procedimento anterior?', d.problema],
    ])}
    ${d.problema==='SIM' ? `<div style="font-size:8.5pt;margin:2px 0 3px;padding-left:4px;">↳ ${esc(d.problemaEsp||'—')}</div>` : ''}

    <div class="pd-section-title">PROCEDIMENTO DESEJADO</div>
    ${makeFields([
      [['Tipo de Unha:', nailTypeLine], ['Material:', materialLine]],
      [['Molde:', moldeLine], ['Nova Cor (Paleta):', corNovaLine]],
      [['Código da Cor:', corCodigoLine]],
    ])}

    <div class="pd-section-title">INFORMAÇÕES ADICIONAIS</div>
    ${makeYnTable([
      ['7) Está ciente de que a manutenção regular é necessária para preservar o alongamento?', d.manutencao],
      ['8) Tem alguma pergunta ou preocupação específica sobre o procedimento?', d.pergunta],
    ])}
    ${d.pergunta==='SIM' ? `<div style="font-size:8.5pt;margin:2px 0 6px;padding-left:4px;">↳ ${esc(d.perguntaEsp||'—')}</div>` : ''}

    <div style="margin:5mm 0 3mm;font-size:8.5pt;line-height:1.55;color:#333;">
      <b>Declaração:</b> Declaro que as informações fornecidas acima são verdadeiras e completas. Entendo os riscos e benefícios do procedimento e concordo com a sua realização.
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

/* ── Carrega uma biblioteca JS de CDN (com cache por nome) ── */
const _libCache = {};
function loadLib(name, url) {
  if (_libCache[name]) return _libCache[name];
  _libCache[name] = new Promise((resolve, reject) => {
    if (name === 'jspdf'     && window.jspdf)    { resolve(window.jspdf);    return; }
    if (name === 'html2canvas' && window.html2canvas) { resolve(window.html2canvas); return; }
    const s = document.createElement('script');
    s.src = url; s.onload = () => resolve(window[name] || window.jspdf || window.html2canvas);
    s.onerror = () => reject(new Error('Falha ao carregar ' + name));
    document.head.appendChild(s);
  });
  return _libCache[name];
}

async function printFromData(proc, data) {
  // ── Botão de feedback ──
  const btnList = ['btn-print-main', 'btn-print'].map(c =>
    document.querySelector('.' + c + ':not([style*="display:none"])')).filter(Boolean);
  const origLabels = btnList.map(b => b.textContent);
  btnList.forEach(b => { b.textContent = '⏳ A gerar PDF…'; b.disabled = true; });

  try {
    // ── 1. Carregar bibliotecas (tenta cdnjs, fallback unpkg) ──
    async function tryLoad(name, urls) {
      // Check online status first (cached libs always work offline)
      if (!window.jspdf && !navigator.onLine) {
        throw new Error('Sem ligação à internet. O PDF requer ligação na primeira utilização para carregar as bibliotecas.');
      }
      for (const url of urls) {
        try {
          await loadLib(name, url);
          if (name === 'jspdf'       && window.jspdf)       return;
          if (name === 'html2canvas' && window.html2canvas)  return;
        } catch(e) { /* tenta próximo */ }
      }
      throw new Error('Não foi possível carregar ' + name + '. Verifique a ligação à internet.');
    }

    await tryLoad('jspdf', [
      'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
      'https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js',
    ]);
    await tryLoad('html2canvas', [
      'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
      'https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js',
    ]);

    const { jsPDF } = window.jspdf;

    // ── 2. Construir HTML da ficha ──
    let html = '';
    if (proc === 'pestanas')     html = buildPestanasHTML(data);
    if (proc === 'depilacao')    html = buildDepilacaoHTML(data);
    if (proc === 'laser')        html = buildLaserHTML(data);
    if (proc === 'manicure')     html = buildManicureHTML(data);
    if (proc === 'facial')       html = buildFacialHTML(data);
    if (proc === 'microblading') html = buildMicrobladingHTML(data);

    // ── 3. Renderizar num iframe oculto ──
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;height:1123px;border:none;visibility:hidden;';
    document.body.appendChild(iframe);

    await new Promise(resolve => {
      iframe.onload = resolve;
      iframe.srcdoc = `<!DOCTYPE html><html lang="pt"><head>
        <meta charset="UTF-8">
        <style>
          ${getPrintCSS()}
          body.print-body { background: white; margin: 0; padding: 0; }
          .pd-page { page-break-after: always; }
        </style>
      </head><body class="print-body">${html}</body></html>`;
    });

    // Aguardar imagens (assinaturas) e fontes
    await new Promise(r => setTimeout(r, 400));

    // ── 4. Capturar cada página como imagem ──
    const iDoc   = iframe.contentDocument;
    const pages  = iDoc.querySelectorAll('.pd-page');
    const pdf    = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const A4_W   = 210;   // mm
    const A4_H   = 297;   // mm
    const SCALE  = 2;     // resolução 2× para qualidade

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      // Reset any page-break styles for capture
      page.style.pageBreakAfter = 'avoid';
      page.style.margin = '0';

      const canvas = await window.html2canvas(page, {
        scale:           SCALE,
        useCORS:         true,
        allowTaint:      true,
        backgroundColor: '#ffffff',
        logging:         false,
        windowWidth:     794,
        width:           794,
        height:          page.scrollHeight,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const imgH    = (canvas.height / canvas.width) * A4_W;   // altura proporcional em mm

      if (i > 0) pdf.addPage();

      // Se a imagem cabe numa página, inserir directo
      if (imgH <= A4_H) {
        pdf.addImage(imgData, 'JPEG', 0, 0, A4_W, imgH);
      } else {
        // Imagem mais alta que A4 — dividir em sub-páginas
        const ratio     = canvas.width / A4_W;   // px por mm
        const sliceH_mm = A4_H;
        const sliceH_px = Math.round(sliceH_mm * ratio * SCALE);
        let   yPx       = 0;

        while (yPx < canvas.height) {
          const sliceCanvas = document.createElement('canvas');
          sliceCanvas.width  = canvas.width;
          sliceCanvas.height = Math.min(sliceH_px, canvas.height - yPx);
          const ctx = sliceCanvas.getContext('2d');
          ctx.drawImage(canvas, 0, -yPx);
          const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.95);
          const sliceH    = (sliceCanvas.height / canvas.width) * A4_W;
          if (yPx > 0) pdf.addPage();
          pdf.addImage(sliceData, 'JPEG', 0, 0, A4_W, sliceH);
          yPx += sliceH_px;
        }
      }
    }

    // ── 5. Download ──
    const nomeCliente = (data.nome || 'ficha').replace(/[^a-zA-Z0-9À-ÿ ]/g, '').trim().replace(/\s+/g, '_');
    const dataStr     = new Date().toISOString().slice(0, 10);
    pdf.save(`ficha-${proc}-${nomeCliente}-${dataStr}.pdf`);

    showToast('✅ PDF exportado com sucesso!');
  } catch(e) {
    console.error('PDF error:', e);
    showToast('❌ Erro ao gerar PDF: ' + e.message);
  } finally {
    // Limpar iframe
    document.querySelectorAll('iframe[style*="-9999px"]').forEach(el => el.remove());
    // Restaurar botões
    btnList.forEach((b, i) => { b.textContent = origLabels[i]; b.disabled = false; });
  }
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
    .pd-logo-row{display:flex;align-items:center;gap:10px;margin-bottom:4px;}
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
    const initials = esc((c.nome||'?').trim().split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase());
    const meta = [esc(c.tel), esc(c.email)].filter(Boolean).join(' · ');
    const nac  = esc(getNacDisplay(c.nac||''));
    return `<div class="cliente-card">
      <div class="cliente-avatar">${initials}</div>
      <div class="cliente-card-info">
        <div class="cliente-card-nome">${esc(c.nome)||'(sem nome)'}</div>
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
    const sub = [esc(c.tel), esc(getNacDisplay(c.nac))].filter(Boolean).join(' · ');
    return `<div class="busca-item" onclick="preencherDadosCliente('${pfx}', ${c.id})">
      <div class="busca-item-avatar">${initials}</div>
      <div class="busca-item-info">
        <div class="busca-item-nome">${esc(c.nome)}</div>
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
   IMPORT / EXPORT CLIENTES — CSV + XLSX
   ══════════════════════════════════════════════════════════════════════════ */

/* Column aliases: maps any reasonable header name → internal field */
const COL_MAP = {
  nome:         ['nome','name','cliente','full name','nome completo'],
  nasc:         ['nasc','nascimento','data nascimento','data de nascimento','birth','birthday','dob','data nasc'],
  sexo:         ['sexo','sex','género','gender'],
  tel:          ['tel','telefone','telemovel','telemóvel','phone','mobile','celular','contacto'],
  morada:       ['morada','endereço','endereco','address','rua','localidade'],
  email:        ['email','e-mail','mail','correio'],
  doc:          ['doc','nif','bi','passaporte','documento','id','document'],
  nac:          ['nac','nacionalidade','nationality','país','pais','country'],
  obs:          ['obs','observacoes','observações','observações','notas','notes','remarks'],
};

let _importRows = [];   // parsed rows waiting for confirmation

/* ── Show/hide modal ── */
function showImportClientes() {
  const m = document.getElementById('import-modal');
  if (m) {
    m.style.display = 'flex';
    _importRows = [];
    document.getElementById('import-preview').innerHTML = '';
    document.getElementById('import-err').textContent = '';
    document.getElementById('import-confirm-btn').style.display = 'none';
    document.getElementById('import-preview-btn').style.display = '';
    const fi = document.getElementById('import-file');
    if (fi) fi.value = '';
  }
}
function closeImportModal() {
  const m = document.getElementById('import-modal');
  if (m) m.style.display = 'none';
}

/* ── Parse CSV text → array of row objects ── */
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) throw new Error('Ficheiro CSV vazio ou sem dados.');

  // Detect separator: comma or semicolon
  const sep = (lines[0].split(';').length > lines[0].split(',').length) ? ';' : ',';

  const headers = lines[0].split(sep).map(h => h.trim().replace(/^["']|["']$/g,'').toLowerCase());
  const fieldMap = {};

  // Map CSV headers → internal fields
  for (const [field, aliases] of Object.entries(COL_MAP)) {
    const idx = headers.findIndex(h => aliases.some(a => h.includes(a)));
    if (idx >= 0) fieldMap[field] = idx;
  }

  if (!('nome' in fieldMap)) throw new Error('Coluna "Nome" não encontrada. Verifique os cabeçalhos do ficheiro.');

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(sep).map(c => c.trim().replace(/^["']|["']$/g,''));
    if (cells.every(c => !c)) continue;
    const obj = {};
    for (const [field, idx] of Object.entries(fieldMap)) obj[field] = cells[idx] || '';
    if (obj.nome) rows.push(obj);
  }
  return rows;
}

/* ── Load SheetJS from CDN if needed, then parse XLSX ── */
function loadSheetJS() {
  return new Promise((resolve, reject) => {
    if (window.XLSX) { resolve(window.XLSX); return; }
    if (!navigator.onLine) {
      reject(new Error('Sem ligação à internet. O export XLSX requer ligação na primeira utilização.'));
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload  = () => resolve(window.XLSX);
    s.onerror = () => reject(new Error('Não foi possível carregar a biblioteca XLSX. Verifique a ligação à internet.'));
    document.head.appendChild(s);
  });
}

async function parseXLSX(file) {
  const XLSX = await loadSheetJS();
  const buf  = await file.arrayBuffer();
  const wb   = XLSX.read(buf, { type: 'array' });
  const ws   = wb.Sheets[wb.SheetNames[0]];
  const raw  = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  if (raw.length < 2) throw new Error('Ficheiro XLSX vazio ou sem dados.');

  const headers = raw[0].map(h => String(h).trim().toLowerCase());
  const fieldMap = {};
  for (const [field, aliases] of Object.entries(COL_MAP)) {
    const idx = headers.findIndex(h => aliases.some(a => h.includes(a)));
    if (idx >= 0) fieldMap[field] = idx;
  }
  if (!('nome' in fieldMap)) throw new Error('Coluna "Nome" não encontrada. Verifique os cabeçalhos do ficheiro.');

  const rows = [];
  for (let i = 1; i < raw.length; i++) {
    const cells = raw[i];
    if (!cells.length || cells.every(c => !String(c).trim())) continue;
    const obj = {};
    for (const [field, idx] of Object.entries(fieldMap)) obj[field] = String(cells[idx] || '').trim();
    if (obj.nome) rows.push(obj);
  }
  return rows;
}

/* ── Preview parsed rows ── */
async function previewImport() {
  const file = document.getElementById('import-file')?.files[0];
  const err  = document.getElementById('import-err');
  err.textContent = '';

  if (!file) { err.textContent = 'Selecione um ficheiro primeiro.'; return; }

  const btn = document.getElementById('import-preview-btn');
  btn.textContent = '⏳ A processar…'; btn.disabled = true;

  try {
    const ext = file.name.split('.').pop().toLowerCase();
    _importRows = ext === 'csv'
      ? parseCSV(await file.text())
      : await parseXLSX(file);

    if (!_importRows.length) throw new Error('Nenhuma linha válida encontrada no ficheiro.');

    // Build preview table
    const preview = document.getElementById('import-preview');
    preview.innerHTML = `
      <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:8px;">
        📋 ${_importRows.length} cliente(s) encontrado(s) — pré-visualização:
      </div>
      <div style="max-height:180px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;">
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead><tr style="background:var(--pink-light);">
            <th style="padding:6px 8px;text-align:left;">Nome</th>
            <th style="padding:6px 8px;text-align:left;">Telefone</th>
            <th style="padding:6px 8px;text-align:left;">E-mail</th>
            <th style="padding:6px 8px;text-align:left;">Nasc.</th>
          </tr></thead>
          <tbody>
            ${_importRows.slice(0,15).map(r => `
              <tr style="border-top:1px solid var(--border);">
                <td style="padding:5px 8px;font-weight:600;">${esc(r.nome)||''}</td>
                <td style="padding:5px 8px;">${esc(r.tel)||''}</td>
                <td style="padding:5px 8px;">${esc(r.email)||''}</td>
                <td style="padding:5px 8px;">${esc(r.nasc)||''}</td>
              </tr>`).join('')}
            ${_importRows.length > 15 ? `<tr><td colspan="4" style="padding:6px 8px;color:var(--gray);font-style:italic;">… e mais ${_importRows.length-15} cliente(s)</td></tr>` : ''}
          </tbody>
        </table>
      </div>`;

    document.getElementById('import-confirm-btn').style.display = '';
    btn.textContent = '🔍 Pré-visualizar';
    btn.disabled = false;
  } catch(e) {
    err.textContent = '❌ ' + e.message;
    btn.textContent = '🔍 Pré-visualizar';
    btn.disabled = false;
    _importRows = [];
  }
}

/* ── Confirm and import ── */
async function confirmImport() {
  if (!_importRows.length) return;
  const mode = document.querySelector('input[name="import-mode"]:checked')?.value || 'merge';
  const err  = document.getElementById('import-err');
  const btn  = document.getElementById('import-confirm-btn');
  btn.textContent = '⏳ A importar…'; btn.disabled = true;

  try {
    if (mode === 'replace') {
      const d = await openDB();
      await new Promise((res, rej) => {
        const tx = d.transaction(STORE_CLI, 'readwrite');
        tx.objectStore(STORE_CLI).clear();
        tx.oncomplete = res; tx.onerror = e => rej(e.target.error);
      });
    }

    let count = 0;
    for (const row of _importRows) {
      await dbSaveCliente({
        nome:   row.nome   || '',
        nasc:   row.nasc   || '',
        sexo:   row.sexo   || '',
        tel:    row.tel    || '',
        morada: row.morada || '',
        email:  row.email  || '',
        doc:    row.doc    || '',
        nac:    row.nac    || '',
        obs:    row.obs    || '',
      });
      count++;
    }

    closeImportModal();
    allClientes = [];   // force cache refresh
    await renderClientesList('');
    showToast(`✅ ${count} cliente(s) importado(s) com sucesso!`);
  } catch(e) {
    err.textContent = '❌ Erro ao importar: ' + e.message;
    btn.textContent = '✅ Importar'; btn.disabled = false;
  }
}

/* ── Export CSV ── */
async function exportClientesCSV() {
  const clientes = await dbGetAllClientes();
  if (!clientes.length) { showToast('⚠️ Nenhuma cliente para exportar.'); return; }

  const headers = ['Nome','Nascimento','Sexo','Telefone','Morada','Email','Doc. Identificação','Nacionalidade','Observações'];
  const rows    = clientes.map(c => [
    c.nome||'', c.nasc||'', c.sexo||'', c.tel||'', c.morada||'',
    c.email||'', c.doc||'', c.nac||'', c.obs||''
  ]);

  const csv = [headers, ...rows]
    .map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(','))
    .join('\r\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: `clientes-beleza-rara-${new Date().toISOString().slice(0,10)}.csv`
  });
  a.click(); URL.revokeObjectURL(a.href);
  showToast(`✅ ${clientes.length} cliente(s) exportado(s) em CSV!`);
}

/* ── Export XLSX ── */
async function exportClientesXLSX() {
  const clientes = await dbGetAllClientes();
  if (!clientes.length) { showToast('⚠️ Nenhuma cliente para exportar.'); return; }

  try {
    const XLSX = await loadSheetJS();
    const headers = ['Nome','Nascimento','Sexo','Telefone','Morada','Email','Doc. Identificação','Nacionalidade','Observações'];
    const rows = clientes.map(c => [
      c.nome||'', c.nasc||'', c.sexo||'', c.tel||'', c.morada||'',
      c.email||'', c.doc||'', c.nac||'', c.obs||''
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    // Column widths
    ws['!cols'] = [28,14,10,16,32,28,20,18,30].map(w => ({ wch: w }));
    // Style header row (basic)
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
    XLSX.writeFile(wb, `clientes-beleza-rara-${new Date().toISOString().slice(0,10)}.xlsx`);
    showToast(`✅ ${clientes.length} cliente(s) exportado(s) em XLSX!`);
  } catch(e) {
    showToast('❌ Erro ao exportar XLSX: ' + e.message);
  }
}

/* Close modal on backdrop click */
document.addEventListener('click', e => {
  const modal = document.getElementById('import-modal');
  if (modal && e.target === modal) closeImportModal();
});


/* ══════════════════════════════════════════════════════════════════════════
   STEPPER — espessura (0.03–0.30, step 0.01) e comprimento (4–25, step 1)
   ══════════════════════════════════════════════════════════════════════════ */
const STEPPER_CFG = {
  'p-espessura':  { min: 0.03, max: 0.30, step: 0.01, decimals: 2, unit: '', default: 0.10 },
  'p-comprimento':{ min: 4,    max: 25,   step: 1,    decimals: 0, unit: '', default: 10   },
};

function stepperChange(id, dir) {
  const cfg = STEPPER_CFG[id];
  if (!cfg) return;
  const el = document.getElementById(id);
  if (!el) return;
  // If current value is empty or NaN, start from default
  let current = parseFloat(el.value);
  if (isNaN(current)) current = cfg.default !== undefined ? cfg.default : cfg.min;
  let v = current + dir * cfg.step;
  v = Math.min(cfg.max, Math.max(cfg.min, parseFloat(v.toFixed(cfg.decimals))));
  el.value = v.toFixed(cfg.decimals);
}

function stepperGet(id) {
  const el = document.getElementById(id);
  return el ? el.value : '';
}

function stepperSet(id, value) {
  const el = document.getElementById(id);
  const cfg = STEPPER_CFG[id];
  if (el && value !== undefined && value !== '') {
    el.value = parseFloat(value).toFixed(cfg ? cfg.decimals : 2);
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   TOGGLE SUB-FIELD — mostra/oculta campo condicional quando SIM selecionado
   ══════════════════════════════════════════════════════════════════════════ */
function toggleSub(subId, radio, triggerValue) {
  const sub = document.getElementById(subId);
  if (!sub) return;
  sub.style.display = radio.value === triggerValue && radio.checked ? 'flex' : 'none';
}

/* ══════════════════════════════════════════════════════════════════════════
   ESTILO OUTRO — mostra input quando "Outro" selecionado no select
   ══════════════════════════════════════════════════════════════════════════ */
function estiloSelectChange(selectId, outroId) {
  const sel   = document.getElementById(selectId);
  const outro = document.getElementById(outroId);
  if (!sel || !outro) return;
  outro.style.display = sel.value === 'Outro' ? 'block' : 'none';
}

/* CURVATURA Outro pill — mostra input de texto quando "Outra" selecionado */
function pillaOutroChange(name, outroId) {
  const radios = document.querySelectorAll(`input[name="${name}"]`);
  const outro  = document.getElementById(outroId);
  if (!outro) return;
  const checked = Array.from(radios).find(r => r.checked);
  outro.style.display = (checked && checked.value === 'Outra') ? 'block' : 'none';
}

/* Já fez extensão — mostrar campo de duração */
function fezExtChange() {
  const radios  = document.querySelectorAll('input[name="p-fez-ext"]');
  const detalhe = document.getElementById('p-fez-ext-detalhe');
  if (!detalhe) return;
  const checked = Array.from(radios).find(r => r.checked);
  detalhe.style.display = (checked && checked.value === 'SIM') ? 'block' : 'none';
}


/* ══════════════════════════════════════════════════════════════════════════
   FACIAL — Sessões helper
   ══════════════════════════════════════════════════════════════════════════ */
function faAddSessao(vals) {
  const tbody = document.getElementById('fa-sessoes-body');
  if (!tbody) return;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="date" value="${vals?.[0]||''}"></td>
    <td><input type="text" placeholder="Procedimento realizado…" value="${vals?.[1]||''}"></td>
    <td><textarea rows="1" placeholder="Observações…" style="resize:vertical;">${vals?.[2]||''}</textarea></td>`;
  tbody.appendChild(tr);
}

/* ══════════════════════════════════════════════════════════════════════════
   POPULAR FORMULÁRIO — FACIAL
   ══════════════════════════════════════════════════════════════════════════ */
function populateFacial(d) {
  setVal('fa-nome', d.nome); setVal('fa-nasc', d.nasc);
  document.getElementById('fa-idade').value = d.nasc ? calcIdade(d.nasc) : (d.idade||'');
  setRadio('fa-sexo', d.sexo); setVal('fa-tel', d.tel); setVal('fa-social', d.social);
  setVal('fa-morada', d.morada); setVal('fa-email', d.email); setVal('fa-doc', d.doc);
  setNac('fa', d.nac);
  document.getElementById('fa-atend-data') && (document.getElementById('fa-atend-data').value = d.atendData||'');
  document.getElementById('fa-profissional') && (document.getElementById('fa-profissional').value = d.profissional||'');
  if (d.sigProfDataURL) setTimeout(() => sigSetDataURL('fap', d.sigProfDataURL), 100);
  // Questionário
  ['sol','glicemico','intestinal','tratAnt','agua','alcool','filtro','menstrual',
   'sono','protese','tabaco','cardiaco','marcapasso','gestante','cremes',
   'atividade','anticonc','alergia','roacutan','pele'].forEach(f => setRadio('fa-'+f, d[f]));
  setVal('fa-trat-ant-esp', d.tratAntEsp); setVal('fa-gestante-semanas', d.gestanteSemanas);
  setVal('fa-cremes-esp', d.cremesEsp); setVal('fa-atividade-esp', d.atividadeEsp);
  setVal('fa-anticonc-esp', d.anticoncEsp); setVal('fa-alergia-esp', d.alergiaEsp);
  setVal('fa-pele-esp', d.peleEsp);
  // Restore sub-fields
  ['tratAnt','gestante','cremes','atividade','anticonc','alergia','pele'].forEach(f => {
    const el = document.querySelector(`input[name="fa-${f}"][value="SIM"]`);
    if (el && el.checked) toggleSub(`fa-${f}-sub`, el, 'SIM');
  });
  // Semiológico
  setRadio('fa-biotipo', d.biotipo); setRadio('fa-espessura', d.espessura);
  setRadio('fa-fototipo', d.fototipo); setRadio('fa-envelhecimento', d.envelhecimento);
  ['cravos','pustulas','nodulos','millium','ostios','cicHiper','queloide',
   'melasma','cloasma','hpi','efelides','melanose','hipoLesao','hipoRad','hipoOutro'].forEach(f => {
    // map camelCase to kebab
    const id = 'fa-' + f.replace(/([A-Z])/g, '-$1').toLowerCase();
    setRadio(id, d[f]);
  });
  setVal('fa-hipo-outro-esp', d.hipoOutroEsp);
  const hipoEl = document.querySelector('input[name="fa-hipo-outro"][value="SIM"]');
  if (hipoEl && hipoEl.checked) toggleSub('fa-hipo-outro-sub', hipoEl, 'SIM');
  // Avaliação específica
  setVal('fa-cuidados', d.cuidados); setVal('fa-indicacao-trat', d.indicacaoTrat);
  setVal('fa-home-care', d.homeCare);
  // Sessões
  const tbody = document.getElementById('fa-sessoes-body');
  if (tbody) { tbody.innerHTML = ''; (d.sessions||[]).forEach(r => faAddSessao(r)); }
  // Assinatura
  setRadio('fa-imagem', d.imgAuth);
  if (d.sigDataURL) setTimeout(() => sigSetDataURL('fa', d.sigDataURL), 100);
}

/* ══════════════════════════════════════════════════════════════════════════
   POPULAR FORMULÁRIO — MICROBLADING
   ══════════════════════════════════════════════════════════════════════════ */
function populateMicroblading(d) {
  setVal('mb-nome', d.nome); setVal('mb-nasc', d.nasc);
  document.getElementById('mb-idade').value = d.nasc ? calcIdade(d.nasc) : (d.idade||'');
  setRadio('mb-sexo', d.sexo); setVal('mb-tel', d.tel); setVal('mb-email', d.email);
  setVal('mb-morada', d.morada); setVal('mb-doc', d.doc); setNac('mb', d.nac);
  document.getElementById('mb-atend-data') && (document.getElementById('mb-atend-data').value = d.atendData||'');
  document.getElementById('mb-profissional') && (document.getElementById('mb-profissional').value = d.profissional||'');
  if (d.sigProfDataURL) setTimeout(() => sigSetDataURL('mbp', d.sigProfDataURL), 100);
  // Questionário
  ['gestante','diabetes','coagulacao','queloide','doencasSang','alergia',
   'anticoag','pele','cirurgia','onco','epilepsia','autoimune','acneTrat',
   'glaucoma','solar','tatooPrev'].forEach(f => {
    const id = 'mb-' + f.replace(/([A-Z])/g, '-$1').toLowerCase();
    setRadio(id, d[f]);
  });
  setVal('mb-gestante-esp', d.gestanteEsp); setVal('mb-alergia-esp', d.alergiaEsp);
  setVal('mb-tatoo-prev-esp', d.tatooEsp);
  ['gestante','alergia','tatoo-prev'].forEach(f => {
    const el = document.querySelector(`input[name="mb-${f}"][value="SIM"]`);
    if (el && el.checked) toggleSub(`mb-${f}-sub`, el, 'SIM');
  });
  // Procedimento
  ['es','ts','tc','tca','epc','apib','apia','apcb','apca','apf','obs-tecnica'].forEach(f => {
    setVal('mb-' + f, d[f.replace(/-([a-z])/g, (_,c) => c.toUpperCase())] || d[f]);
  });
  setRadio('mb-epi', d.epi);
  // Assinatura
  setRadio('mb-imagem', d.imgAuth);
  if (d.sigDataURL) setTimeout(() => sigSetDataURL('mb', d.sigDataURL), 100);
}

/* ══════════════════════════════════════════════════════════════════════════
   BUILD HTML PARA IMPRESSÃO — FACIAL
   ══════════════════════════════════════════════════════════════════════════ */
function buildFacialHTML(d) {
  const dataFmt = formatDate(d.atendData || '');
  const sessRows = (d.sessions||[]).map(r =>
    `<tr><td>${r[0]||''}</td><td>${r[1]||''}</td><td>${r[2]||''}</td></tr>`
  ).join('') || `<tr><td colspan="3" style="color:#aaa;text-align:center;">Sem sessões registadas</td></tr>`;

  /* ── Página 1: Dados + Questionário de Saúde ── */
  const p1 = `<div class="pd-page">
    ${printHeader('FICHA DE ANAMNESE FACIAL')}
    ${dadosClienteBlock(d)}
    <div style="font-size:8pt;color:#555;margin-bottom:3mm;">Rede social: <strong>${esc(d.social||'—')}</strong></div>
    ${atendimentoBlock(d)}
    <div class="pd-section-title">QUESTIONÁRIO DE SAÚDE</div>
    ${makeYnTable([
      ['Se expõe ao sol com frequência?', d.sol],
      ['Consome alimentos de Alto Índice Glicémico?', d.glicemico],
      ['Funcionamento intestinal regular?', d.intestinal],
      ['Tratamento facial anterior?' + (d.tratAntEsp?' — '+d.tratAntEsp:''), d.tratAnt],
      ['Ingere água com frequência?', d.agua],
      ['Ingere bebida alcoólica?', d.alcool],
      ['Utiliza filtro solar?', d.filtro],
      ['Está no período menstrual?', d.menstrual],
      ['Boa qualidade do sono?', d.sono],
      ['Possui prótese corporal/facial?', d.protese],
      ['Tabagismo?', d.tabaco],
      ['Alterações cardíacas?', d.cardiaco],
      ['Portador de marcapasso?', d.marcapasso],
      ['Gestante?' + (d.gestanteSemanas?' — '+d.gestanteSemanas+' sem.':''), d.gestante],
      ['Cremes ou loções facial?' + (d.cremesEsp?' — '+d.cremesEsp:''), d.cremes],
      ['Pratica atividade física?' + (d.atividadeEsp?' — '+d.atividadeEsp:''), d.atividade],
      ['Utiliza anticoncepcional?' + (d.anticoncEsp?' — '+d.anticoncEsp:''), d.anticonc],
      ['Possui algum tipo de alergia?' + (d.alergiaEsp?' — '+d.alergiaEsp:''), d.alergia],
      ['Já utilizou Roacutan?', d.roacutan],
      ['Problemas de pele?' + (d.peleEsp?' — '+d.peleEsp:''), d.pele],
    ])}
  </div>`;

  /* ── Página 2: Semiológico + Avaliação + Sessões + Assinaturas ── */
  const p2 = `<div class="pd-page">
    ${printHeader('CARACTERÍSTICAS SEMIOLÓGICAS E AVALIAÇÃO – FACIAL')}
    <div class="pd-section-title">CARACTERÍSTICAS SEMIOLÓGICAS (PROFISSIONAL)</div>
    ${makeFields([
      [['Biotipo de pele:', d.biotipo], ['Espessura:', d.espessura]],
      [['Fototipo:', d.fototipo], ['Grau de Envelhecimento:', d.envelhecimento]],
    ])}
    ${makeYnTable([
      ['Comedões (Cravos)', d.cravos], ['Pústulas (Espinhas)', d.pustulas],
      ['Nódulos (Espinha interna)', d.nodulos], ['Millium', d.millium],
      ['Óstios abertos', d.ostios], ['Cicatriz hipertrófica', d.cicHiper], ['Cicatriz queloideana', d.queloide],
      ['Melasma', d.melasma], ['Cloasma', d.cloasma], ['H.P.I.', d.hpi],
      ['Efélides', d.efelides], ['Melanose Solar', d.melanose],
      ['Hipocromia — Lesão', d.hipoLesao], ['Hipocromia — Radiação', d.hipoRad],
      ['Hipocromia — Outros' + (d.hipoOutroEsp?' ('+d.hipoOutroEsp+')':''), d.hipoOutro],
    ])}
    <div class="pd-section-title">AVALIAÇÃO ESPECÍFICA</div>
    ${makeFields([
      [['Cuidados diários:', esc(d.cuidados||''), 2]],
      [['Indicação do Tratamento:', esc(d.indicacaoTrat||''), 2]],
      [['Indicação de Home Care:', esc(d.homeCare||''), 2]],
    ])}
    <div class="pd-section-title">CONTROLE DE SESSÕES</div>
    <table class="pd-sessions-table" style="font-size:8pt;">
      <thead><tr><th>Data</th><th>Procedimento</th><th>Observações</th></tr></thead>
      <tbody>${sessRows}</tbody>
    </table>
    ${imagemBlock(d.imgAuth)}
    ${sigRow([['Assinatura da Cliente',''],['Profissional Responsável',''],['Data do Procedimento',dataFmt]], d.sigDataURL, d.sigProfDataURL)}
  </div>`;

  return p1 + p2;
}

/* ══════════════════════════════════════════════════════════════════════════
   BUILD HTML PARA IMPRESSÃO — MICROBLADING
   ══════════════════════════════════════════════════════════════════════════ */
function buildMicrobladingHTML(d) {
  const dataFmt = formatDate(d.atendData || '');

  const p1 = `<div class="pd-page">
    ${printHeader('FICHA DE ANAMNESE – MICROPIGMENTAÇÃO (MICROBLADING)')}
    ${dadosClienteBlock(d)}
    ${atendimentoBlock(d)}

    <div class="pd-section-title">QUESTIONÁRIO DE SAÚDE</div>
    ${makeYnTable([
      ['É gestante ou lactante?' + (d.gestanteEsp?' — '+d.gestanteEsp:''), d.gestante],
      ['Tem diabetes?', d.diabetes],
      ['Sofre de problemas de coagulação sanguínea (hemofilia)?', d.coagulacao],
      ['Tem histórico de queloides (cicatrização elevada)?', d.queloide],
      ['Tem doenças transmissíveis pelo sangue (hepatite, HIV)?', d.doencasSang],
      ['Tem alguma alergia?' + (d.alergiaEsp?' — '+d.alergiaEsp:''), d.alergia],
      ['Faz uso de medicação anticoagulante (aspirina, varfarina)?', d.anticoag],
      ['Tem acne, eczema, psoríase ou outra doença de pele na área?', d.pele],
      ['Fez cirurgia plástica facial ou botox nos últimos 6 meses?', d.cirurgia],
      ['Está a fazer tratamento oncológico?', d.onco],
      ['Tem epilepsia?', d.epilepsia],
      ['Tem alguma doença autoimune (lúpus, artrite reumatoide)?', d.autoimune],
      ['Faz tratamento para acne (isotretinoína)?', d.acneTrat],
      ['Tem glaucoma?', d.glaucoma],
      ['Teve exposição solar ou bronzeamento artificial recente?', d.solar],
      ['Já fez micropigmentação ou tatuagem nas sobrancelhas?' + (d.tatooEsp?' — '+d.tatooEsp:''), d.tatooPrev],
    ])}

    <div class="pd-section-title">INFORMAÇÕES SOBRE O PROCEDIMENTO</div>
    ${makeFields([
      [['E.S. (Espaço entre sobrancelhas):', d.es||'—'], ['T.S. (Tamanho sobrancelha):', d.ts||'—']],
      [['T.C. (Tamanho corpo):', d.tc||'—'], ['T.Ca. (Tamanho cauda):', d.tca||'—']],
      [['E.PI (Espessura ponto inicial):', d.epi||'—'], ['E.PC (Espessura ponto central):', d.epc||'—']],
      [['A.PIB:', d.apib||'—'], ['A.PIA:', d.apia||'—'], ['A.PCB:', d.apcb||'—']],
      [['A.PCA:', d.apca||'—'], ['A.PF:', d.apf||'—']],
      [['Observações técnicas:', esc(d.obsTecnica||''), 2]],
    ])}
  </div>`;

  const p2 = `<div class="pd-page">
    ${printHeader('TERMO DE CONSENTIMENTO – MICROBLADING')}
    <p style="font-size:9pt;margin-bottom:4mm;">Eu, <strong>${esc(d.nome||'_____________________________')}</strong>, declaro que:</p>
    <div class="pd-consent-text">
      <p>Fui informada e compreendi plenamente o procedimento de micropigmentação (microblading), incluindo os riscos associados (inchaço, vermelhidão, infeção, reação alérgica, variação de cor e possíveis resultados estéticos que podem não corresponder à minha expectativa).</p>
      <p>Prestei todas as informações de saúde solicitadas de forma verdadeira e completa.</p>
      <p>Comprometo-me a seguir todas as instruções e cuidados pós-procedimento fornecidos pela profissional, para garantir a melhor cicatrização e resultado possível.</p>
      <p>Autorizo a profissional a realizar o procedimento na área das sobrancelhas.</p>
    </div>
    ${imagemBlock(d.imgAuth)}
    ${sigRow([['Assinatura da Cliente',''],['Profissional Responsável','Valquiria Almeida dos Santos'],['Data do Procedimento',dataFmt]], d.sigDataURL, d.sigProfDataURL)}
  </div>`;

  return p1 + p2;
}


/* ══════════════════════════════════════════════════════════════════════════
   ALERTA DE BACKUP — avisa o utilizador ao sair sem backup recente
   ══════════════════════════════════════════════════════════════════════════ */

// Timestamp do último backup exportado (persiste em localStorage)
const BACKUP_TS_KEY = 'belezaRara_lastBackupTs';

function markBackupDone() {
  localStorage.setItem(BACKUP_TS_KEY, Date.now().toString());
}

function getLastBackupTs() {
  const v = localStorage.getItem(BACKUP_TS_KEY);
  return v ? parseInt(v, 10) : 0;
}

function backupIsRecent() {
  // Considera "recente" se foi feito nas últimas 24 horas
  return (Date.now() - getLastBackupTs()) < 24 * 60 * 60 * 1000;
}

// Pending exit callback — executa se utilizador confirmar saída
let _pendingExitFn = null;

async function checkBackupBeforeExit(continueFn) {
  // Count total records
  let total = 0;
  try {
    const fichas   = await dbGetAll();
    const clientes = await dbGetAllClientes();
    total = (fichas || []).length + (clientes || []).length;
  } catch { total = 0; }

  // If no data, or backup recent — proceed directly
  if (total === 0 || backupIsRecent()) {
    if (continueFn) continueFn();
    return;
  }

  // Show alert modal
  _pendingExitFn = continueFn;
  const countEl = document.getElementById('backup-alert-count');
  if (countEl) {
    const f = await dbGetAll().then(r => r?.length || 0).catch(() => 0);
    const c = await dbGetAllClientes().then(r => r?.length || 0).catch(() => 0);
    countEl.textContent = `${f} ficha(s) e ${c} cliente(s)`;
  }
  const modal = document.getElementById('modal-backup-alert');
  if (modal) { modal.style.display = 'flex'; }
}

function closeBackupAlert() {
  _pendingExitFn = null;
  const modal = document.getElementById('modal-backup-alert');
  if (modal) modal.style.display = 'none';
}

function backupAlertGoBackup() {
  closeBackupAlert();
  showDefinicoes();   // open Definições → user can do backup there
}

function backupAlertContinue() {
  const fn = _pendingExitFn;
  closeBackupAlert();
  if (fn) fn();
}

// beforeunload — standard browser warning when closing/refreshing
window.addEventListener('beforeunload', (e) => {
  // Only warn if data exists and no recent backup
  if (!backupIsRecent()) {
    // Check synchronously via localStorage record count hint
    const hint = localStorage.getItem('belezaRara_hasData');
    if (hint === '1') {
      e.preventDefault();
      e.returnValue = 'Tem dados sem backup recente. Deseja realmente sair?';
      return e.returnValue;
    }
  }
});

// Update hasData hint whenever fichas are saved
const _origDbSave = dbSave;
dbSave = async function(record) {
  const result = await _origDbSave(record);
  localStorage.setItem('belezaRara_hasData', '1');
  return result;
};

/* ══════════════════════════════════════════════════════════════════════════
   RESET DA APLICAÇÃO — simulado (botão visível, sem execução real)
   ══════════════════════════════════════════════════════════════════════════ */

function showResetModal() {
  if (!isAdmin()) { showToast('⚠️ Acesso restrito a administradores.'); return; }
  // Reset modal to step 1
  document.getElementById('reset-step-1').style.display = 'block';
  document.getElementById('reset-step-2').style.display = 'none';
  const inp = document.getElementById('reset-confirm-input');
  const err = document.getElementById('reset-confirm-err');
  const btn = document.getElementById('reset-confirm-btn');
  if (inp) inp.value = '';
  if (err) err.textContent = '';
  if (btn) { btn.disabled = true; btn.style.background = '#9ca3af'; btn.style.cursor = 'not-allowed'; }
  const modal = document.getElementById('modal-reset-confirm');
  if (modal) modal.style.display = 'flex';
}

function closeResetModal() {
  const modal = document.getElementById('modal-reset-confirm');
  if (modal) modal.style.display = 'none';
}

function resetStep2() {
  document.getElementById('reset-step-1').style.display = 'none';
  document.getElementById('reset-step-2').style.display = 'block';
  setTimeout(() => {
    const inp = document.getElementById('reset-confirm-input');
    if (inp) inp.focus();
  }, 100);
}

function resetCheckConfirm() {
  const inp = document.getElementById('reset-confirm-input');
  const btn = document.getElementById('reset-confirm-btn');
  const err = document.getElementById('reset-confirm-err');
  const val = (inp?.value || '').trim().toUpperCase();
  const ok  = val === 'APAGAR TUDO';
  if (btn) {
    btn.disabled       = !ok;
    btn.style.background = ok ? '#dc2626' : '#9ca3af';
    btn.style.cursor     = ok ? 'pointer' : 'not-allowed';
  }
  if (err) err.textContent = val && !ok ? 'Escreva exactamente: APAGAR TUDO' : '';
}

async function executeReset() {
  // ── SIMULAÇÃO — botão activo mas sem apagar dados reais ──
  // Para implementação real, substituir este bloco pelo código de limpeza:
  //
  //   const d = await openDB();
  //   const tx = d.transaction([STORE, STORE_CLI], 'readwrite');
  //   tx.objectStore(STORE).clear();
  //   tx.objectStore(STORE_CLI).clear();
  //   localStorage.clear();
  //   location.reload();
  //
  closeResetModal();
  showToast('⚠️ Reset simulado — nenhum dado foi apagado. Funcionalidade em fase de activação.');
}

/* ══════════════════════════════════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  bootApp().catch(console.error);

  // Wire estilo select → show/hide "Outro" input
  const estiloSel = document.getElementById('p-estilo');
  if (estiloSel) estiloSel.addEventListener('change', () => estiloSelectChange('p-estilo','p-estilo-outro'));

  // Wire curvatura pills → show/hide "Outra" input
  document.querySelectorAll('input[name="p-curvatura"]').forEach(r =>
    r.addEventListener('change', () => pillaOutroChange('p-curvatura','p-curvatura-outro')));

  // Wire "já fez extensão" → show/hide duração
  document.querySelectorAll('input[name="p-fez-ext"]').forEach(r =>
    r.addEventListener('change', fezExtChange));

  // Manicure: técnica histórico → show outro input
  document.querySelectorAll('input[name="m-tecnica-histo"]').forEach(r =>
    r.addEventListener('change', () => {
      const o = document.getElementById('m-tecnica-outro');
      if (o) o.style.display = r.value === 'Outro' && r.checked ? 'block' : 'none';
    }));

  // Manicure: nail type → show outro input
  const nailSel = document.getElementById('m-nail-type');
  if (nailSel) nailSel.addEventListener('change', () => {
    const o = document.getElementById('m-nail-type-outro');
    if (o) o.style.display = nailSel.value === 'Outro' ? 'block' : 'none';
  });

  // Manicure: material / molde → show outro inputs
  ['m-material','m-molde'].forEach(name => {
    document.querySelectorAll(`input[name="${name}"]`).forEach(r =>
      r.addEventListener('change', () => {
        const o = document.getElementById(name + '-outro');
        if (o) o.style.display = r.value === 'Outro' && r.checked ? 'block' : 'none';
      }));
  });

  // Manicure: cor nova → show outro
  document.querySelectorAll('input[name="m-cor-nova"]').forEach(r =>
    r.addEventListener('change', () => {
      const o = document.getElementById('m-cor-nova-outro');
      if (o) o.style.display = r.value === 'Outras' && r.checked ? 'block' : 'none';
    }));

  // Manicure: cor histórico → show outro
  document.querySelectorAll('input[name="m-cor-histo"]').forEach(r =>
    r.addEventListener('change', () => {
      const o = document.getElementById('m-cor-histo-outro');
      if (o) o.style.display = r.value === 'Outras' && r.checked ? 'block' : 'none';
    }));
});

