/* ==========================================================================
   BELEZA RARA – Security Module
   Autenticação local · Cifra AES-GCM · Backup/Restore · Relatório RGPD
   ========================================================================== */
'use strict';

/* ── HTML escape (fallback — app.js loads first with the full version) ── */
const _esc = typeof esc === 'function' ? esc : s => String(s||'')
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;').replace(/'/g,'&#x27;');


/* ══════════════════════════════════════════════════════════════════════════
   ESTADO DE AUTENTICAÇÃO
   ══════════════════════════════════════════════════════════════════════════ */
let _authSession = null;
const SESSION_KEY = 'br_session';
const USERS_KEY   = 'br_users_v1';
const SESSION_TTL = 8 * 60 * 60 * 1000;   // 8 horas

/* ══════════════════════════════════════════════════════════════════════════
   WEB CRYPTO — PBKDF2 + AES-GCM
   ══════════════════════════════════════════════════════════════════════════ */
const _crypto = window.crypto || window.msCrypto;
const _subtle  = _crypto.subtle;

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
function buf2b64(buf) {
  const bytes  = new Uint8Array(buf);
  const CHUNK  = 8192;   // safe chunk size — avoids call stack overflow
  let   binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
function b642buf(b64)  {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

/* ── Key material import (shared by hash + encrypt paths) ── */
async function importKeyMaterial(password) {
  return _subtle.importKey('raw', str2buf(password), 'PBKDF2', false, ['deriveBits', 'deriveKey']);
}

/**
 * Derive 256 raw bits from password + salt using PBKDF2.
 * Uses deriveBits — no exportKey required, avoids "key is not extractable" error.
 * 310,000 iterations — OWASP 2023 recommendation.
 */
async function deriveBitsFromPassword(password, salt) {
  const saltBuf     = typeof salt === 'string' ? hex2buf(salt) : salt;
  const keyMaterial = await importKeyMaterial(password);
  return _subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBuf, iterations: 310_000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
}

/**
 * Derive an AES-GCM encryption key — used ONLY for encrypt/decrypt, never exported.
 */
async function deriveKey(password, salt) {
  const saltBuf     = typeof salt === 'string' ? hex2buf(salt) : salt;
  const keyMaterial = await importKeyMaterial(password);
  return _subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBuf, iterations: 310_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,   // NOT extractable
    ['encrypt', 'decrypt']
  );
}

/** Hash a password for storage using deriveBits (no exportKey). */
async function hashPassword(password) {
  const salt = _crypto.getRandomValues(new Uint8Array(32));
  const bits = await deriveBitsFromPassword(password, salt.buffer);
  return { salt: buf2hex(salt.buffer), hash: buf2hex(bits) };
}

/** Verify password against stored salt+hash. */
async function verifyPassword(password, storedSalt, storedHash) {
  const bits = await deriveBitsFromPassword(password, storedSalt);
  return buf2hex(bits) === storedHash;
}

/** Encrypt arbitrary JSON with AES-GCM. */
async function encryptData(data, password) {
  const salt   = _crypto.getRandomValues(new Uint8Array(32));
  const iv     = _crypto.getRandomValues(new Uint8Array(12));
  const key    = await deriveKey(password, salt);
  const enc    = await _subtle.encrypt({ name: 'AES-GCM', iv }, key,
                                        str2buf(JSON.stringify(data)));
  const packed = new Uint8Array(32 + 12 + enc.byteLength);
  packed.set(new Uint8Array(salt),  0);
  packed.set(new Uint8Array(iv),   32);
  packed.set(new Uint8Array(enc),  44);
  return buf2b64(packed.buffer);
}

/** Decrypt AES-GCM payload. */
async function decryptData(b64, password) {
  const packed = new Uint8Array(b642buf(b64));
  const salt   = packed.slice(0, 32);
  const iv     = packed.slice(32, 44);
  const cipher = packed.slice(44);
  const key    = await deriveKey(password, salt);
  const plain  = await _subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
  return JSON.parse(buf2str(plain));
}

/* ══════════════════════════════════════════════════════════════════════════
   GESTÃO DE UTILIZADORES (localStorage, apenas hashes)
   ══════════════════════════════════════════════════════════════════════════ */
function getUsers()          { try { return JSON.parse(localStorage.getItem(USERS_KEY) || '{}'); } catch { return {}; } }
function saveUsers(users)    { localStorage.setItem(USERS_KEY, JSON.stringify(users)); }
function hasAnyUser()        { return Object.keys(getUsers()).length > 0; }
function getUserRole(u)      { return getUsers()[u]?.role || 'user'; }
function getAllUsers()        { return Object.entries(getUsers()).map(([u,d]) => ({ username:u, role:d.role, createdAt:d.createdAt })); }
function deleteUser(u)       { const us=getUsers(); delete us[u]; saveUsers(us); }

async function createUser(username, password, role) {
  const users = getUsers();
  if (users[username]) throw new Error('Utilizador já existe.');
  const { salt, hash } = await hashPassword(password);
  users[username] = { salt, hash, role: role||'user', createdAt: new Date().toISOString() };
  saveUsers(users);
}

async function loginUser(username, password) {
  const u = getUsers()[username];
  if (!u) return false;
  return verifyPassword(password, u.salt, u.hash);
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

function clearSession()  { _authSession = null; sessionStorage.removeItem(SESSION_KEY); }
function isLoggedIn()    { return !!_authSession; }
function currentUser()   { return _authSession?.user || ''; }
function isAdmin()       { return _authSession?.role === 'admin'; }

/* ══════════════════════════════════════════════════════════════════════════
   NAVEGAÇÃO DE ECRÃS
   ══════════════════════════════════════════════════════════════════════════ */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    s.style.display = 'none';
  });
  const el = document.getElementById(id);
  if (el) { el.style.display = 'flex'; el.classList.add('active'); }
}

