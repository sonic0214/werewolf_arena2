# Repository Guidelines

## Project Structure & Module Organization
The AI game loop lives in `backend/src`, split into `api` (FastAPI routers), `core` (role logic), `services` (LLM orchestration), and `config` (Pydantic settings). Backend fixtures and integration scenarios live in `backend/tests`. The Next.js client is under `frontend/src` with `app` routes, reusable `components`, shared `lib` utilities, and domain `types`. Cross-cutting schemas and constants sit in `shared`. Automation scripts (such as `scripts/start_v2.sh`) coordinate multi-service startup; keep new helpers there for discoverability.

## Build, Test, and Development Commands
`./scripts/start_v2.sh` spins up the FastAPI and Next.js stack with sensible defaults. To work on the backend only, activate the virtualenv and run `uvicorn src.api.app:app --reload` from `backend`. Frontend development uses `npm run dev` inside `frontend`, and production assets are built with `npm run build`.

## Coding Style & Naming Conventions
Python code follows Black (88-char lines) and Ruff rules; run `black src` and `ruff check src` before opening a PR. Tests belong in files named `test_*.py`, and fixtures go in `conftest.py`. Prefer descriptive snake_case for Python identifiers and PascalCase for Pydantic models. The frontend inherits Next.js ESLint and Tailwind conventions; run `npm run lint` and keep components named in PascalCase, hooks in `useCamelCase.ts`. Store shared TypeScript contracts under `frontend/src/types` to mirror backend schemas.

## Testing Guidelines
Use `pytest -m "not slow"` for focused backend runs, and `pytest --cov=src` to confirm coverage before merging (target ≥80% for new modules). Async routes rely on `pytest-asyncio`; include `@pytest.mark.asyncio` on coroutine tests. Integration tests that hit WebSockets should use the `event_loop` fixture from `backend/tests/conftest.py`. Frontend snapshot or Playwright tests are not present; if you add them, stage scripts under `frontend/tests` and expose a matching npm script.

## Commit & Pull Request Guidelines
Recent history mixes semantic tags (`v2.1`, `v3`) with Conventional Commit prefixes (`feat: ...`). Prefer Conventional Commits for clarity (`feat: add guardian role voting logic`) and reserve version bumps for release branches. Each PR should include: the problem statement, a concise solution summary, test evidence (`pytest`/`npm run lint` logs), and any UI screenshots when front-end visuals change. Link to tracking issues or design docs (e.g., `ARCHITECTURE.md`) so reviewers can trace context quickly.

## Environment & Security Notes
Never commit `.env` files. Copy `backend/.env.example` when onboarding and document any new keys there. API providers (OpenAI, ZhipuAI, OpenRouter) must be mocked in tests; rely on service-layer adapters under `backend/src/services` rather than shelling to live endpoints during CI.
