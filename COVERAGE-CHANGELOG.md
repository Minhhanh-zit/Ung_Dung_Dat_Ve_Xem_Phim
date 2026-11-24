# CineHunt Mobile coverage update

## Changes

- Added explicit Jest and Node type packages to the Mobile TypeScript type environment so Jest globals are recognized in `.jest.test.tsx` files.
- Added `test:node` and `test:all` scripts while keeping `npm test` backward-compatible with the existing Node regression suite.
- Added Jest coverage tests for API client, auth refresh, native/web persistence, public catalog pagination, shared UI primitives, Movies, Discover, ChatAssistant, Orders, AgeAdmissionGate and BookingView.
- Updated ESLint flat config so Jest globals are recognized only in Jest test files.
- Reworked the Mobile Sonar job to install and run the Mobile package's own Expo/Jest runner instead of borrowing Vitest from Admin Web.
- Added a Mobile typecheck and lint gate before coverage generation.
- Documented local commands and the distinction between unit/component tests and real backend/device integration tests in `mobile/TESTING.md`.

## Validation performed in this workspace

- Existing Node.js regression suite: **45/45 PASS**.
- Jest test files: all 14 files passed TypeScript syntax transpilation checks.
- GitHub Actions workflow YAML: parsed successfully.
- Sonar LCOV normalizer: smoke-tested against a real Mobile source path and normalized to `mobile/src/services/apiClient.ts`.

## Not claimed as verified here

The Jest runtime, Expo lint and full TypeScript typecheck were not executable in this workspace because the package installation could not complete: npm registry requests failed with DNS `EAI_AGAIN`. No Jest coverage percentage is claimed. GitHub Actions is configured to run typecheck, lint, Node tests and Jest coverage after dependencies install.