/* ══════════════════════════════════════════════════════════════════════════
   ARRANQUE
   ══════════════════════════════════════════════════════════════════════════ */
async function bootApp() {
  await openDB();
  if (!hasAnyUser()) { showScreen('screen-setup'); return; }
  if (loadSession()) { showScreen('screen-select'); updateUserBadge(); return; }
  showScreen('screen-login');
}

function updateUserBadge() {
  const el = document.getElementById('user-badge');
  if (el) el.textContent = '👤 ' + currentUser();
  const adminArea = document.getElementById('admin-only-btns');
  if (adminArea) adminArea.style.display = isAdmin() ? 'flex' : 'none';
}

/* ── SETUP ── */
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

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.getElementById('screen-login')?.classList.contains('active')) {
    doLogin();
  }
});

/* Utility: toggle password visibility */
function togglePass(inputId, btn) {
  const inp = document.getElementById(inputId);
  if (!inp) return;
  inp.type    = inp.type === 'password' ? 'text' : 'password';
  btn.textContent = inp.type === 'password' ? '👁' : '🙈';
}

/* ══════════════════════════════════════════════════════════════════════════
   ECRÃ DE DEFINIÇÕES
   ══════════════════════════════════════════════════════════════════════════ */
function showDefinicoes() {
  if (!isAdmin()) { showToast('⚠️ Acesso restrito a administradores.'); return; }
  showScreen('screen-definicoes');
  renderUsersList();
}

function backFromDefinicoes() { showScreen('screen-select'); }

