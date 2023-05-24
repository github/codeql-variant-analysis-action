# Development guide

- Install the recommended extensions for automatic formatting on save.
- We use the [ava](https://github.com/avajs/ava) test runner. To run one or more specific test(s), use `npm run test -- -m <title>`.
- The `codeql` executable must be on the path before running any tests.
- All compiled artifacts and `node_module` dependencies should be checked in.
- We recommend running `npm run watch` in the background to keep compiled artifacts up to date during development.
