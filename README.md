# Development guide

- Install the recommended extensions for automatic formatting on save.
- We use the [ava](https://github.com/avajs/ava) test runner. To run one or more specific test(s), use `npm run test -- -m <title>`.
- To test against a particular branch, the action references in [`.github/workflows/codeql-query.yml`](.github/workflows/codeql-query.yml) need to be updated to point at this branch. This change must be reverted before merging to `main`. The scripts `script/use-this-branch` and `script/use-main` are provided to make this a bit easier.
