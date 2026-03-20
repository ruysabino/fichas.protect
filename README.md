# 💗 Beleza Rara — Fichas de Anamnese Digital

> Sistema web para preenchimento e impressão de fichas de anamnese  
> **Beleza Rara · Valquiria Almeida** · Fundão, Portugal

---

## ✨ Funcionalidades

| Procedimento | Documentos gerados |
|---|---|
| 👁️ Extensão de Pestanas | Ficha de Anamnese + Termo de Consentimento + Autorização de Imagem |
| ✨ Depilação | Ficha de Anamnese com histórico completo |
| ⚡ Laser de Diodo | Ficha clínica detalhada + Tabela de registo de sessões |

- ✅ Impressão fiel ao design original (logo, cores, layout)
- ✅ Gera PDF directamente pelo browser (Imprimir → Guardar como PDF)
- ✅ Dados nunca saem do dispositivo — sem servidor, sem base de dados
- ✅ Funciona offline depois do primeiro carregamento
- ✅ Responsivo — funciona em tablet e telemóvel
- ✅ Sem dependências externas · HTML + CSS + JS puro

---

## 🚀 Como usar

### 1. Aceder ao site
Abra o link do GitHub Pages no browser (Chrome ou Edge recomendado para impressão).

### 2. Seleccionar o procedimento
Clique no cartão correspondente ao tratamento da cliente.

### 3. Preencher os dados
Navegue pelas secções e preencha todos os campos relevantes.  
Campos de Sim/Não têm botões de selecção directa.

### 4. Imprimir / Guardar PDF
Clique em **🖨️ Imprimir / Gerar PDF** (barra de topo ou fundo da página).  
No diálogo de impressão do browser:
- Seleccione **"Guardar como PDF"** como destino
- Formato: **A4 · Vertical**
- Margens: **Predefinidas** (o layout já tem margens internas)
- Active **"Gráficos de fundo"** para preservar cores e logótipo
- Clique **Guardar**

---

## 📁 Estrutura de ficheiros

```
beleza-rara-fichas/
├── index.html              ← Aplicação principal
├── style.css               ← Estilos da interface e estilos de impressão
├── app.js                  ← Lógica e geração dos documentos
├── README.md               ← Este ficheiro
└── assets/
    ├── logo-icon.svg              ← Ícone principal (fundo rosa)
    ├── logo-horizontal.svg        ← Logo com texto, horizontal
    ├── logo-vertical.svg          ← Logo com texto, vertical (stacked)
    ├── favicon.svg                ← Favicon vectorial
    ├── favicon.ico                ← Favicon multi-resolução (16/32/48/64px)
    ├── apple-touch-icon.png       ← Ícone iOS (180×180)
    ├── logo-icon-512.png          ← PNG fundo rosa, 512×512
    ├── logo-icon-256.png          ← PNG fundo rosa, 256×256
    ├── logo-icon-192.png          ← PNG fundo rosa, 192×192 (PWA)
    ├── logo-icon-128.png          ← PNG fundo rosa, 128×128
    ├── logo-icon-64.png           ← PNG fundo rosa, 64×64
    ├── logo-icon-32.png           ← PNG fundo rosa, 32×32
    ├── logo-icon-transparent-512.png   ← PNG transparente, 512×512
    ├── logo-icon-transparent-256.png   ← PNG transparente, 256×256
    ├── logo-icon-transparent-128.png   ← PNG transparente, 128×128
    ├── logo-icon-white-512.png    ← PNG branco (fundos escuros), 512×512
    └── logo-icon-white-256.png    ← PNG branco (fundos escuros), 256×256
```

---

## 🌐 Deploy no GitHub Pages

**1.** Crie um repositório público no GitHub (ex: `beleza-rara-fichas`)

**2.** Faça upload de todos os ficheiros mantendo a estrutura de pastas

**3.** Vá a **Settings → Pages → Source: Deploy from branch → main → / (root)** → Save

**4.** Aguarde 1–2 minutos. O site fica disponível em:
```
https://SEU-UTILIZADOR.github.io/beleza-rara-fichas/
```

---

## 🖨️ Dicas de impressão

| Situação | Solução |
|---|---|
| Fundo branco nos cabeçalhos | Activar **"Gráficos de fundo"** nas opções |
| Página cortada | Verificar tamanho **A4**, orientação **Vertical** |
| Melhor qualidade | Usar **Chrome** ou **Edge** |

---

## 🔒 Privacidade · RGPD

Nenhum dado é enviado para servidores externos. Todo o processamento ocorre localmente no browser. Os dados são apagados ao fechar ou recarregar a página. Os PDFs gerados ficam apenas no dispositivo local.

---

## 🛠️ Tecnologia

`HTML5` · `CSS3` · `JavaScript ES6+` · Sem frameworks · Sem dependências · Sem instalação

---

<div align="center">
  <sub>Desenvolvido com 💗 para <strong>Beleza Rara</strong> · Fundão, Portugal · © 2025</sub>
</div>
