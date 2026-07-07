# Project Context

## Project Name
Vibe Fitness

## Project Goal
A modern fitness application featuring a premium, high-quality UX/UI experience.

## Tech Stack
- Next.js (App Router)
- TypeScript (Strict Mode)
- TailwindCSS
- Supabase (Auth & Database)
- Vercel (Hosting & Deployment)

## UI Requirements
- Clean, minimalist aesthetic.
- Strict Dark Theme by default (Zinc/Neutral palette).
- Modern mobile-first adaptive interface.
- Smooth animations powered exclusively by Framer Motion.

## Architecture Guidelines
- Next.js App Router layout hierarchy.
- Feature-based project folder structure.
- Atomic reusable component design pattern.

## Database & Models (Supabase)
Core Postgres database schema entities:
- `users` / `profiles` (Authentication, roles, user metadata)
- `workouts` (Training sessions details)
- `exercises` (Individual exercise reference data)
- `programs` (Structured long-term training plans)

## Development Rules
- Strict TypeScript mode enabled. `any` type is strictly forbidden.
- Build components to be modular, abstract, and highly reusable.
- Zero breaking changes to the existing UI/UX elements.
- Analyze the entire existing codebase context thoroughly before performing any modifications.
- Keep components clean: no redundant inline comments, no Russian text strings or logs inside the source code files.

## Git Flow & CI/CD
- All new features and bug fixes must be developed in separate dedicated branches.
- Execute `npm run lint` and verify type safety locally before every commit.
- Commit messages must be written strictly in English following the Conventional Commits format.

## Current Backlog Tasks
CRITICAL PROP: ALL DEPLOYED BUTTONS/INTERACTION ELEMENTS ARE CURRENTLY BROKEN IN PRODUCTION (DOM IS FROZEN OR CLICK EVENTS ARE BLOCKED).

1. Perform a comprehensive project-wide code review to isolate client-side/server-side hydration mismatches.
2. Debug and resolve infinite `loading` states, race conditions in providers (`AuthProvider`), and router blockages.
3. Fix all button interaction bugs across the dashboard, settings, and auth layouts.
4. Optimize and polish the user onboarding flow.
5. Implement comprehensive workout progress tracking metrics.
6. Integrate a production-ready interactive workout calendar view.