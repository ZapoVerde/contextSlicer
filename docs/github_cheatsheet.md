

### Git + Firebase Cheatsheet

#### 1. Basic Branch Navigation (Switch without affecting other branches)
- Show current branch:  
  `git branch --show-current`  
  or check your prompt

- List all local branches:  
  `git branch`  (current has `*`)

- Switch to existing branch:  
  `git checkout <branch-name>`  
  `git switch <branch-name>`  ← recommended

- Quick check after switch:  
  `git status`  
  `git log --oneline -5`

#### 2. Creating a New Branch from Another Branch
- From current branch:  
  `git switch -c new-branch`

- From specific branch:  
  `git switch -c new-branch main`  
  `git checkout -b new-branch origin/main`

#### 3. Typical Hotfix Flow
```bash
# Start on production
git checkout main
git pull origin main

# Create & work on hotfix
git checkout -b main-fix
# ... fix, commit
git add . && git commit -m "Fix ..."
git push origin main-fix

# Switch back to feature
git switch feature/ui_contract
# ... continue feature work

# Later return to hotfix
git switch main-fix
```

#### 4. Merging Branches (Get fix into production)
**Fast-forward (clean linear history – what you did):**
```bash
git checkout main
git pull origin main
git merge --ff-only main-fix
git push origin main
```

**Regular merge (with merge commit):**
```bash
git checkout main
git pull origin main
git merge main-fix
git push origin main
```

**Via Pull Request (for review):**
- `git push origin main-fix`
- GitHub → New PR: base `main` ← compare `main-fix`
- Review → Merge → Delete branch (UI button)

#### 5. Clean Up Branches (After successful merge & deploy)
Once the fix is live on prod and verified:

```bash
# Delete local branch
git branch -d main-fix          # safe if already merged
# or force if needed (rare):
# git branch -D main-fix

# Delete remote branch
git push origin --delete main-fix
# or shorthand:
# git push origin :main-fix
```

**Tip**: If Git says the branch isn't fully merged, double-check with `git branch --merged` or just use `-D` (but only if you're sure).

#### 6. Firebase Project Switching & Deploy
- Switch to production:  
  `firebase use prod`  
  `firebase use default`  (same project)

- Switch to dev:  
  `firebase use dev`

- Check current:  
  `firebase use`

- Build & deploy:  
  `npm run build`  
  `firebase deploy --only hosting`  
  `firebase deploy --project prod`  (one-shot, no switch needed)

#### Quick Reference Table (Updated)

| Goal                              | Command(s)                                      | Notes |
|-----------------------------------|-------------------------------------------------|-------|
| Switch branches                   | `git switch <branch>`                           | Safe, no side effects |
| Create branch from current        | `git switch -c new-branch`                      | Starts from current HEAD |
| Create branch from specific       | `git switch -c new-branch main`                 | Doesn't change current branch |
| Merge branch (fast-forward)       | `git merge --ff-only other-branch`              | Clean history if possible |
| Push after merge                  | `git push origin main`                          | Makes fix live on remote |
| Delete local branch (after merge) | `git branch -d branch-name`                     | Safe; use -D to force |
| Delete remote branch              | `git push origin --delete branch-name`          | Cleanup remote |
| Switch Firebase project           | `firebase use prod` / `firebase use dev`        | Affects deploy target |
| Deploy to current project         | `firebase deploy --only hosting`                | After build |
| Force deploy to specific project  | `firebase deploy --project prod`                | No alias switch needed |

This now covers the full lifecycle: create → fix → merge → push → deploy → **clean up branches**.