function renderUsersList() {
  const el = document.getElementById('users-list');
  if (!el) return;
  el.innerHTML = getAllUsers().map(u => {
    const safeUser = _esc(u.username);
    const safeRole = u.role === 'admin' ? '⭐ Admin' : '👁️ Utilizador';
    // onclick uses the raw username via data attribute to avoid injection in attribute
    return `<div class="user-row">
      <div class="user-row-info">
        <span class="user-row-name">👤 ${safeUser}</span>
        <span class="user-row-role ${u.role === 'admin' ? 'admin' : 'user'}">${safeRole}</span>
      </div>
      <div class="user-row-actions">
        ${u.username !== currentUser()
          ? `<button class="btn-user-reset" data-user="${safeUser}" onclick="promptResetPassword(this.dataset.user)">🔑 Senha</button>
             <button class="btn-user-del"   data-user="${safeUser}" onclick="confirmDeleteUser(this.dataset.user)">🗑️</button>`
          : '<span style="font-size:12px;color:var(--gray);">(você)</span>'}
      </div>
    </div>`;
  }).join('');
}

async function addUser() {
  if (!isAdmin()) { showToast('⚠️ Sem permissão para criar utilizadores.'); return; }
  const user = document.getElementById('new-user-name')?.value.trim();
  const pass = document.getElementById('new-user-pass')?.value;
  const role = document.getElementById('new-user-role')?.value || 'user';
  const err  = document.getElementById('add-user-err');
  err.textContent = '';
  if (!user || !pass)  { err.textContent = 'Preencha nome e senha.'; return; }
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
  if (!isAdmin()) { showToast('⚠️ Sem permissão.'); return; }
  const newPass = prompt(`Nova senha para "${username}" (mínimo 8 caracteres):`);
  if (!newPass) return;
  if (newPass.length < 8) { alert('Senha muito curta.'); return; }
  await adminResetPassword(username, newPass);
  showToast('✅ Senha alterada!');
}

function confirmDeleteUser(username) {
  if (!isAdmin()) { showToast('⚠️ Sem permissão.'); return; }
  if (!confirm(`Eliminar utilizador "${username}"?`)) return;
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
  if (!old || !nw)   { err.textContent = 'Preencha todos os campos.'; return; }
  if (nw.length < 8) { err.textContent = 'Senha mínima: 8 caracteres.'; return; }
  if (nw !== conf)   { err.textContent = 'As senhas não coincidem.'; return; }
  try {
    await changePassword(currentUser(), old, nw);
    ['chg-old-pass','chg-new-pass','chg-conf-pass'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    showToast('✅ Senha alterada com sucesso!');
  } catch(e) { err.textContent = e.message; }
}

/* ══════════════════════════════════════════════════════════════════════════
   BACKUP — Export JSON cifrado
   ══════════════════════════════════════════════════════════════════════════ */
async function exportBackup() {
  const pass = document.getElementById('backup-pass')?.value;
  const conf = document.getElementById('backup-conf')?.value;
  const err  = document.getElementById('backup-err');
  err.textContent = '';
  if (!pass)           { err.textContent = 'Defina uma senha para o backup.'; return; }
  if (pass.length < 8) { err.textContent = 'Senha mínima: 8 caracteres.'; return; }
  if (pass !== conf)   { err.textContent = 'As senhas não coincidem.'; return; }
  try {
    const fichas   = await dbGetAll();
    const clientes = await dbGetAllClientes();
    const encrypted = await encryptData({ version:2, exportedAt:new Date().toISOString(),
                                          exportedBy:currentUser(), fichas, clientes }, pass);
    const filename = `beleza-rara-backup-${new Date().toISOString().slice(0,10)}.brb`;
    const payload  = JSON.stringify({ br_backup:true, v:2, data:encrypted });
    const blob     = new Blob([payload], { type:'application/json' });

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    if (isIOS && navigator.share && navigator.canShare) {
      // iOS: use Web Share API — allows saving to Files, AirDrop, email, etc.
      try {
        const file = new File([blob], filename, { type: 'application/json' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Backup Fichas de Anamnese' });
        } else {
          // Fallback: show the content in a modal to copy manually
          _showBackupTextFallback(payload, filename);
        }
      } catch(shareErr) {
        if (shareErr.name !== 'AbortError') {
          // User cancelled share — that's fine; also show text fallback
          _showBackupTextFallback(payload, filename);
        }
      }
    } else {
      // Desktop / Android / non-iOS: standard download
      const a = Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(blob), download: filename
      });
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    }

    document.getElementById('backup-pass').value = '';
    document.getElementById('backup-conf').value = '';
    showToast('✅ Backup exportado com sucesso!');
  } catch(e) { err.textContent = 'Erro ao exportar: ' + e.message; console.error(e); }
}

