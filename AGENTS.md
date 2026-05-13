# Repository Guidelines

## Project Structure & Module Organization
This is a **Next.js** application (v16.2.1) using **TypeScript**, **Supabase**, and **Tailwind CSS**.
- **musfam-app/**: The main application directory.
  - **src/app/**: Contains Next.js App Router pages and layouts.
  - **src/components/**: Reusable React components.
  - **src/contexts/**: React context providers (e.g., `AuthContext`).
  - **src/hooks/**: Custom React hooks.
  - **src/lib/**: Shared utilities, Supabase client, and store logic.
  - **public/**: Static assets like images and icons.
- **supabase-bootstrap.sql / supabase-complete.sql**: Database schema and seeding scripts.

## Build, Test, and Development Commands
Run these commands from the `musfam-app` directory:
- **Development**: `npm run dev`
- **Build**: `npm run build`
- **Start**: `npm run start`
- **Lint**: `npm run lint`

## Coding Style & Naming Conventions
- **Framework**: React with Next.js (App Router).
- **Styling**: Tailwind CSS (v4) with PostCSS.
- **Linting**: ESLint (v9) with `eslint-config-next`.
- **Naming**: Use camelCase for variables/functions and PascalCase for components. Follow existing patterns for Supabase integration in `src/lib/store.ts`.

## Testing Guidelines
No explicit test framework is currently configured in `package.json`. Follow standard React component testing practices if adding tests.

## Commit & Pull Request Guidelines
This is not currently a git repository. If initialized, follow standard feature-branch workflows and clear, descriptive commit messages.
