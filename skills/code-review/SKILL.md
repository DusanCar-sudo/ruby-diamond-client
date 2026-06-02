---
name: code-review
description: Review code for bugs, security issues, performance problems, and style violations. Use when the user asks for a code review, PR review, or wants to check their code quality.
---

# Code Review

## Purpose

Automated code review covering correctness, security, performance, and style.

## Review Checklist

### Correctness
- [ ] Edge cases handled (empty input, null, large values)
- [ ] Error paths are covered (not just happy path)
- [ ] Race conditions in concurrent code
- [ ] Off-by-one errors in loops/slices

### Security
- [ ] No hardcoded secrets or API keys
- [ ] Input validation on user-facing functions
- [ ] SQL injection (use parameterized queries)
- [ ] Path traversal (don't use raw user input in file paths)

### Performance
- [ ] Unnecessary allocations in hot paths
- [ ] N+1 queries in database code
- [ ] Large clones where references would work
- [ ] Blocking operations in async contexts

### Style
- [ ] Consistent naming (snake_case, PascalCase)
- [ ] Functions are small and single-purpose
- [ ] Comments explain "why", not "what"
- [ ] No commented-out code

## Usage

```bash
# Review a specific file
read_file path=/path/to/file.rs

# Find potential issues
grep pattern="unwrap\(\)" path=src/
grep pattern="\.clone\(\)" path=src/

# Check error handling
grep pattern="\.expect\(" path=src/
```
