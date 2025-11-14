📄 **CONTRIBUTING.md**

---

# Contributing to eslint-plugin-tailwind-organizer

First off — thank you for considering contributing ❤️
This project is young, and great contributors can shape its future.
The goal of this guide is to make contributing *easy, productive, and safe*.

---

# 🧱 Table of Contents

1. [Philosophy](#-philosophy)
2. [What You Can Contribute](#-what-you-can-contribute)
3. [Getting Started](#-getting-started)
4. [Project Structure](#-project-structure)
5. [Development Workflow](#-development-workflow)
6. [Using Changesets](#-using-changesets)
7. [Conventional Commits](#-conventional-commits)
8. [Running Tests](#-running-tests)
9. [Opening a Pull Request](#-opening-a-pull-request)
10. [Coding Standards](#-coding-standards)
11. [Release Channels (Stable / Canary / Alpha)](#-release-channels)
12. [Asking for Help](#-asking-for-help)

---

# 🧘 Philosophy

This plugin exists to make codebases **clearer**, **more maintainable**, and **more predictable**.

Contributions should aim to improve:

✔ Developer experience
✔ Readability
✔ Predictability
✔ Performance
✔ Stability
✔ Tailwind-aware intelligence

Not:

✖ One-off hacks
✖ Bloated configuration options
✖ Behaviour that breaks expected Tailwind semantics
✖ Unstable formatting rules

If you're unsure — open an issue; we'll discuss it.

---

# 🌱 What You Can Contribute

You are welcome to contribute in many ways:

### 🐞 Bug fixes

Fix broken class sorting, import detection issues, AST edge cases, etc.

### 🆕 Features

* More class-order categories
* JSX support improvements
* Better detection of cn/clsx
* ESLint v9 (flat config) refinements
* Additional CLI options

### 📚 Documentation Improvements

* More examples
* Troubleshooting section
* Guide for custom class ordering
* VS Code integration docs

### 🔍 Tests

We use **Vitest + RuleTester**.
Adding new tests massively improves stability.

### 🧹 Refactors

If something is messy or too complex, simplify it.

---

# 🧰 Getting Started

Clone the repo:

```
git clone https://github.com/danielphilipjohnson/eslint-plugin-tailwind-organizer.git
cd eslint-plugin-tailwind-organizer
```

Install dependencies:

```
npm install
```

Run the plugin in dev mode:

```
npm test
npm run lint
```

---

# 🗂 Project Structure

```
/
├── src/
│   ├── rules/                 # ESLint rules (main logic here)
│   ├── utils/                 # Class parsing + grouping
│   ├── processor.js           # For non-JSX support (if needed)
│   └── index.js               # Plugin entrypoint
│
├── tests/
│   ├── rules/                 # RuleTester spec files
│   ├── lib/                   # Utility tests
│   └── bin/                   # CLI tests
│
├── bin/                       # CLI utility
├── .changeset/                # Unreleased changes
├── package.json
└── README.md
```

If you’re adding functionality:

* **Rules go in `/src/rules`**
* **Helpers go in `/src/utils`**
* **Add tests to `/tests/rules`**

---

# 🔄 Development Workflow

### 1. Create a feature branch

```
git checkout -b feature/my-new-idea
```

### 2. Make your changes

Add code + tests.

### 3. Run lints + tests

```
npm run lint
npm test
```

### 4. Add a Changeset

We use **changesets** to manage versions.

```
npx changeset
```

Then answer the prompts:

* Choose patch / minor / major
* Write a short summary
* A file appears in `.changeset/*.md`

### 5. Commit & push

```
git commit -am "feat: improve flexbox grouping logic"
git push origin feature/my-new-idea
```

### 6. Open a Pull Request

GitHub Actions will:

* Validate tests
* Build the plugin
* Create a “Version Packages” PR if needed

---

# 🧾 Using Changesets

Changesets describe **what should be released**, not how you commit.

Examples:

### Patch

```
npx changeset
> patch
> Fix class sorting for responsive variants
```

### Minor

```
> feat: add new multiline grouping format
```

### Major

```
> BREAKING: new default ordering structure
```

The CI workflow will:

* bump versions
* generate changelog entries
* publish to npm when merged to `main`

---

# 🧱 Conventional Commits

We recommend using Conventional Commits:

| Prefix      | Meaning                  |
| ----------- | ------------------------ |
| `feat:`     | New feature              |
| `fix:`      | Bug fix                  |
| `refactor:` | Code improvements        |
| `docs:`     | Documentation only       |
| `test:`     | Tests added/updated      |
| `chore:`    | Build tooling, config    |
| `perf:`     | Performance improvements |

Examples:

* `feat: improve clsx import detection`
* `fix: incorrect grouping for border classes`
* `docs: add multiline examples`
* `test: coverage for group ordering`

---

# 🧪 Running Tests

We use **Vitest** and **ESLint RuleTester**.

### Run everything:

```
npm test
```

### Watch mode:

```
npm run test:watch
```

### ESLint rule tests only:

```
npm run test:eslint
```

### Coverage:

```
npm run test:coverage
```

Write tests for:

* class ordering
* import detection
* variants
* edge cases (dynamic classnames, template literals, multiple className props)

---

# 🚚 Opening a Pull Request

✔ Small, focused PRs are best
✔ Include tests for any logic changes
✔ Ensure `npm test` passes
✔ Ensure your changeset file exists
✔ Link related issues
✔ Explain the “why”, not just the “what”

I will not merge PRs that:

* break formatting rules without tests
* introduce unnecessary config options
* reduce clarity / maintainability
* bypass eslint’s recommended patterns

---

# 🚀 Release Channels

This project supports multiple channels:

| Channel    | Purpose             | Branch     | npm tag  |
| ---------- | ------------------- | ---------- | -------- |
| **Stable** | Normal releases     | `main`     | `latest` |
| **Canary** | Experimental builds | `canary/*` | `canary` |
| **Alpha**  | Early prerelease    | `alpha/*`  | `alpha`  |
| **Beta**   | Almost stable       | `beta/*`   | `beta`   |

### How it works

* Stable releases use **Changesets + Release workflow**
* Canary/alpha/beta use **automated prerelease workflows**
* Canary versions use SHA + build numbers:
  `0.0.1-canary.4128.f4432ac`
* Alpha/beta versions use semantic prerelease bumps:
  `0.0.1-alpha.1`

---

# 💬 Asking for Help

If you're stuck:

1. Open an issue
2. Include reproduction code
3. Mention your ESLint + Node versions
4. Include example input/output and expected behavior

I’ll help as quickly as possible.
