# Ruby Diamond v0.1.0 — User Guide

Kompletan vodič kako se koristi Ruby Diamond aplikacija sa praktičnim primerima.

---

## Sadržaj

1. [Prvi Pokretanje](#1-prvi-pokretanje)
2. [Chat sa AI Agentom](#2-chat-sa-ai-agentom)
3. [Agent Mesh — Multi-Agent Debate](#3-agent-mesh--multi-agent-debate)
4. [System Monitor Dashboard](#4-system-monitor-dashboard)
5. [System Admin Agent](#5-system-admin-agent)
6. [Local LLM (llama.cpp)](#6-local-llm-llamacpp)
7. [Plugin Marketplace](#7-plugin-marketplace)
8. [Honcho Memory](#8-honcho-memory)
9. [File Explorer & Code Editor](#9-file-explorer--code-editor)
10. [Terminal](#10-terminal)
11. [Često Postavljana Pitanja](#11-često-postavljana-pitanja)

---

## 1. Prvi Pokretanje

### Desktop App (Tauri)
```bash
cd ~/ruby-diamond-client
pnpm tauri dev
```
Ovo otvara nativni prozor sa Ruby Diamond-om.

### Web Browser (bez Tauri)
```bash
cd ~/ruby-diamond-client
pnpm dev
```
Otvori `http://localhost:1420` u browseru.

### Šta vidite kad se otvori

1. **Splash screen** — animirani uvod sa "Ruby Diamond" natpisom
2. Pritisnite **Enter** ili sačekajte 10 sekundi
3. Automatski se kreira **"Ruby" agent** sa MiMo-V2.5-Pro modelom
4. Leva **sidebar** sa 7 ikonica za navigaciju

---

## 2. Chat sa AI Agentom

### Osnovno korišćenje

Kliknite na 💬 **Chat** ikonicu u sidebar-u.

**1. Napišite goal za agenta** — šta treba da uradi.

**Primer 1 — Istraživanje fajlova:**
```
Goal: Pročitaj fajl src-tauri/Cargo.toml i reci mi koje su zavisnosti
```
Agent će:
- Pozvati `read_file` tool
- Prikazati sadržaj
- Analizirati zavisnosti

**Primer 2 — Editovanje koda:**
```
Goal: U fajlu app.py, dodaj logging pre svakog API poziva
```
Agent će:
- Pročitati fajl
- Napraviti edit
- Prikazati diff

**Primer 3 — Bash komande:**
```
Goal: Pokaži mi zauzeće diska i top 5 procesa po RAM-u
```
Agent će pozvati `bash` tool i izvršiti komande.

### Kreiranje novog agenta

U Chat panelu možete kreirati novog agenta sa drugačijim providerom:

```typescript
// Primer konfiguracije za OpenAI
{
  provider: "openai",
  model: "gpt-4",
  api_key: "sk-...",
  max_tokens: 4096,
  temperature: 0.7
}
```

Podržani provideri: `openai`, `anthropic`, `deepseek`, `groq`, `xai`, `openrouter`, `cerebras`, `mistral`, `together`, `fireworks`, `ollama`, `llamacpp`.

---

## 3. Agent Mesh — Multi-Agent Debate

Kliknite na 🧠 **Agent Mesh** u sidebar-u.

### Debate Protocol

Dva agenta debatuju, treći sudi.

**Primer — Arhitekturna odluka:**
```
Goal: Treba da izaberemo između SQLite i PostgreSQL za Ruby Diamond.
       Koja je bolja opcija i zašto?
```

Tok:
1. **Proposer Alpha** predlaže rešenje
2. **Critic Beta** kritikuje predlog
3. **Judge Gamma** donosi konačnu odluku

**Kako koristiti:**
1. Izaberite "Debate" tab
2. Unesite Goal
3. Konfigurišite 3 agenta (možete koristiti isti provider ili različite)
4. Kliknite "Start Debate"

### Ensemble Protocol

Više agenta nezavisno rešava problem, rezultati se kombinuju.

**Primer — Code review:**
```
Goal: Review the code in src-tauri/src/commands.rs for security issues
```
Svaki agent daje nezavisnu recenziju, zatim se sintetizuje finalni izveštaj.

---

## 4. System Monitor Dashboard

Kliknite na 📊 **Activity** ikonicu u sidebar-u.

### Šta vidite

- **CPU** — overall usage + per-core grafikon (sa imenom procesora)
- **RAM** — total / used / free sa vizuelnim gauge-om
- **Swap** — total / used
- **Disk** — svaki mount point sa usage percent-om i filesystem type
- **Procesi** — tabela sa PID, name, CPU%, memory, status, runtime
- **Network** — interfejsi, total received/transmitted
- **Temperature** — senzori (ako su dostupni)

### Prilagođavanje

Možete promeniti:
- **Polling interval** — podrazumevano 2 sekunde
- **Boje gauge-ova** — svaka kategorija ima svoju boju
- **Paleta jezgara** — per-core CPU boje

Kod za boje možete menjadi u `src/components/SystemPanel.tsx`:

```typescript
const DEFAULT_CORE_COLORS = [
  "#E07A5F", "#A0522D", "#C17F59", "#5B8C5A",
  "#6B8CAA", "#C4889A", "#8B7AAA", "#5A9EA0",
];
```

### Browser Fallback

Ako ste u browser modu (bez Tauri), System Monitor prikazuje **mock podatke** sa random vrednostima — korisno za testiranje UI-a.

---

## 5. System Admin Agent

Kliknite na 🛡️ **Shield** ikonicu u sidebar-u.

Ovo je poseban DeepSeek-powered agent koji ima pristup bash-u i održava vaš Fedora sistem.

### Primeri komandi

**Provera zdravlja sistema:**
```
check system health
```
Pokreće: `df -h`, `free -h`, `uptime`, `systemctl --failed`

**Čišćenje sistema:**
```
clean up system
```
Pokreće: `sudo dnf clean all`, `sudo journalctl --vacuum-time=30d`, čišćenje `/tmp`

**Instalacija update-a:**
```
install updates
```
Pokreće: `sudo dnf update -y`, `flatpak update -y`

**Bezbednosna provera:**
```
check security
```
Proverava: SELinux status, firewall (firewalld), failed login attempts (`lastb`)

### API Key Setup

Prvi put kada otvorite SysAdmin panel, potrebno je uneti DeepSeek API ključ:
1. Unesite API ključ u polje
2. Kliknite "Save Key"
3. Ključ se čuva u `localStorage`

---

## 6. Local LLM (llama.cpp)

Kliknite na ⚙️ **Cpu** ikonicu u sidebar-u.

### Otkrivanje modela

Kliknite "Discover Models" — pretražuje:
- `models/`, `../models/`
- `~/.ruby-diamond/models/`
- `/home/dusanmilosavljevic/llama.cpp/models/`
- `/home/dusanmilosavljevic/minicpm5-1b/`

Samo fajlovi veći od 10MB sa `.gguf`, `.ggml`, ili `.bin` ekstenzijom se prikazuju.

### Pokretanje servera

1. Izaberite model iz liste
2. Kliknite "Start Server"
3. Server startuje na `http://localhost:8080`
4. Status se prikazuje (running / stopped)

### Korišćenje sa agentima

Kada je llama.cpp server pokrenut, možete kreirati agenta sa:
```typescript
{
  provider: "llamacpp",
  model: "llama-3.2-3b-instruct",  // ili koji god model ste pokrenuli
  base_url: "http://localhost:8080/v1",
  max_tokens: 2048,
  temperature: 0.7
}
```

### Zaustavljanje

Kliknite "Stop Server" — šalje SIGTERM llama.cpp process-u.

---

## 7. Plugin Marketplace

Kliknite na 📦 **Package** ikonicu u sidebar-u.

### Listanje instaliranih pluginova

Plugin Manager prikazuje sve skill-ove u `skills/` direktorijumu.

Trenutno instalirani:
- `code-review` — SKILL.md za code review workflow
- `project-bootstrap` — SKILL.md za inicijalizaciju projekta
- `rust-analyzer` — SKILL.md za Rust analizu

### Format SKILL.md

Svaki plugin je direktorijum sa `SKILL.md` fajlom:

```markdown
---
name: my-skill
description: My custom skill
---

## Instructions

Kada radiš [task], uradi sledeće:
1. Prvi korak
2. Drugi korak

## Pitfalls

- Ne radi X, uradi Y
```

### Dodavanje novog plugin-a (putem fajl sistema)

```bash
mkdir -p skills/my-new-skill
cat > skills/my-new-skill/SKILL.md << 'EOF'
---
name: my-new-skill
description: What this skill does
---

# Instructions
...
EOF
```

### Plugin Registry (budućnost)

`PluginManager` ima podršku za fetch-ovanje remote registry-ja preko URL-a. Ovo će omogućiti instalaciju pluginova iz centralnog repositorijuma.

---

## 8. Honcho Memory

Kliknite na 🗄️ **Database** ikonicu u sidebar-u.

### Šta je Honcho?

Honcho je sistem za **perzistentnu memoriju AI agenta**. Čuva:
- **Peers** — identitete agenta (ime, uloga, opis)
- **Sessions** — konverzacije sa porukama
- **Messages** — pojedinačne poruke u session-ima

### Korišćenje (kroz kod)

Honcho radi automatski u pozadini. Možete ga konfigurisati kroz environment varijable:

```bash
export HONCHO_API_KEY="your-honcho-api-key"
```

Default endpoint: `http://localhost:8000`

### Memory Panel

Panel prikazuje:
- Listu peer-ova (imena, uloge)
- Sesije za svakog peer-a
- Statistiku (broj poruka, workspace name)

---

## 9. File Explorer & Code Editor

### File Explorer

Leva strana aplikacije (ako je aktiviran explorer panel) prikazuje **file tree** — možete navigirati kroz direktorijume i otvarati fajlove.

Klikom na fajl:
- Otvara se u **CodeMirror editoru** sa syntax highlighting-om
- Podržani jezici: JavaScript, TypeScript, Python, Rust, HTML, CSS, JSON, Markdown
- Fajl se otvara u novom **tab-u**

### Code Editor Features

- **Syntax highlighting** — automatski detektuje jezik
- **Multi-tab** — otvorite više fajlova istovremeno
- **Dark tema** — One Dark pro theme
- **Search** — Ctrl+F za pretragu unutar fajla

---

## 10. Terminal

Na dnu aplikacije nalazi se **xterm.js terminal**.

### Korišćenje

- Radi kao regularan bash terminal
- Možete pokretati komande direktno
- Output se prikazuje u realnom vremenu

### Terminal u agentima

Kada agent pozove `bash` tool, rezultat se prikazuje u chat log-u. Terminal panel je za **direktnu** interakciju.

---

## 11. Često Postavljana Pitanja

### Kako da promenim API ključ za agenta?

U `src/App.tsx` (linija ~70), promenite `api_key` u `createAgent` pozivu. Za produkciju, preporučuje se korišćenje environment varijabli umesto hardkodiranih ključeva.

### Kako da dodam novi LLM provider?

1. Dodajte base URL u `src-tauri/src/llm/mod.rs` u `base_url()` metodu
2. Dodajte provider name u tip `LLMConfig.provider`
3. U `src/lib/provider.ts` dodajte rute za browser fallback

### Zašto se aplikacija ne otvara u browseru?

Proverite da li je Vite dev server pokrenut:
```bash
pnpm dev
```
Otvori `http://localhost:1420`.

Ako ne radi, proverite da li je port 1420 već zauzet:
```bash
lsof -i :1420
```

### Kako da build-am produkcijsku verziju?

```bash
pnpm tauri build
```
Ovo kreira:
- Linux: `.deb` i `.AppImage` u `src-tauri/target/release/bundle/`
- macOS: `.dmg`
- Windows: `.msi`

### Kako da dodam novi tool za agente?

1. Napravite struct koja implementira `Tool` trait u `src-tauri/src/tools/builtin.rs`
2. Definišite `fn definition()` — JSON schema za parametre
3. Definišite `async fn execute()` — implementacija
4. Registrujte u `register_all_tools()` funkciji

### Kako da povežem Honcho memoriju?

```bash
export HONCHO_API_KEY="your-key"
```
Pokrenite Honcho server (ako ga imate). Default endpoint je `http://localhost:8000`.

### Gde su logovi?

- **Tauri app**: `journalctl -f` (ako je pokrenuto kao service) ili terminal output
- **Rust backend**: `println!` i `eprintln!` idu na stderr
- **Frontend**: browser DevTools → Console

---

## Scenariji — Korak po Korak

### Scenario 1: Istraživanje i editovanje koda

1. Otvorite Ruby Diamond
2. Kliknite 💬 Chat
3. Unesite: "Pročitaj `src-tauri/src/lib.rs` i reci mi koje su Tauri komande registrovane"
4. Agent čita fajl i prikazuje listu komandi
5. Unesite: "Dodaj komentare iznad svake `invoke_handler` funkcije sa opisom šta radi"
6. Agent edituje fajl

### Scenario 2: Sistem admin

1. Kliknite 🛡️ SysAdmin
2. Unesite API ključ (prvi put)
3. Komanda: "check system health"
4. SysAdmin pokreće `df -h`, `free -h`, `uptime`
5. Prikazuje izveštaj sa preporukama

### Scenario 3: Multi-agent code review

1. Kliknite 🧠 Agent Mesh
2. Izaberite "Review" tab
3. Goal: "Review `src-tauri/src/commands.rs` for potential bugs"
4. Worker agent analizira kod
5. Reviewer agent daje feedback
6. Dobijate finalni izveštaj

### Scenario 4: Lokalni LLM

1. Preuzmite GGUF model (npr. Llama-3.2-3B-Instruct.Q4_K_M.gguf)
2. Stavite ga u `~/llama.cpp/models/`
3. Otvorite ⚙️ Llama panel
4. Kliknite "Discover Models"
5. Izaberite model → "Start Server"
6. Kreirajte novog agenta sa provider: "llamacpp"
7. Chat sa lokalnim LLM-om — bez internet-a, privatno
