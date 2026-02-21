# Contributing to SAKU

First off, thank you for considering contributing to SAKU! It's people like you that make SAKU a great tool for personal finance management.

## 1. Where do I go from here?

If you've noticed a bug or have a feature request, make sure to check our [Issues](../../issues) first. If it's not there, feel free to open a new issue.

## 2. Fork & create a branch

If this is something you think you can fix, then [fork SAKU](https://help.github.com/articles/fork-a-repo) and create a branch with a descriptive name.

A good branch name would be (where issue #325 is the ticket you're working on):

```sh
git checkout -b feature/325-add-category-icons
```

or

```sh
git checkout -b fix/112-transaction-date-bug
```

## 3. Local Development Setup

To develop SAKU locally:

1. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/saku.git
   cd saku
   ```
2. Install dependencies:
   ```bash
   bun install
   ```
3. Set up the local database schema:
   ```bash
   bun run dev:migrate
   ```
4. Start the development server:
   ```bash
   bun run dev
   ```

## 4. Code Style & Convention

- We use **TypeScript** strictly. Please avoid using `any` unless absolutely necessary.
- We use **ESLint** and **Prettier** for code formatting. Run `bun run lint` before committing your code.
- Write tests for new features. We use `vitest` for unit and integration testing. Run `bun run test` to ensure everything passes.

## 5. Commit Message Convention

We loosely follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/). Please prefix your commit messages with one of the following:

- `feat:` A new feature
- `fix:` A bug fix
- `docs:` Documentation only changes
- `style:` Changes that do not affect the meaning of the code (white-space, formatting, etc)
- `refactor:` A code change that neither fixes a bug nor adds a feature
- `test:` Adding missing tests or correcting existing tests
- `chore:` Changes to the build process or auxiliary tools and libraries

Example: `feat(api): add summary endpoint for transactions`

## 6. Submit a Pull Request

Once you are done with your changes, push them to your fork and submit a Pull Request to the `main` branch of the original repository.

Please provide a clear description of the problem you're solving or the feature you're adding in the PR description.

## 7. Security Issues

If you discover a security vulnerability within SAKU, please **do not** open a public issue. Instead, please send an e-mail directly to the maintainers. All security vulnerabilities will be promptly addressed.
