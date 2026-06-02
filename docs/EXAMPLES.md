# Ruby Diamond — User Guide Examples

## Scenario 1: Code Review sa Agentom

**Cilj:** Agent review-uje Rust kod i predlaže poboljšanja.

**Komanda u Chat panelu:**
```
C:\/home/dusanmilosavljevic/ruby-diamond-client
├─ src-tauri/
│  ├─ Cargo.toml
│  └─ src/
│     ├─ lib.rs
│     ├─ commands.rs
│     ├─ types.rs
│     └─ tools/
│        ├─ mod.rs
│        └─ builtin.rs

Goal: Review the code in src-tauri/src/commands.rs.
Check for: error handling, unsafe code, potential panics,
and suggest improvements with code examples.
```

**Šta agent radi:**
1. Čita `commands.rs` (read_file tool)
2. Analizira svaku komandu
3. Piše review sa konkretnim predlozima
4. Može čak i da edituje fajl ako mu kažete

---

## Scenario 2: Debata o Arhitekturi

**Cilj:** Dva agenta debatuju o izboru baze podataka.

**U Mesh panelu → Debate:**

```
Goal: Should we use SQLite or PostgreSQL for Ruby Diamond's
internal data storage? Consider: portability, performance,
concurrent access, ease of setup for end users.

Proposer config: DeepSeek model, temperature 0.7
Critic config: DeepSeek model, temperature 0.8
Judge config: DeepSeek model, temperature 0.5
```

**Očekivani ishod:**
- Proposer predlaže SQLite (portabilnost, lak setup)
- Critic ukazuje na limitacije (konkurentnost, skaliranje)
- Judge donosi odluku sa obrazloženjem

---

## Scenario 3: System Cleanup

**Cilj:** SysAdmin agent čisti sistem.

**U SysAdmin panelu:**

```
clean up system
```

**Šta se dešava:**
```
$ df -h          # provera zauzeća diska
$ du -sh /tmp    # provera veličine tmp
$ journalctl --disk-usage  # provera logova
$ sudo dnf clean all       # čišćenje dnf keša
$ sudo journalctl --vacuum-time=30d  # brisanje starih logova
```

**Izlaz:**
```
System cleanup completed:
- Freed 847MB in dnf cache
- Journal trimmed to 30 days
- /tmp: 142MB remaining
- Total disk: 67% used → 63% used after cleanup
```

---

## Scenario 4: Lokalni LLM — Privatni Chat

**Cilj:** Koristiti lokalni model bez internet konekcije.

**Koraci:**

1. Preuzmite model:
```bash
cd ~/llama.cpp/models
wget https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-Q4_K_M.gguf
```

2. U Llama panelu: **Discover Models** → izaberite model → **Start Server**

3. Kreirajte agenta:
```
Provider: llamacpp
Model: llama-3.2-3b-instruct
Base URL: http://localhost:8080/v1
Temperature: 0.7
Max tokens: 2048
```

4. Chat:
```
Goal: Napiši Python skriptu koja čita CSV fajl i pravi bar chart
```

Sve radi **lokalno**, bez slanja podataka na internet.

---

## Scenario 5: Multi-Agent Ensemble

**Cilj:** Tri agenta nezavisno rešavaju problem, rezultati se kombinuju.

**U Mesh panelu → Ensemble:**

```
Goal: Find all unused imports in the TypeScript files under src/
and suggest which ones to remove.

Agent 1: DeepSeek, temperature 0.3 (konzervativan)
Agent 2: DeepSeek, temperature 0.7 (balanced)
Agent 3: DeepSeek, temperature 1.0 (kreativan)
```

**Rezultat:** Sintetizovani izveštaj sa tri perspektive.

---

## Scenario 6: Monitor Dashboard — Live Demo

**Cilj:** Pratite performanse sistema dok radite.

1. Otvorite 📊 System Monitor panel
2. Pokrenite test opterećenja u terminalu:
```bash
stress --cpu 4 --timeout 30
```
3. Gledajte CPU grafikon kako raste u realnom vremenu
4. Posle 30s, CPU pada na normalno

---

## Scenario 7: Kreiranje Custom Agenta

**Cilj:** Napraviti agenta specijalizovanog za Python/FastAPI.

**Kroz Chat panel:**

```
Name: py-backend-dev
Model: deepseek-chat
Provider: deepseek
Temperature: 0.3
System prompt: You are a senior Python backend developer.
Focus on FastAPI, SQLAlchemy, and Pydantic patterns.
Always include type hints and error handling.
```

Ovaj agent će:
- Generisati FastAPI endpoint-e sa tipovima
- Predlagati SQLAlchemy modele
- Review-ovati Python kod sa backend fokusom

---

## Scenario 8: Debugging sa Agentom

**Cilj:** Agent pomaže da nađete bag.

```
Goal: The terminal tool in Ruby Diamond sometimes returns
truncated output. Find where truncation happens in
src-tauri/src/tools/builtin.rs and suggest a fix.
```

Agent će:
1. Naći relevantan kod
2. Analizirati logiku za truncation
3. Predložiti fix (npr. streaming output umesto buffering-a)

---

## Scenario 9: Plugin Development

**Cilj:** Napraviti custom skill za Ruby Diamond.

**Kreiranje SKILL.md:**

```bash
mkdir -p skills/rust-best-practices
cat > skills/rust-best-practices/SKILL.md << 'EOF'
---
name: rust-best-practices
description: Rust best practices for agent tool use
---

## Kada radiš Rust kod

1. **Error handling** — koristi `anyhow::Result` umesto `unwrap()`
2. **Closures** — preferiraj `impl Fn()` nad boxed closures
3. **async** — koristi `tokio` umesto `async-std`
4. **Serde** — uvek implementiraj `Serialize`/`Deserialize`
5. **Testing** — piši `#[cfg(test)] module` sa integracionim testovima

## Pitfalls

- Nemoj koristiti `unsafe` bez dokumentovanog razloga
- Izbegavaj `Arc<Mutex<...>>` gde može `RwLock`
- Ne zaboravi `#[derive(Debug)]`
EOF
```

Onda kad radite sa Rust kodom, agent će automatski učitati ovaj skill i primeniti pravila.

---

## Scenario 10: Kompletan Workflow

**Cilj:** Napraviti novu Tauri komandu od ideje do implementacije.

```
1. Otvorite 💬 Chat
2. Goal: "I want to add a new Tauri command called 'get_weather'
   that fetches weather data from wttr.in and returns it as JSON.
   Find the right files to modify and show me the changes needed."
3. Agent analizira kod i predlaže promene
4. Pregledate predlog
5. Kažete: "Implement the changes"
6. Agent edituje fajlove
7. Otvorite 🛡️ SysAdmin: "compile and check rust"
8. SysAdmin pokreće `cargo check`
9. Ako ima grešaka, vratite se na chat da ih popravite
```
