# Implementation Testing Checklist

Use this checklist to verify the Firebase + LocalStorage integration works correctly.

## Pre-Testing Setup

- [ ] All files are saved and up to date
- [ ] Open the site in a browser with Developer Tools (F12) open
- [ ] Check Console for any JavaScript errors

## Test Suite 1: Local-Only Mode (No Firebase Required)

### Test 1.1: Basic Registration
- [ ] Go to Admin Portal
- [ ] Set Storage Mode to "Local Only"
- [ ] Go to Register page
- [ ] Enter Participant ID: "Local001"
- [ ] Generate a password (emoji or digits)
- [ ] Confirm the password correctly
- [ ] See "Success! Account registered." message
- [ ] Check Console: Should show "Storage module loaded. Current mode: local"

### Test 1.2: Basic Login
- [ ] Click "Go to Login"
- [ ] See the password entry screen with keypad
- [ ] Enter the correct password
- [ ] See "Login successful ✅" message
- [ ] No Firebase-related errors in console

### Test 1.3: Failed Login
- [ ] Refresh login page
- [ ] Enter wrong password
- [ ] See "Incorrect password, try again." error
- [ ] Input clears automatically

### Test 1.4: Persistent Login
- [ ] After successful login, close browser tab
- [ ] Reopen the site
- [ ] Should still be logged in (shows "My Account" instead of "Login/Register")

## Test Suite 2: Firebase Mode (Requires Firebase Setup)

### Test 2.1: Firebase Configuration
- [ ] Update firebase-config.js with real credentials
- [ ] Refresh the page
- [ ] Check Console for "Firebase initialized successfully"
- [ ] Check Console for "Storage module loaded. Current mode: hybrid"

### Test 2.2: Hybrid Registration
- [ ] Go to Admin Portal
- [ ] Set Storage Mode to "Hybrid"
- [ ] Go to Register page
- [ ] Enter Participant ID: "Firebase001"
- [ ] Generate and confirm password
- [ ] Check Console for "User Firebase001 saved to Firebase"
- [ ] Check Console for "User saved to: both"

### Test 2.3: Firebase Database Verification
- [ ] Open Firebase Console
- [ ] Go to Realtime Database
- [ ] Navigate to `/users/Firebase001`
- [ ] Verify data structure includes:
  - participant_id
  - password_type
  - generated_password
  - created_at
  - updated_at

### Test 2.4: Cross-Device Login
- [ ] On Device/Browser A: Register user "CrossDevice001"
- [ ] Note the generated password
- [ ] On Device/Browser B: Open the login page
- [ ] Enter Participant ID field (if you add it to login page)
- [ ] Login with the password
- [ ] Should work (data retrieved from Firebase)

### Test 2.5: Login Analytics
- [ ] Register user "Analytics001"
- [ ] Login successfully
- [ ] Check Firebase Console: `/users/Analytics001/login_attempts`
- [ ] Should see entry with `success: true` and timestamp
- [ ] Try wrong password
- [ ] Check again, should see `success: false` entry

## Test Suite 3: Fallback Behavior

### Test 3.1: Firebase Unavailable Fallback
- [ ] Set Storage Mode to "Hybrid"
- [ ] Disable internet connection
- [ ] Register user "Offline001"
- [ ] Check Console: Should show "Firebase save failed, using LocalStorage fallback"
- [ ] Should see "User saved to: local"
- [ ] Login should still work

### Test 3.2: Firebase to Local Fallback
- [ ] Enable internet
- [ ] Register user "Online001" (saves to Firebase)
- [ ] Disable internet
- [ ] Login should still work (reads from LocalStorage fallback)

## Test Suite 4: Admin Controls

### Test 4.1: Storage Mode Toggle
- [ ] Go to Admin Portal
- [ ] Click "Local Only" - button should turn blue
- [ ] Current mode should show "local"
- [ ] Click "Hybrid" - button should turn blue
- [ ] Current mode should show "hybrid"
- [ ] Click "Firebase Only" - button should turn blue
- [ ] Current mode should show "firebase"

