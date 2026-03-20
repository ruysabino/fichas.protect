/* ==========================================================================
   BELEZA RARA – Security Module
   Autenticação local · Cifra AES-GCM · Backup/Restore · Relatório RGPD
   ========================================================================== */
'use strict';

/* ══════════════════════════════════════════════════════════════════════════
   ESTADO DE AUTENTICAÇÃO
   ══════════════════════════════════════════════════════════════════════════ */
let _authSession = null;   // { user, loginAt }
const SESSION_KEY = 'br_session';
const USERS_KEY   = 'br_users_v1';
const SESSION_TTL = 8 * 60 * 60 * 1000;   // 8 horas

/* ══════════════════════════════════════════════════════════════════════════
   WEB CRYPTO — PBKDF2 + AES-GCM
   ══════════════════════════════════════════════════════════════════════════ */
const crypto = window.crypto || window.msCrypto;
const subtle  = crypto.subtle;

/** Encode/decode helpers */
function buf2hex(buf) {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}
function hex2buf(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i*2, i*2+2), 16);
  return bytes.buffer;
}
function str2buf(str)  { return new TextEncoder().encode(str); }
function buf2str(buf)  { return new TextDecoder().decode(buf); }
function buf2b64(buf)  { return btoa(String.fromCharCode(...new Uint8Array(buf))); }
function b642buf(b64)  {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

/**
 * Derive a 256-bit AES key from a password + salt using PBKDF2.
 * 310,000 iterations — OWASP 2023 recommendation.
 */
async function deriveKey(password, salt) {
  const keyMaterial = await subtle.importKey(
    'raw', str2buf(password), 'PBKDF2', false, ['deriveKey']
  );
  return subtle.deriveKey(
    { name: 'PBKDF2', salt: typeof salt === 'string' ? hex2buf(salt) : salt,
      iterations: 310_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false, ['encrypt', 'decrypt']
  );
}

/** Hash password for storage (PBKDF2, returns hex salt + hex hash) */
async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const key  = await deriveKey(password, salt);
  // Export key bytes as the "hash" (deterministic given same password+salt)
  const raw  = await subtle.exportKey('raw', key);
  return { salt: buf2hex(salt), hash: buf2hex(raw) };
}

async function verifyPassword(password, storedSalt, storedHash) {
  const key = await deriveKey(password, storedSalt);
  const raw = await subtle.exportKey('raw', key);
  return buf2hex(raw) === storedHash;
}

/**
 * Encrypt arbitrary JSON data with AES-GCM.
 * Returns a base64 string: IV(12B) + ciphertext.
 */
async function encryptData(data, password) {
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const iv   = crypto.getRandomValues(new Uint8Array(12));
  const key  = await deriveKey(password, salt);
  const enc  = await subtle.encrypt({ name: 'AES-GCM', iv }, key, str2buf(JSON.stringify(data)));
  // Pack: salt(32B) + iv(12B) + ciphertext
  const packed = new Uint8Array(32 + 12 + enc.byteLength);
  packed.set(new Uint8Array(salt.buffer), 0);
  packed.set(new Uint8Array(iv.buffer),   32);
  packed.set(new Uint8Array(enc),         44);
  return buf2b64(packed.buffer);
}

async function decryptData(b64, password) {
  const packed = new Uint8Array(b642buf(b64));
  const salt   = packed.slice(0, 32).buffer;
  const iv     = packed.slice(32, 44);
  const cipher = packed.slice(44);
  const key    = await deriveKey(password, salt);
  const plain  = await subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
  return JSON.parse(buf2str(plain));
}

/* ══════════════════════════════════════════════════════════════════════════
   GESTÃO DE UTILIZADORES (armazenados em localStorage, hashes apenas)
   ══════════════════════════════════════════════════════════════════════════ */
function getUsers() {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || '{}'); }
  catch { return {}; }
}
function saveUsers(users) { localStorage.setItem(USERS_KEY, JSON.stringify(users)); }

async function createUser(username, password, role) {
  const users = getUsers();
  if (users[username]) throw new Error('Utilizador já existe.');
  const { salt, hash } = await hashPassword(password);
  users[username] = { salt, hash, role: role || 'user', createdAt: new Date().toISOString() };
  saveUsers(users);
}