/* ── iOS text fallback for backup export ── */
function _showBackupTextFallback(payload, filename) {
  // Create a modal with the backup text so user can copy it
  const existing = document.getElementById('_backup-text-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = '_backup-text-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
  modal.innerHTML = `
    <div style="background:white;border-radius:16px;padding:24px;max-width:500px;width:100%;max-height:80vh;overflow-y:auto;">
      <h3 style="font-family:Georgia,serif;color:#e36485;margin-bottom:8px;">💾 Guardar Backup</h3>
      <p style="font-size:13px;color:#666;margin-bottom:12px;">
        Selecione todo o texto abaixo, copie e guarde num ficheiro de texto (.txt ou .brb) usando as Notas ou Ficheiros do iPad:
      </p>
      <textarea readonly style="width:100%;height:120px;font-size:10px;font-family:monospace;border:2px solid #e36485;border-radius:8px;padding:8px;resize:none;">${payload}</textarea>
      <p style="font-size:11px;color:#999;margin:8px 0;">Nome sugerido do ficheiro: <strong>${filename}</strong></p>
      <div style="display:flex;gap:8px;margin-top:12px;">
        <button onclick="(async()=>{try{await navigator.clipboard.writeText(document.querySelector('#_backup-text-modal textarea').value);alert('Copiado! Cole nas Notas e guarde como ${filename}');}catch(e){alert('Selecione e copie o texto manualmente');}})();"
          style="flex:1;background:#e36485;color:white;border:none;border-radius:8px;padding:10px;font-weight:700;font-size:13px;cursor:pointer;">
          📋 Copiar para Clipboard
        </button>
        <button onclick="document.getElementById('_backup-text-modal').remove();"
          style="flex:1;background:#f3f4f6;color:#666;border:none;border-radius:8px;padding:10px;font-weight:700;font-size:13px;cursor:pointer;">
          Fechar
        </button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

/* ══════════════════════════════════════════════════════════════════════════
   RESTORE — Import JSON cifrado
   ══════════════════════════════════════════════════════════════════════════ */
/* ── Lê um File como texto — compatível com iOS/Safari (sem File.text()) ── */
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    if (typeof file.text === 'function') {
      // Modern browsers (Chrome, Firefox, Edge)
      file.text().then(resolve).catch(reject);
    } else {
      // Safari / iOS / older WebKit — use FileReader
      const reader = new FileReader();
      reader.onload  = e => resolve(e.target.result);
      reader.onerror = e => reject(new Error('Erro ao ler ficheiro: ' + e.target.error));
      reader.readAsText(file, 'UTF-8');
    }
  });
}

async function importBackup() {
  const fileInput = document.getElementById('restore-file');
  const file = fileInput?.files[0];
  const pass = document.getElementById('restore-pass')?.value;
  const mode = document.querySelector('input[name="restore-mode"]:checked')?.value || 'merge';
  const err  = document.getElementById('restore-err');
  err.textContent = ''; err.style.color = 'red';

  if (!file) {
    // iOS PWA: file picker sometimes doesn't trigger — show paste fallback
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (isIOS) {
      err.style.color = '#b45309';
      err.textContent = '⚠️ No iPad: toque no botão de ficheiro, selecione "Ficheiros" e escolha o .brb. '
                      + 'Se não aparecer, use a opção "Colar conteúdo" abaixo.';
    } else {
      err.textContent = 'Selecione um ficheiro de backup.';
    }
    return;
  }
  if (!pass) { err.textContent = 'Introduza a senha do backup.'; return; }

  const btn = document.querySelector('button[onclick="importBackup()"]');
  if (btn) { btn.textContent = '⏳ A processar…'; btn.disabled = true; }

  try {
    // Use FileReader-based read (iOS-safe)
    const text = await readFileAsText(file);

    let raw;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new Error('Ficheiro não é JSON válido. Certifique-se de que seleccionou o ficheiro .brb correcto.');
    }

    if (!raw.br_backup) throw new Error('Ficheiro inválido — não é um backup desta aplicação.');
    if (!raw.data)      throw new Error('Ficheiro corrompido — campo de dados em falta.');

    const payload = await decryptData(raw.data, pass);

    if (mode === 'replace') {
      const d = await openDB();
      if (d && d._isREST) {
        // Desktop REST mode
        const [af, ac] = await Promise.all([dbGetAll(), dbGetAllClientes()]);
        await Promise.all(af.map(f => fetch(`/api/fichas/${f.id}`, {method:'DELETE'})));
        await Promise.all(ac.map(c => fetch(`/api/clientes/${c.id}`, {method:'DELETE'})));
      } else if (d) {
        await new Promise((res, rej) => {
          const tx = d.transaction([STORE, STORE_CLI], 'readwrite');
          tx.objectStore(STORE).clear(); tx.objectStore(STORE_CLI).clear();
          tx.oncomplete = res; tx.onerror = e => rej(e.target.error);
        });
      }
    }

    let fc = 0, cc = 0;
    for (const f of (payload.fichas   || [])) { const c = {...f}; delete c.id; await dbSave(c);        fc++; }
    for (const c of (payload.clientes || [])) { const x = {...c}; delete x.id; await dbSaveCliente(x); cc++; }

    // Reset form
    fileInput.value = '';
    document.getElementById('restore-pass').value = '';
    err.style.color   = 'green';
    err.textContent   = `✅ ${fc} ficha(s) e ${cc} cliente(s) importado(s) com sucesso.`;
    showToast(`✅ Restaurado: ${fc} fichas, ${cc} clientes.`);
  } catch(e) {
    err.style.color = 'red';
    err.textContent = e.name === 'OperationError'
      ? '❌ Senha incorrecta ou ficheiro corrompido.'
      : '❌ Erro: ' + e.message;
    console.error('[importBackup]', e);
  } finally {
    if (btn) { btn.textContent = '⬆️ Restaurar Backup'; btn.disabled = false; }
  }
}

/* ── Restore a partir de texto colado (fallback para iOS PWA) ── */
async function importBackupFromText() {
  const textarea = document.getElementById('restore-paste-area');
  const pass     = document.getElementById('restore-pass')?.value;
  const mode     = document.querySelector('input[name="restore-mode"]:checked')?.value || 'merge';
  const err      = document.getElementById('restore-err');
  err.textContent = ''; err.style.color = 'red';

  const text = textarea?.value?.trim();
  if (!text) { err.textContent = 'Cole o conteúdo do ficheiro de backup no campo de texto.'; return; }
  if (!pass) { err.textContent = 'Introduza a senha do backup.'; return; }

  // Reuse the same import logic by creating a fake File
  const blob = new Blob([text], {type: 'application/json'});
  const fakeFile = new File([blob], 'backup.brb', {type: 'application/json'});

  // Inject into file input and call main import
  const dt = new DataTransfer();
  dt.items.add(fakeFile);
  document.getElementById('restore-file').files = dt.files;
  await importBackup();
  if (textarea) textarea.value = '';
}

/* ══════════════════════════════════════════════════════════════════════════
   RELATÓRIO RGPD
   ══════════════════════════════════════════════════════════════════════════ */
async function exportRGPD() {
  const fichas   = await dbGetAll();
  const clientes = await dbGetAllClientes();
  const now      = new Date();
  const report   = {
    titulo:'Relatório de Dados Pessoais — Beleza Rara',
    geradoEm:now.toISOString(), geradoPor:currentUser(),
    totalFichas:fichas.length, totalClientes:clientes.length,
    notaLegal:'Gerado ao abrigo do Art. 30.º do RGPD. Dados tratados para fins de serviços estéticos com base no consentimento do titular (Art. 6.º, al. a).',
    clientes: clientes.map(c => ({ id:c.id, nome:c.nome||'', dataNasc:c.nasc||'', sexo:c.sexo||'',
      nacionalidade:c.nac||'', telefone:c.tel||'', email:c.email||'', morada:c.morada||'', doc:c.doc||'' })),
    fichas: fichas.map(f => ({ id:f.id, procedimento:f.proc, data:f.atendData||f.dataRegisto||'',
      nome:f.nome||'', profissional:f.profissional||'', autorizacaoImagem:f.imgAuth||'' })),
  };

  const dl = (content, type, name) => {
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([content], {type})), download: name
    });
    a.click(); URL.revokeObjectURL(a.href);
  };

  dl(JSON.stringify(report, null, 2), 'application/json',
     `RGPD-beleza-rara-${now.toISOString().slice(0,10)}.json`);
  dl(buildRGPDHtml(report), 'text/html',
     `RGPD-beleza-rara-${now.toISOString().slice(0,10)}.html`);
  showToast('✅ Relatório RGPD exportado (JSON + HTML)!');
}

function buildRGPDHtml(r) {
  const clRows = r.clientes.map(c =>
    `<tr><td>${c.id}</td><td>${c.nome}</td><td>${c.dataNasc}</td><td>${c.sexo}</td>
     <td>${c.nacionalidade}</td><td>${c.telefone}</td><td>${c.email}</td><td>${c.doc}</td></tr>`
  ).join('');
  const fRows = r.fichas.map(f =>
    `<tr><td>${f.id}</td><td>${f.nome}</td><td>${f.procedimento}</td>
     <td>${f.data}</td><td>${f.profissional}</td><td>${f.autorizacaoImagem}</td></tr>`
  ).join('');
  return `<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8">
<title>Relatório RGPD — Beleza Rara</title>
<style>
  body{font-family:Arial,sans-serif;max-width:1100px;margin:30px auto;color:#222}
  h1{color:#E46589} h2{color:#555;border-bottom:2px solid #E46589;padding-bottom:6px;margin-top:32px}
  table{width:100%;border-collapse:collapse;margin-bottom:30px;font-size:13px}
  th{background:#E46589;color:white;padding:8px;text-align:left}
  td{padding:7px 8px;border-bottom:1px solid #eee}
  tr:nth-child(even) td{background:#fff5f9}
  .meta{background:#fff5f9;border:1px solid #f0c0d6;border-radius:8px;padding:16px;margin-bottom:24px}
  .legal{font-size:12px;color:#777;font-style:italic;margin-bottom:24px}
</style></head><body>
<h1>📋 Relatório de Dados Pessoais — Beleza Rara</h1>
<div class="meta">
  <strong>Gerado em:</strong> ${r.geradoEm} &nbsp;|&nbsp;
  <strong>Por:</strong> ${r.geradoPor} &nbsp;|&nbsp;
  <strong>Fichas:</strong> ${r.totalFichas} &nbsp;|&nbsp;
  <strong>Clientes:</strong> ${r.totalClientes}
</div>
<p class="legal">${r.notaLegal}</p>
<h2>👥 Clientes (${r.clientes.length})</h2>
<table><thead><tr><th>#</th><th>Nome</th><th>Nasc.</th><th>Sexo</th>
<th>Nacionalidade</th><th>Telefone</th><th>E-mail</th><th>Doc.</th></tr></thead>
<tbody>${clRows}</tbody></table>
<h2>📂 Fichas de Anamnese (${r.fichas.length})</h2>
<table><thead><tr><th>#</th><th>Nome</th><th>Procedimento</th>
<th>Data</th><th>Profissional</th><th>Autor. Imagem</th></tr></thead>
<tbody>${fRows}</tbody></table>
</body></html>`;
}
