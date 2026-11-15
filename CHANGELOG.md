# Changelog

## 1.0.0 — 2026-11-15

- First GitHub-importable WeWeb Vue 3 coded element for Page 2: Template Builder.
- One integrated parent component with five internal tabs and shared state.
- Template/draft setup, domain + contributor + tool + question + option editing, new domain-shared stage/team editor, conditional and risk/issue rules, validation/publication gates.
- Supabase Project URL / `sb_publishable_` key supplied via WeWeb properties or temporary on-page connection dialog.
- Global local-only preview with contributor and reviewer simulation.
- Guarded against publishing incomplete domain-shared stage snapshots until backend integration is complete.
- Lightweight Node adapter/logic tests. No live WeWeb build or Supabase integration run in packaging environment.
