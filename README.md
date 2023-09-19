# CodeQL variant analysis action

This action is used internally by GitHub's multi-repository variant analysis. It is not intended to be used directly.

If you want to use CodeQL to analyze your source code, please see the [CodeQL Action](https://github.com/github/codeql-action) and the [Code scanning documentation](https://docs.github.com/en/code-security/code-scanning/automatically-scanning-your-code-for-vulnerabilities-and-errors/about-code-scanning).

### Generating sourcemaps

In case you want to generate sourcemaps for tracing back a specific line in a stacktrace to the source code, you can
use the following command:

```shell
CODEQL_VARIANT_ANALYSIS_ACTION_GENERATE_SOURCEMAPS=true npm run build
```

The sourcemaps will be placed in the `dist` directory.