### Test 4.2: Mode Persistence
- [ ] Set Storage Mode to "Firebase Only"
- [ ] Refresh the page
- [ ] Admin Portal should still show "Firebase Only" as active

### Test 4.3: Experiment Mode (Existing)
- [ ] Toggle Experiment Mode On/Off
- [ ] Check that Admin link visibility changes
- [ ] Verify password type toggle (Emoji/Digits) works

## Test Suite 5: Edge Cases

### Test 5.1: No Registration
- [ ] Clear all site data (DevTools > Application > Clear storage)
- [ ] Go to Login page directly
- [ ] Should see "No registration found. Please register first."

### Test 5.2: Invalid Firebase Config
- [ ] Set invalid API key in firebase-config.js
- [ ] Refresh page
- [ ] Should see "Firebase initialization failed" in console
- [ ] Site should still work in Local Only mode

### Test 5.3: Experiment Mode Hides Settings
- [ ] Turn Experiment Mode ON
- [ ] Verify Admin link is hidden from participants
- [ ] Password type fieldset should be hidden on register page

## Test Suite 6: Data Integrity

### Test 6.1: Password Sequence Storage
- [ ] Register with emoji password "😀😁😂🤣"
- [ ] Check LocalStorage (`hcs_emoji_auth`)
- [ ] Verify `generated_password` matches exactly
- [ ] Check Firebase (if enabled)
- [ ] Verify password stored correctly

### Test 6.2: Participant ID Handling
- [ ] Register WITHOUT entering Participant ID
- [ ] Should still work (Participant ID is optional)
- [ ] Register WITH Participant ID "P001"
- [ ] Verify ID is saved correctly

## Expected Console Messages

### Local Mode Success
```
Storage module loaded. Current mode: local
User saved to: local (or just success: true)
```

### Hybrid Mode Success
```
Storage module loaded. Current mode: hybrid
Firebase initialized successfully
User {participantId} saved to Firebase
User saved to: both
User {participantId} retrieved from Firebase
```

### Fallback Scenario
```
Storage module loaded. Current mode: hybrid
Firebase save failed, using LocalStorage fallback
User saved to: local
warning: Firebase unavailable
```

## Common Issues & Solutions

### Issue: "StorageModule is not defined"
**Solution**: Check that storage.js loads before app.js in HTML files

### Issue: Firebase functions return errors
**Solution**: Verify firebase-config.js has correct credentials

### Issue: Cross-device login doesn't work
**Solution**: 
1. Ensure Participant ID was entered during registration
2. Check Firebase Database Rules allow reads
3. Verify both devices have internet connection

### Issue: Data not persisting after browser close
**Solution**: Check browser isn't in Incognito/Private mode (LocalStorage doesn't persist)

## Performance Checks

- [ ] Page loads in < 2 seconds
- [ ] Registration completes in < 1 second (local mode)
- [ ] Registration completes in < 3 seconds (Firebase mode)
- [ ] Login validation is instant
- [ ] No UI freezing during Firebase operations (async)

## Browser Compatibility Testing

Test in these browsers:
- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari (if available)

## Final Checks Before Study Launch

- [ ] Firebase Database Rules are appropriately secured
- [ ] firebase-config.js is updated with production credentials
- [ ] Storage Mode is set to "Hybrid"
- [ ] Experiment Mode is ON (hides admin features)
- [ ] Test complete flow: Register → Logout → Login
- [ ] Backup strategy in place (Firebase export or LocalStorage backup)

---

## Test Results Log

Date: _______________

Tester: _______________

| Test ID | Status | Notes |
|---------|--------|-------|
| 1.1 | ☐ Pass ☐ Fail | |
| 1.2 | ☐ Pass ☐ Fail | |
| ... | ... | ... |

**Overall Assessment**: 
- [ ] Ready for study deployment
- [ ] Needs fixes (list below)

**Issues Found**:
1. 
2. 
3. 

---

**Note**: This checklist should be completed before deploying to study participants.
