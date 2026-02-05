# Emoji/Digits PIN Prototype

Minimal front-end prototype with two pages (Register/Login) for a usable security course project.

## Files
- `register.html` generate & register a password
- `login.html` login
- `styles.css` simple styling
- `app.js` logic (PIN generation, input, validation, localStorage)

## Open Locally
Double-click `register.html` or `login.html` in a browser (static, no backend).

## Flow
1. Open `register.html`
2. Choose password type (digits or emoji)
3. Click “Generate & Register” to view the generated password
4. Click “Go to Login”

## Start a New Participant (Clear Local Data)
Run in browser DevTools:

```js
localStorage.removeItem('hcs_emoji_auth')
```
