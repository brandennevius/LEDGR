# Deployment Workflow (Always Use This)

This is the standard process for every new mobile feature/fix.

## 1) Start New Feature

```bash
cd "/Users/brandennevius/Desktop/Financial Coaching"
git checkout main
git pull
git checkout -b codex/<feature-name>
```

## 2) Build + QA in Dev First

Run local iOS so you can test:

```bash
cd "/Users/brandennevius/Desktop/Financial Coaching/apps/mobile"
npm run ios
```

If env cache is stale, restart clean:

```bash
npx expo start --clear
```

## 3) Implement + Commit Feature Branch

```bash
cd "/Users/brandennevius/Desktop/Financial Coaching"
git add <changed-files>
git commit -m "<feature/fix summary>"
git push -u origin codex/<feature-name>
```

## 4) After QA Approval, Merge to Main

```bash
cd "/Users/brandennevius/Desktop/Financial Coaching"
git checkout main
git pull
git merge --ff-only codex/<feature-name>
git push origin main
```

## 5) Build New TestFlight Binary

```bash
cd "/Users/brandennevius/Desktop/Financial Coaching/apps/mobile"
npx eas-cli build --platform ios --profile production
```

## 6) Submit Build to TestFlight

```bash
npx eas-cli submit --platform ios --profile production
```

## 7) App Store Connect

1. Open TestFlight in App Store Connect.
2. Wait for Apple processing.
3. Add/assign the new build to tester groups.
4. Testers update from the same TestFlight link.

## Environment Rules

1. Dev/Preview envs -> LEDGR-DEV Supabase values.
2. Production env -> LEDGR-PROD Supabase values.
3. Production mobile builds always use `--profile production`.
