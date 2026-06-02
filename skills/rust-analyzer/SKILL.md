---
name: rust-analyzer
description: Analyze and refactor Rust codebases. Use when working with Rust projects, understanding Cargo dependencies, or refactoring Rust code.
---

# Rust Analyzer

## Purpose

Deep understanding of Rust codebases — module structure, Cargo dependencies, trait implementations, and refactoring patterns.

## Capabilities

- Analyze Cargo.toml dependency trees
- Find trait implementations across modules
- Suggest idiomatic Rust patterns
- Detect unused dependencies and dead code
- Propose refactoring for better error handling

## Usage

When the user asks about Rust code, use this skill's patterns:

1. First, read `Cargo.toml` to understand dependencies
2. Use `grep` to find trait implementations: `grep "impl.*for" --include="*.rs"`
3. Check module structure with `list_dir src/`
4. Look for `pub mod` declarations to trace the module tree
5. Suggest changes using `edit_file` with precise oldText/newText pairs

## Patterns

- **Error handling**: Prefer `anyhow` for application code, `thiserror` for libraries
- **Async**: Use `tokio` for I/O-bound, `rayon` for CPU-bound
- **Testing**: Integration tests in `tests/`, unit tests inline with `#[cfg(test)]`
