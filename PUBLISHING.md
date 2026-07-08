# NPM Publishing & Development Guide

This guide walks you through the entire lifecycle of the `@phinehas-labs/flow-orchestrator` package: from local development and testing to automated publishing on the public npm registry.

---

## 1. Project Anatomy & Configuration

Before deploying, it's important to understand how the project is structured and configured.

### Key Files and Directories
* `src/`: The TypeScript source files.
* `dist/`: The compiled JavaScript and type declaration files. This directory is excluded from Git but is **whitelisted** for npm publishing.
* `package.json`: Defines dependencies, scripts, entry points, and registry metadata.
* `.gitignore`: Excludes build noise, IDE directories, logs, and local secrets.
* `tsconfig.json`: Defines the TypeScript build configurations.

### Critical package.json Fields
Your `package.json` contains specific instructions that tell npm how to bundle the package:
* **`name`**: The scoped name `@phinehas-labs/flow-orchestrator`. When publishing scoped packages, npm defaults to publishing them as **private** (requiring a paid plan). You must override this default during publishing (see Section 3).
* **`main` & `types`**: Point to the compiled files inside `dist/`. Consumers will import these.
* **`files`**: An explicit whitelist of folders to include in the published package. It includes only the `dist` directory, meaning your raw tests and configuration files in the root won't be sent to registry consumers.
* **`prepublishOnly`**: A lifecycle hook. Whenever you run `pnpm publish`, pnpm will automatically run `pnpm build` first to compile your latest TypeScript changes.

---

## 2. Local Development Workflow

Before publishing any updates, follow these steps to verify your code.

### Step 1: Install Dependencies
Ensure you install the exact dependencies configured in `pnpm-lock.yaml`:
```bash
pnpm install --frozen-lockfile
```

### Step 2: Run Tests
Run the Jest test suite locally to confirm all tests pass:
```bash
pnpm test
```

### Step 3: Run the Compiler Build
Verify that the TypeScript compiles without any errors:
```bash
pnpm build
```

---

## 3. Automated Publishing via GitHub Actions (Continuous Delivery)

Publishing is fully automated. The workflow supports two release pathways depending on your preference.

### Step A: Configure NPM Authentication (One-time Setup)
1. Go to [npmjs.com](https://www.npmjs.com/) and log in.
2. Navigate to **Access Tokens** -> **Generate New Token**.
3. Select **Classic Token** or **Granular Access Token**.
4. Set the token type/scope to **Publish**.
5. Copy the generated token string.
6. Open your GitHub Repository -> **Settings** -> **Secrets and variables** -> **Actions** -> **New repository secret**.
7. Name the secret `NPM_TOKEN` and paste your copied token value.

---

### Pathway 1: Release by pushing a tag (Standard Developer Flow)

Whenever you push a Git version tag (e.g. `v1.0.1`), the CI will automatically test it, compile the TypeScript files, publish to NPM, and create a GitHub Release.

1. Increment the version in your local `package.json` and generate the Git tag locally:
   ```bash
   pnpm version patch  # or minor / major
   ```
2. Push your commits and tags to GitHub:
   ```bash
   git push origin main --tags
   ```
3. **That's it!** The CI/CD workflow will detect the tag, run tests, compile the bundle, publish to NPM, and create the GitHub Release.

---

### Pathway 2: Release via the GitHub UI (One-Click Flow)

If you prefer not to use your terminal for tagging/pushing, you can trigger a release directly on GitHub.

1. Make sure all your code changes are committed and pushed to the `main` branch.
2. Go to your GitHub repository -> click on the **Actions** tab.
3. In the left sidebar, click the **CI/CD** workflow.
4. Click the **Run workflow** dropdown on the right side of the workflow page.
5. Choose the **Version Bump Type** (`patch`, `minor`, or `major`).
6. Click the green **Run workflow** button.
7. The CI will test, bump the version code inside `package.json`, commit/tag it back to the repo, publish to NPM, and create the GitHub Release automatically.