async function loginUser(username, password) {
  const users = getUsers();
  const u = users[username];
  if (!u) return false;
  return verifyPassword(password, u.salt, u.hash);
}

function hasAnyUser() { return Object.keys(getUsers()).length > 0; }

function getUserRole(username) {
  return getUsers()[username]?.role || 'user';
}

function getAllUsers() {
  return Object.entries(getUsers()).map(([u, d]) => ({
    username: u, role: d.role, createdAt: d.createdAt
  }));
}

async function changePassword(username, oldPass, newPass) {
  const ok = await loginUser(username, oldPass);
  if (!ok) throw new Error('Senha actual incorrecta.');
  const { salt, hash } = await hashPassword(newPass);
  const users = getUsers();
  users[username] = { ...users[username], salt, hash };
  saveUsers(users);
}

async function adminResetPassword(username, newPass) {
  const users = getUsers();
  if (!users[username]) throw new Error('Utilizador não encontrado.');
  const { salt, hash } = await hashPassword(newPass);
  users[username] = { ...users[username], salt, hash };
  saveUsers(users);
}

function deleteUser(username) {
  const users = getUsers();
  delete users[username];
  saveUsers(users);
}

/* ══════════════════════════════════════════════════════════════════════════
   SESSÃO
   ══════════════════════════════════════════════════════════════════════════ */
function startSession(username) {
  _authSession = { user: username, role: getUserRole(username), loginAt: Date.now() };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(_authSession));
}

function loadSession() {
  try {
    const s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
    if (!s) return false;
    if (Date.now() - s.loginAt > SESSION_TTL) { clearSession(); return false; }
    _authSession = s;
    return true;
  } catch { return false; }
}

function clearSession() {
  _authSession = null;
  sessionStorage.removeItem(SESSION_KEY);
}

function isLoggedIn()  { return !!_authSession; }
function currentUser() { return _authSession?.user || ''; }
function isAdmin()     { return _authSession?.role === 'admin'; }

/* ══════════════════════════════════════════════════════════════════════════
   ECRÃS DE AUTH — Login, Setup, Definições
   ══════════════════════════════════════════════════════════════════════════ */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    s.style.display = 'none';
  });
  const el = document.getElementById(id);
  if (el) { el.style.display = 'flex'; el.classList.add('active'); }
}

async function bootApp() {
  await openDB();   // ensure DB is ready

  // First run: no users exist → show setup
  if (!hasAnyUser()) { showScreen('screen-setup'); return; }

  // Resume session if valid
  if (loadSession()) { showScreen('screen-select'); updateUserBadge(); return; }

  // Otherwise show login
  showScreen('screen-login');
}

function updateUserBadge() {
  const el = document.getElementById('user-badge');
  if (el) el.textContent = '👤 ' + currentUser();
  const adminArea = document.getElementById('admin-only-btns');
  if (adminArea) adminArea.style.display = isAdmin() ? 'flex' : 'none';
}

/* ── SETUP (first run) ── */
async function doSetup() {
  const name = document.getElementById('setup-nome')?.value.trim();
  const user = document.getElementById('setup-user')?.value.trim();
  const pass = document.getElementById('setup-pass')?.value;
  const conf = document.getElementById('setup-conf')?.value;
  const err  = document.getElementById('setup-err');

  err.textContent = '';
  if (!name || !user || !pass) { err.textContent = 'Preencha todos os campos.'; return; }
  if (pass.length < 8)         { err.textContent = 'A senha deve ter pelo menos 8 caracteres.'; return; }
  if (pass !== conf)            { err.textContent = 'As senhas não coincidem.'; return; }

  try {
    await createUser(user, pass, 'admin');
    localStorage.setItem('br_salon_name', name);
    startSession(user);
    showToast('✅ Sistema configurado! Bem-vinda, ' + user + '!');
    showScreen('screen-select');
    updateUserBadge();
  } catch(e) { err.textContent = e.message; }
}

