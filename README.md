# Fichas de Anamnese — by Valquiria Almeida

Sistema digital de fichas de anamnese para salão de beleza, desenvolvido como aplicação web estática hospedada em GitHub Pages.

---

## Funcionalidades

- **4 fichas de anamnese**: Extensão de Pestanas, Depilação, Laser de Diodo, Manicure
- **Cadastro de clientes** com busca e preenchimento automático nas fichas
- **Assinatura digital** da cliente e do profissional (canvas, dedo/caneta/rato)
- **Exportar PDF** directamente do sistema (sem impressora virtual)
- **Import/Export de clientes** em CSV e XLSX
- **Backup cifrado** (AES-GCM) e restauro com senha
- **Relatório RGPD** exportável (JSON + HTML)
- **Autenticação** com utilizador e senha (PBKDF2, 310 000 iterações)
- **Gestão de utilizadores** com perfis Admin / Utilizador

---

## Armazenamento de dados

| Dados | Onde | Persistência |
|---|---|---|
| Fichas e clientes | **IndexedDB** no browser | Persistem entre sessões |
| Utilizadores e senhas (apenas hashes) | **localStorage** | Persistem entre sessões |
| Sessão activa | **sessionStorage** | Apagada ao fechar o separador |

> ⚠️ Os dados **ficam guardados no browser do dispositivo**. Para não perder dados, faça backups regulares em **Definições → Backup**.

---

## Dependências externas

O sistema funciona maioritariamente offline mas requer ligação à internet nas seguintes situações:

| Funcionalidade | Dependência | Quando |
|---|---|---|
| Tipografia | Google Fonts (Playfair Display, Nunito) | Sempre (fallback: Arial) |
| Exportar PDF | jsPDF + html2canvas (cdnjs / unpkg) | Primeira utilização por sessão |
| Exportar/Importar XLSX | SheetJS (cdnjs) | Primeira utilização por sessão |

Após o primeiro carregamento de cada sessão, as bibliotecas ficam em cache e o PDF/XLSX funciona sem re-download.

---

## Segurança

- Senhas armazenadas apenas como **hash PBKDF2-SHA256** (salt aleatório de 256 bits, 310 000 iterações)
- Backups cifrados com **AES-GCM 256-bit**
- Sessão com expiração de **8 horas**
- Funções administrativas protegidas por verificação de permissão server-side

> ℹ️ Por ser uma aplicação client-side, a segurança é adequada para uso interno. Não expor a utilizadores não confiáveis sem camada adicional de autenticação.

---

## Deploy (GitHub Pages)

```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages
on:
  push:
    branches: [ main ]
```

O deploy é automático a cada push para `main`.

---

## Estrutura de ficheiros

```
├── index.html      — Estrutura e ecrãs da aplicação
├── app.js          — Lógica principal, fichas, PDF, import/export
├── security.js     — Autenticação, cifra, backup/restore, RGPD
├── style.css       — Estilos
└── assets/         — Ícones e favicon
```
