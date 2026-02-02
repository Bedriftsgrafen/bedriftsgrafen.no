# Branch Protection Rules

**🚨 SOLO DEVELOPER? [Jump to Quick Fix](#-important-solo-developer--single-user-setup)**

This document provides guidelines for configuring branch protection rules via the GitHub UI to ensure code quality and security for Bedriftsgrafen.no.

## Overview

Branch protection rules help maintain code quality by enforcing certain workflows before code can be merged. These rules must be configured manually through the GitHub repository settings.

---

## 🚨 IMPORTANT: Solo Developer / Single User Setup

**If you're the only developer working on this repository, read this section first!**

### The Problem You're Experiencing

You set up branch protection rules, but now you can't approve your own PR or merge to `main`. GitHub says "needs user with write access" even though you're the owner.

**Why this happens:** The standard branch protection settings include "Do not allow bypassing the above settings" which blocks even repository administrators (you!) from merging without a separate reviewer.

### Quick Fix: Allow Administrator Bypass

**To merge your current PR and continue working solo:**

1. **Go to:** `Settings` → `Branches` → Find your `main` branch rule → Click `Edit`

2. **Scroll down to:** "Rules applied to administrators"

3. **✅ ENABLE (CHECK):** "Allow specified actors to bypass required pull requests"
   - Click "Add bypass actor"
   - Select yourself (your username)
   - OR just leave it unchecked to allow all admins

4. **Click:** "Save changes" at the bottom

5. **Now you can:**
   - Go back to your PR
   - Click "Merge pull request" (no approval needed as admin)
   - Or approve your own PR if you prefer

### Recommended Settings for Solo Developers

When you're the only developer, use these **relaxed** settings:

**For `main` branch:**

```
✅ Require a pull request before merging
   - Required approvals: 0 (or 1 if you want to force yourself to review)
   
✅ Require status checks to pass before merging
   - Add: frontend-validate, frontend-test, backend-validate, backend-test
   
❌ Do NOT enable "Do not allow bypassing the above settings"
   (This is what's blocking you!)
   
✅ Allow administrators to bypass (this is you!)
```

This setup gives you:
- ✅ Automated CI/CD checks must pass
- ✅ You can see PR diffs before merging
- ✅ You can merge immediately when needed
- ✅ Security scanning still runs
- ✅ No blocking on approvals

### Alternative: Temporarily Disable Branch Protection

**If you need to merge RIGHT NOW:**

1. Go to: `Settings` → `Branches`
2. Find the `main` branch protection rule
3. Click the `Delete` button (🗑️ icon) on the right
4. Merge your PR
5. Re-add the protection rule with the solo developer settings above

### When to Use Team Settings

The full protection rules at the bottom of this document are for teams with multiple developers. You can enable those stricter rules later when you:
- Add collaborators to the project
- Want mandatory code review
- Need multiple approval layers

---

## How to Configure Branch Protection

Navigate to: **Settings** → **Branches** → **Branch protection rules** → **Add rule**

---

## 🔒 Main Branch Protection

**Branch name pattern:** `main`

### Required Settings

#### Pull Request Requirements
- ✅ **Require a pull request before merging**
  - Required number of approvals: **1**
  - ✅ Dismiss stale pull request approvals when new commits are pushed
  - ✅ Require review from Code Owners (if CODEOWNERS file exists)

#### Status Checks
- ✅ **Require status checks to pass before merging**
  - ✅ Require branches to be up to date before merging
  
  **Required status checks to add:**
  - `frontend-validate`
  - `frontend-test`
  - `backend-validate`
  - `backend-test`
  - `codeql-analysis (javascript)`
  - `codeql-analysis (python)`
  - `secret-scanning`
  - `frontend-security`
  - `backend-security`
  - `container-scanning`

#### Conversation Resolution
- ✅ **Require conversation resolution before merging**
  - All PR comments must be resolved before merge

#### Commit Requirements
- ⚠️ **Require signed commits** (Recommended, optional)
  - Ensures commits are cryptographically verified
  - Developers need to set up GPG signing

#### Branch Restrictions
- ✅ **Restrict who can push to matching branches**
  - Only allow specific users/teams to push
  - Configure based on your team structure

#### Rules Applied to Administrators
- ⚠️ **"Do not allow bypassing the above settings"**
  - ❌ **For Solo Developers:** Leave UNCHECKED (allow admin bypass)
  - ✅ **For Teams:** Enable this to ensure even administrators follow the rules
  - **Note:** This setting blocks repository owners from merging without approval!

#### Additional Settings
- ✅ **Allow force pushes:** ❌ Disabled
- ✅ **Allow deletions:** ❌ Disabled

---

## 🔧 Develop Branch Protection

**Branch name pattern:** `develop`

### Required Settings

#### Pull Request Requirements
- ✅ **Require a pull request before merging**
  - Required number of approvals: **1**

#### Status Checks
- ✅ **Require status checks to pass before merging**
  
  **Required status checks to add:**
  - `frontend-validate`
  - `frontend-test`
  - `backend-validate`
  - `backend-test`
  - `codeql-analysis (javascript)`
  - `codeql-analysis (python)`

#### Additional Settings
- ✅ **Allow force pushes:** ❌ Disabled
- ✅ **Allow deletions:** ❌ Disabled

---

## 🚀 Feature Branch Workflow

While feature branches don't require protection rules, developers should:

1. Create feature branches from `develop`
2. Name branches descriptively: `feature/add-company-search`, `fix/memory-leak`
3. Keep branches focused and short-lived
4. Rebase on `develop` before creating PR

---

## 📊 Status Check Configuration

The status checks referenced above come from:

### CI Workflow (`.github/workflows/ci.yml`)
- `frontend-validate` - TypeScript compilation and ESLint
- `frontend-test` - Vitest unit tests
- `backend-validate` - Ruff linting, format check, Mypy type checking
- `backend-test` - Pytest unit tests

### Security Workflow (`.github/workflows/security.yml`)
- `secret-scanning` - GitGuardian secret detection
- `frontend-security` - npm audit + OWASP Dependency-Check
- `backend-security` - safety + pip-audit + Bandit SAST
- `codeql-analysis` - GitHub CodeQL security scanning
- `container-scanning` - Trivy container vulnerability scanning

**Important:** Status checks will only appear in the list after they've run at least once. Create a test PR to trigger all workflows if needed.

---

## 🔐 Additional Security Settings

Beyond branch protection, enable these repository security features:

### Dependabot (Settings → Security → Dependabot)
- ✅ **Dependabot alerts** - Get notified of vulnerabilities
- ✅ **Dependabot security updates** - Auto-create PRs for security issues
- ✅ **Dependabot version updates** - Handled by `.github/dependabot.yml`

### Code Scanning (Settings → Security → Code scanning)
- ✅ **CodeQL analysis** - Enable GitHub Advanced Security
  - Free for public repositories
  - Requires GitHub Advanced Security for private repos

### Secret Scanning (Settings → Security → Secret scanning)
- ✅ **Secret scanning** - GitHub will scan for leaked secrets
  - Free for public repositories
  - Requires GitHub Advanced Security for private repos
- ✅ **Push protection** - Block commits containing secrets

### Private Vulnerability Reporting
- ✅ Enable for responsible disclosure

---

## 🛠️ Testing Branch Protection

After configuring branch protection:

1. **Create a test PR** with intentional issues:
   - TypeScript error
   - Linting violation
   - Failing test

2. **Verify blocks work:**
   - PR should not be mergeable
   - Required checks should be listed
   - Status should be "Required checks must pass"

3. **Fix issues and verify:**
   - Push fixes
   - Wait for checks to pass
   - Verify PR becomes mergeable

4. **Test conversation resolution:**
   - Add a PR comment
   - Verify you cannot merge until resolved

---

## 📝 Notes

### For Administrators
- Even with admin rights, following these rules is critical
- Consider enabling "Include administrators" in branch protection
- Use "Dismiss stale reviews" to ensure reviews stay relevant

### For Team Leads
- Adjust required reviewers based on team size
- Consider requiring specific teams for sensitive areas
- Use CODEOWNERS file for automatic reviewer assignment

### For Developers
- Always create PRs from feature branches
- Keep PRs small and focused (< 400 lines changed)
- Address review comments promptly
- Don't force-push after reviews (breaks review context)

---

## 🔄 Updating These Rules

As the project evolves, update branch protection rules to:
- Add new required status checks
- Adjust review requirements
- Modify team permissions

Document changes in PR descriptions when modifying workflows that affect status checks.

---

## 📚 Additional Resources

- [GitHub Branch Protection Documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [Requiring Status Checks](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches#require-status-checks-before-merging)
- [Code Owners](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)
- [Signed Commits](https://docs.github.com/en/authentication/managing-commit-signature-verification/about-commit-signature-verification)
