# Development guide

- Install the recommended extensions for automatic formatting on save.
- All compiled artifacts should be checked in.
- We recommend running `npm run watch` in the background to keep compiled artifacts up to date during development.

## Running tests

We use the [jest](https://jestjs.io/) test framework. To run all the tests use `npm run test`. To run a specific test the best experience is to use VS Code.

The `codeql` executable must be on the path before running any tests. If you run `script/test` instead of `npm run test` it will set that up automatically.

# Generating sourcemaps

In case you want to generate sourcemaps for tracing back a specific line in a stacktrace to the source code, you can
use the following command:

```shell
CODEQL_VARIANT_ANALYSIS_ACTION_GENERATE_SOURCEMAPS=true npm run build
```

The sourcemaps will be placed in the `dist` directory.