/* ── LOGIN ── */
async function doLogin() {
  const user = document.getElementById('login-user')?.value.trim();
  const pass = document.getElementById('login-pass')?.value;
  const err  = document.getElementById('login-err');
  const btn  = document.getElementById('login-btn');

  err.textContent = '';
  if (!user || !pass) { err.textContent = 'Preencha utilizador e senha.'; return; }

  btn.disabled    = true;
  btn.textContent = '🔄 A verificar…';

  try {
    const ok = await loginUser(user, pass);
    if (!ok) {
      err.textContent = '❌ Utilizador ou senha incorrectos.';
      btn.disabled    = false;
      btn.textContent = '🔐 Entrar';
      return;
    }
    startSession(user);
    showScreen('screen-select');
    updateUserBadge();
    showToast('✅ Bem-vinda, ' + user + '!');
  } catch(e) {
    err.textContent = 'Erro: ' + e.message;
    btn.disabled    = false;
    btn.textContent = '🔐 Entrar';
  }
}

function doLogout() {
  if (!confirm('Terminar sessão?')) return;
  clearSession();
  showScreen('screen-login');
}

/* ── LOGIN on Enter key ── */
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.getElementById('screen-login')?.classList.contains('active')) {
    doLogin();
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   ECRÃ DE DEFINIÇÕES (admin)
   ══════════════════════════════════════════════════════════════════════════ */
function showDefinicoes() {
  showScreen('screen-definicoes');
  renderUsersList();
}

function backFromDefinicoes() { showScreen('screen-select'); }

function renderUsersList() {
  const el = document.getElementById('users-list');
  if (!el) return;
  const users = getAllUsers();
  el.innerHTML = users.map(u => `
    <div class="user-row">
      <div class="user-row-info">
        <span class="user-row-name">👤 ${u.username}</span>
        <span class="user-row-role ${u.role}">${u.role === 'admin' ? '⭐ Admin' : '👁️ Utilizador'}</span>
      </div>
      <div class="user-row-actions">
        ${u.username !== currentUser() ? `
          <button class="btn-user-reset" onclick="promptResetPassword('${u.username}')">🔑 Senha</button>
          ${u.username !== currentUser() ? `<button class="btn-user-del" onclick="confirmDeleteUser('${u.username}')">🗑️</button>` : ''}
        ` : '<span style="font-size:12px;color:var(--gray);">(você)</span>'}
      </div>
    </div>
  `).join('');
}

async function addUser() {
  const user = document.getElementById('new-user-name')?.value.trim();
  const pass = document.getElementById('new-user-pass')?.value;
  const role = document.getElementById('new-user-role')?.value || 'user';
  const err  = document.getElementById('add-user-err');
  err.textContent = '';
  if (!user || !pass) { err.textContent = 'Preencha nome e senha.'; return; }
  if (pass.length < 8) { err.textContent = 'Senha mínima: 8 caracteres.'; return; }
  try {
    await createUser(user, pass, role);
    document.getElementById('new-user-name').value = '';
    document.getElementById('new-user-pass').value = '';
    renderUsersList();
    showToast('✅ Utilizador criado!');
  } catch(e) { err.textContent = e.message; }
}

async function promptResetPassword(username) {
  const newPass = prompt(`Nova senha para "${username}" (mínimo 8 caracteres):`);
  if (!newPass) return;
  if (newPass.length < 8) { alert('Senha muito curta.'); return; }
  await adminResetPassword(username, newPass);
  showToast('✅ Senha alterada!');
}

function confirmDeleteUser(username) {
  if (!confirm(`Eliminar utilizador "${username}"? Esta acção não pode ser desfeita.`)) return;
  deleteUser(username);
  renderUsersList();
  showToast('🗑️ Utilizador eliminado.');
}

async function doChangeOwnPassword() {
  const old  = document.getElementById('chg-old-pass')?.value;
  const nw   = document.getElementById('chg-new-pass')?.value;
  const conf = document.getElementById('chg-conf-pass')?.value;
  const err  = document.getElementById('chg-pass-err');
  err.textContent = '';
  if (!old || !nw) { err.textContent = 'Preencha todos os campos.'; return; }
  if (nw.length < 8) { err.textContent = 'Senha mínima: 8 caracteres.'; return; }
  if (nw !== conf)   { err.textContent = 'As senhas não coincidem.'; return; }
  try {
    await changePassword(currentUser(), old, nw);
    document.getElementById('chg-old-pass').value = '';
    document.getElementById('chg-new-pass').value = '';
    document.getElementById('chg-conf-pass').value = '';
    showToast('✅ Senha alterada com sucesso!');
  } catch(e) { err.textContent = e.message; }
}

/* ══════════════════════════════════════════════════════════════════════════
   BACKUP — Export JSON cifrado
   ══════════════════════════════════════════════════════════════════════════ */
async function exportBackup() {
  const pass  = document.getElementById('backup-pass')?.value;
  const conf  = document.getElementById('backup-conf')?.value;
  const err   = document.getElementById('backup-err');
  err.textContent = '';

  if (!pass) { err.textContent = 'Defina uma senha para o backup.'; return; }
  if (pass.length < 8) { err.textContent = 'Senha mínima: 8 caracteres.'; return; }
  if (pass !== conf)   { err.textContent = 'As senhas não coincidem.'; return; }

  try {
    const fichas   = await dbGetAll();
    const clientes = await dbGetAllClientes();
    const payload  = {
      version:    2,
      exportedAt: new Date().toISOString(),
      exportedBy: currentUser(),
      fichas, clientes
    };

    const encrypted = await encryptData(payload, pass);
    const blob = new Blob([JSON.stringify({ br_backup: true, v: 2, data: encrypted })],
                          { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `beleza-rara-backup-${new Date().toISOString().slice(0,10)}.brb`;
    a.click();
    URL.revokeObjectURL(url);

    document.getElementById('backup-pass').value = '';
    document.getElementById('backup-conf').value = '';
    showToast('✅ Backup exportado com sucesso!');
  } catch(e) {
    err.textContent = 'Erro ao exportar: ' + e.message;
    console.error(e);
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   RESTORE — Import JSON cifrado
   ══════════════════════════════════════════════════════════════════════════ */
async function importBackup() {
  const file    = document.getElementById('restore-file')?.files[0];
  const pass    = document.getElementById('restore-pass')?.value;
  const mode    = document.querySelector('input[name="restore-mode"]:checked')?.value || 'merge';
  const err     = document.getElementById('restore-err');
  err.textContent = '';

  if (!file) { err.textContent = 'Selecione um ficheiro de backup.'; return; }
  if (!pass) { err.textContent = 'Introduza a senha do backup.'; return; }

  try {
    const text = await file.text();
    const raw  = JSON.parse(text);
    if (!raw.br_backup) throw new Error('Ficheiro inválido ou corrompido.');

    const payload = await decryptData(raw.data, pass);

    let fichasCount   = 0;
    let clientesCount = 0;

    if (mode === 'replace') {
      // Clear all existing data
      const d = await openDB();
      await new Promise((res, rej) => {
        const tx = d.transaction([STORE, STORE_CLI], 'readwrite');
        tx.objectStore(STORE).clear().onsuccess    = () => {};
        tx.objectStore(STORE_CLI).clear().onsuccess = () => {};
        tx.oncomplete = res; tx.onerror = e => rej(e.target.error);
      });
    }

    // Import fichas
    for (const f of (payload.fichas || [])) {
      const copy = { ...f }; delete copy.id;
      await dbSave(copy);
      fichasCount++;
    }

    // Import clientes
    for (const c of (payload.clientes || [])) {
      const copy = { ...c }; delete copy.id;
      await dbSaveCliente(copy);
      clientesCount++;
    }

    document.getElementById('restore-file').value = '';
    document.getElementById('restore-pass').value  = '';
    showToast(`✅ Restaurado: ${fichasCount} fichas, ${clientesCount} clientes.`);
    err.style.color = 'green';
    err.textContent = `✅ ${fichasCount} fichas e ${clientesCount} clientes importados com sucesso.`;
  } catch(e) {
    if (e.name === 'OperationError') {
      err.textContent = '❌ Senha incorrecta ou ficheiro corrompido.';
    } else {
      err.textContent = '❌ Erro: ' + e.message;
    }
    console.error(e);
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   RELATÓRIO RGPD — Export auditável
   ══════════════════════════════════════════════════════════════════════════ */
async function exportRGPD() {
  const fichas   = await dbGetAll();
  const clientes = await dbGetAllClientes();
  const now      = new Date();

  // Build a clean readable report (no signatures/images for conciseness)
  const report = {
    titulo:      'Relatório de Dados Pessoais — Beleza Rara',
    geradoEm:    now.toISOString(),
    geradoPor:   currentUser(),
    totalFichas: fichas.length,
    totalClientes: clientes.length,
    notaLegal: 'Este relatório foi gerado ao abrigo do Art. 30.º do RGPD (Registos de actividades de tratamento). Os dados são tratados exclusivamente para fins de prestação de serviços estéticos e saúde, com base no consentimento do titular (Art. 6.º, al. a).',

    clientes: clientes.map(c => ({
      id:          c.id,
      nome:        c.nome || '',
      dataNasc:    c.nasc || '',
      sexo:        c.sexo || '',
      nacionalidade: c.nac || '',
      telefone:    c.tel  || '',
      email:       c.email || '',
      morada:      c.morada || '',
      doc:         c.doc   || '',
      cadastradoEm: c.createdAt || '',
    })),

    fichas: fichas.map(f => {
      const base = {
        id:            f.id,
        procedimento:  f.proc,
        data:          f.atendData || f.dataRegisto || '',
        nome:          f.nome || '',
        profissional:  f.profissional || '',
        autorizacaoImagem: f.imgAuth || '',
      };
      // Omit large data URLs from report
      return base;
    }),
  };

  // Generate formatted JSON report
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `RGPD-beleza-rara-${now.toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('✅ Relatório RGPD exportado!');

  // Also generate human-readable HTML version
  const html = buildRGPDHtml(report);
  const blob2 = new Blob([html], { type: 'text/html' });
  const url2  = URL.createObjectURL(blob2);
  const a2    = document.createElement('a');
  a2.href     = url2;
  a2.download = `RGPD-beleza-rara-${now.toISOString().slice(0,10)}.html`;
  a2.click();
  URL.revokeObjectURL(url2);
}

function buildRGPDHtml(r) {
  const rows = r.clientes.map(c => `
    <tr>
      <td>${c.id}</td><td>${c.nome}</td><td>${c.dataNasc}</td>
      <td>${c.sexo}</td><td>${c.nacionalidade}</td>
      <td>${c.telefone}</td><td>${c.email}</td><td>${c.doc}</td>
    </tr>`).join('');

  const fichaRows = r.fichas.map(f => `
    <tr>
      <td>${f.id}</td><td>${f.nome}</td><td>${f.procedimento}</td>
      <td>${f.data}</td><td>${f.profissional}</td><td>${f.autorizacaoImagem}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="pt"><head><meta charset="UTF-8">
<title>Relatório RGPD — Beleza Rara</title>
<style>
  body { font-family: Arial, sans-serif; max-width: 1100px; margin: 30px auto; color: #222; }
  h1 { color: #E46589; } h2 { color: #555; border-bottom: 2px solid #E46589; padding-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 13px; }
  th { background: #E46589; color: white; padding: 8px; text-align: left; }
  td { padding: 7px 8px; border-bottom: 1px solid #eee; }
  tr:nth-child(even) td { background: #fff5f9; }
  .meta { background: #fff5f9; border: 1px solid #f0c0d6; border-radius: 8px; padding: 16px; margin-bottom: 24px; }
  .legal { font-size: 12px; color: #777; font-style: italic; }
</style></head><body>
<h1>📋 Relatório de Dados Pessoais</h1>
<div class="meta">
  <strong>Gerado em:</strong> ${r.geradoEm}<br>
  <strong>Gerado por:</strong> ${r.geradoPor}<br>
  <strong>Total de fichas:</strong> ${r.totalFichas} &nbsp;|&nbsp;
  <strong>Total de clientes:</strong> ${r.totalClientes}
</div>
<p class="legal">${r.notaLegal}</p>

<h2>👥 Clientes Cadastradas (${r.clientes.length})</h2>
<table>
  <thead><tr><th>#</th><th>Nome</th><th>Nasc.</th><th>Sexo</th><th>Nac.</th><th>Telefone</th><th>E-mail</th><th>Doc.</th></tr></thead>
  <tbody>${rows}</tbody>
</table>

<h2>📂 Fichas de Anamnese (${r.fichas.length})</h2>
<table>
  <thead><tr><th>#</th><th>Nome</th><th>Procedimento</th><th>Data</th><th>Profissional</th><th>Autor. Imagem</th></tr></thead>
  <tbody>${fichaRows}</tbody>
</table>
</body></html>`;
}
