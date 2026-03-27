# Priority Fixes Test Procedure

## 1. Auth persistence

1. Log in on mobile.
2. Force-close the app.
3. Reopen it.
4. Confirm you stay signed in and land back in the app without a broken session.

## 2. Penny persistence

1. Open Penny and ask 2-3 questions.
2. Close Penny.
3. Force-close the app.
4. Reopen Penny.
5. Confirm the prior thread is still there.
6. Tap `Clear` and confirm the thread resets.

## 3. Connection actions

1. Open `Settings -> Manage bank connections`.
2. For an active connection, confirm there are now two distinct actions:
   - `Update login`
   - `Add accounts`
3. Tap each one and confirm Plaid opens successfully.
4. For a broken/disconnected connection, confirm the first action label changes to `Reconnect`.

## 4. Account removal guardrail

1. Open `Accounts`.
2. Tap `Remove` on a connected account.
3. Confirm an alert appears before deletion.
4. Cancel once and verify nothing is removed.
5. Repeat and confirm removal works only after explicit confirmation.

## 5. Full account deletion

1. Open `Settings`.
2. Tap `Delete account and data`.
3. Enter the signed-in email and type `DELETE`.
4. If Face ID / biometrics are available, confirm the biometric prompt appears.
5. Complete deletion.
6. Confirm you are signed out immediately.

## 6. Optional backend check

1. If `SUPABASE_SERVICE_ROLE_KEY` is configured in the backend environment:
   - confirm the deleted user cannot sign back in.
2. If it is not configured:
   - confirm app data is removed, but note the Supabase auth user may still exist until that key is added.

