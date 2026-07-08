# NPM Publishing & Development Guide

This guide walks you through the entire lifecycle of the `@phinehas-labs/flow-orchestrator` package: from local development and testing to manual and automated publishing on the public npm registry.

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
* **`name`**: The scoped name `@phinehas-labs/flow-orchestrator`. When publishing scoped packages, npm defaults to publishing them as **private** (requiring a paid plan). You must override this default during publishing (see Section 4).
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

## 3. Dry-Run Verification (Highly Recommended)

Before sending anything to the public registry, perform a dry run to inspect the exact archive that will be uploaded:

```bash
pnpm publish --dry-run
```

This compiles the code and lists every file packaged inside the tarball. Review this list to ensure:
* All files in `dist/` are present (e.g., `dist/index.js`, `dist/index.d.ts`).
* No `.ts` source files, `src/tests/` folders, or sensitive configurations are included.

---

## 4. Manual Publishing Steps

### Step 1: Log in to NPM
From your terminal, authenticate with your npmjs.com account:
```bash
pnpm login
```
This will prompt you for:
* **Username**
* **Password**
* **Email**
* **OTP (One-Time Password)** from your authenticator app.

### Step 2: Bump the Package Version
Use semantic versioning to update the package version. Running `pnpm version` automatically updates `package.json`, creates a Git commit, and tags the commit:

```bash
# For bug fixes (e.g., 1.0.0 -> 1.0.1)
pnpm version patch

# For new features that are backward-compatible (e.g., 1.0.0 -> 1.1.0)
pnpm version minor

# For breaking changes (e.g., 1.0.0 -> 2.0.0)
pnpm version major
```

### Step 3: Publish to NPM
Since your package name `@phinehas-labs/flow-orchestrator` is scoped under `@phinehas-labs`, you must explicitly declare that this is a public package. If you do not specify this flag, the command will fail:

```bash
pnpm publish --access public
```

---

## 5. Automated Publishing via GitHub Actions (Continuous Delivery)

Instead of publishing manually from your local machine, you can automate publishing whenever a new GitHub Release is created.

### Step A: Configure NPM Authentication
1. Go to [npmjs.com](https://www.npmjs.com/) and log in.
2. Navigate to **Access Tokens** -> **Generate New Token**.
3. Select **Classic Token** or **Granular Access Token**.
4. Set the token type/scope to **Publish**.
5. Copy the generated token string.
6. Open your GitHub Repository -> **Settings** -> **Secrets and variables** -> **Actions** -> **New repository secret**.
7. Name the secret `NPM_TOKEN` and paste your copied token value.

### Step B: Create the Workflow
Create the workflow configuration file at `.github/workflows/publish.yml`:

```yaml
name: Publish to NPM

on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Install pnpm
        uses: pnpm/action-setup@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20.x
          registry-url: 'https://registry.npmjs.org'
          cache: 'pnpm'

      - name: Install Dependencies
        run: pnpm install --frozen-lockfile

      - name: Compile and Publish
        run: pnpm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### How to Trigger the Automation:
1. Increment the version in your local `package.json` (e.g., using `pnpm version patch`).
2. Commit and push the changes along with the tags:
   ```bash
   git push origin main --tags
   ```
3. Go to GitHub -> **Releases** -> **Draft a new release**.
4. Select the tag you just pushed, write a release title/description, and click **Publish release**.
5. The GitHub Action will automatically trigger, build the TypeScript codebase, run tests, and publish the package to NPM under the `@phinehas-labs` scope.
