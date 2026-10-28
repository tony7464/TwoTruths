# Browser regression

`npm run e2e` from the repo root runs `node e2e/regress.js`. It is not part of `npm test`.

Playwright is optional and is not installed by `npm run setup`. From this folder:

```
npm i --no-save playwright
```

That must not be left as a change to the repo's `package.json` files. You can also set `NODE_PATH` to a directory whose `node_modules` already contains `playwright`. If Playwright cannot be loaded, the script prints a `SKIP` line and exits 0.

Google Chrome has to be installed. The script launches it headless through Playwright's `channel` (`PLAYWRIGHT_CHANNEL`, default `chrome`) with `--use-gl=swiftshader` and `--enable-unsafe-swiftshader`. The second flag is what current Chrome requires before it will expose a software WebGL context.

The script never opens `server/instance/app.db`. It makes a temporary SQLite file, runs `flask db upgrade` and `python seed.py` with `DATABASE_URI` pointing at that file, and starts its own API and Vite. `seed.py` reads that variable because it imports the Flask app, and the app reads `DATABASE_URI`.

| Variable | Default | Meaning |
| --- | --- | --- |
| `E2E_API_PORT` | `5565` | Flask |
| `E2E_WEB_PORT` | `5183` | Vite. `/api` is proxied to the API port above |
| `PLAYWRIGHT_CHANNEL` | `chrome` | Playwright browser channel |

Ports 5555 and 5173 are not used. The temp directory and both processes are removed when the script exits, including on SIGINT and SIGTERM. If 5565 or 5183 is still held by a previous run of this script (its environment has `TWO_TRUTHS_E2E`, a `twotruths-e2e-` database path, or the e2e Vite config on its command line), that process is stopped before the new run binds the port. Anything else listening there is left alone and the run stops. Screenshots from a failure are written under `e2e/output/`, which is gitignored.

Each check prints `PASS` or `FAIL`. The process exits non-zero if any check fails.

Checks: login and the four cube faces, a wrong guess and a correct guess, a sent message showing in the thread without a reload, another user's message arriving through the inbox's 20 second poll, a bio that is still there after reload, statement-delete confirm and cancel, deleting a throwaway account, the flat view (reduced motion, the flat-view button, and a 600px window), WebGL context loss and Reload page, a signup of `Alex` while `alex` exists, a 429 after six bad logins, and laptop viewports 1366×768, 1024×768, 1536×864, 1280×720, 1280×800, 1400×1000, and 1024×700. Logged out, each of those sizes checks the login and sign-up fields. Logged in, each size checks Statements, Profile, Players, and Inbox. At 1280×800 and 1400×1000 the profile face, its statement fields, and the bio must not scroll. A failed login must show "Username or password is incorrect." and stay on the login screen. The conflicting signup must show "That username is taken." and stay on the sign-up screen. The logged-out cube still has a Cube faces group, so those checks do not look for that group to be gone.

The inbox poll check installs Playwright's clock before the page loads and fast-forwards 20 seconds. The message must be absent before that jump and present after it, and `window.__e2eMarker` must still be set, so a reload cannot be what showed it. Most checks share one browser context. A check opens its own context when it needs a different viewport at login, reduced motion, a saved flat choice, or the clock.

Console errors are a check of their own. The only allowed error-level console messages are Chrome's failed-resource lines for these responses:

- 401 from `POST /api/login` with a wrong password
- 409 from `POST /api/signup` when the username is taken (`Alex` against seeded `alex`)
- 429 from `POST /api/login` on the sixth bad password

Any console message containing `synchronously unmount` fails that check, for the whole run. While the listener is on, the script logs in, visits each face, logs out, logs in again, and logs out back to the login face.
