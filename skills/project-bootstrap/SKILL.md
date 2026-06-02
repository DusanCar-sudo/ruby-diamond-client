---
name: project-bootstrap
description: Bootstrap new projects from templates — Rust, TypeScript, Python, or full-stack. Use when creating a new project, scaffolding, or initializing a repo.
---

# Project Bootstrap

## Purpose

Quickly scaffold new projects with best-practice defaults.

## Templates

### Rust CLI
```bash
bash command="cargo init --lib project-name"
write_file path=project-name/Cargo.toml content="..."
```

### TypeScript + Vite + React
```
bash command="pnpm create vite project-name --template react-ts"
```

### Python Package
```
bash command="mkdir -p project-name/project_name project-name/tests"
write_file path=project-name/pyproject.toml content="..."
```

## Conventions

All generated projects include:
- `.gitignore` appropriate for the language
- `README.md` with setup instructions
- CI configuration (GitHub Actions or similar)
- Linting and formatting config
