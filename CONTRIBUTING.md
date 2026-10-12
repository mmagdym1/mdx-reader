# Contributing

Thanks for helping improve MDX Reader.

## Report a bug

Use the bug-report template and attach the smallest Markdown sample that reproduces the problem. For bidi issues, include the expected visual order, selected direction mode, browser or Windows version, and a screenshot when possible.

## Submit a change

1. Fork the repository and create a focused branch.
2. Run `npm install`.
3. Make the smallest change that solves the issue.
4. Run `npm run standalone` and `node --check` for every changed JavaScript file.
5. Test both the Electron app and `MDX-Reader-Standalone.html` opened through `file://`.
6. Open a pull request describing the behavior before and after the change.

Please preserve the existing Arabic UI copy and the tested direction thresholds. Runtime dependencies require prior discussion because offline, zero-dependency rendering is a core project constraint. Keep all `.bat` files ASCII-only.

