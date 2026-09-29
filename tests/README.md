<h1 align="center">🧪 Tests</h1>

<p align="center">
  <em>Unit tests for the shared helpers, plus the two scripts that check the real app.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/tests-18_passing-2ea44f?style=for-the-badge" alt="18 tests passing">
  <img src="https://img.shields.io/badge/runner-node_--test-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="node --test">
  <a href="../README.md"><img src="https://img.shields.io/badge/↩-repository_root-6B7280?style=for-the-badge" alt="Repository root"></a>
</p>

---

The unit tests use Node's built-in runner, so there's nothing to install beyond the app itself. They cover the code with logic in it; the Electron wiring is covered by the smoke run instead, because mocking Electron would test the mock.

| File | What it pins down |
|:---|:---|
| [**tree.test.js**](tree.test.js) | Hub id to path (base, home, virtual), click actions, terminal folders, a 20,000-deep tree flattening without a stack overflow, search ranking and limits, bookmark flattening. |
| [**url.test.js**](url.test.js) | Address-bar input: URLs kept, Windows paths to `file://`, loopback to `http`, hosts to `https`, everything else to a search; `javascript:` and `data:` refused. |
| [**recent.test.js**](recent.test.js) | Newest first, de-duplicated by type and target, capped at 50, and a hand-edited file can't inject bad entries. |

## Checking the real app

| Command | What it does | Takes |
|:---|:---|:---|
| `npm run smoke` | Launches the app, opens example.com and a terminal, expands the first folder, searches "README", logs the counts, saves `shell.png` and `tab.png` to `.smoke/`, and quits. Fails with a timeout if the app doesn't exit. | 30 to 80 s |
| `npm run spike:extensions` | Installs LastPass and Rakuten from the Web Store, loads a shop page, and logs each extension's errors. Rerun on every Electron upgrade. | about 60 s |

> [!NOTE]
> Both commands open a real window and use the real profile in `%APPDATA%\ai-command-center`, so extensions they install stay installed.

---

<p align="center">
  <a href="../README.md">← Repository home</a> ·
  <a href="../src/README.md">← Source</a>
</p>
