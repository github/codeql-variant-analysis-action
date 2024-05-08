import { getDefaultCliVersion } from "./codeql-version";

describe("getDefaultCliVersion", () => {
  it("getDefaultCliVersion with valid features", () => {
    const features = {
      /* eslint-disable @typescript-eslint/naming-convention -- names are from an API response */
      analysis_summary_v2_enabled: true,
      cli_config_file_enabled: true,
      cli_sarif_merge_enabled: true,
      codeql_java_lombok_enabled: true,
      combine_sarif_files_deprecation_warning_enabled: false,
      cpp_dependency_installation_enabled: true,
      cpp_trap_caching_enabled: false,
      database_uploads_enabled: true,
      default_codeql_version_2_16_4_enabled: true,
      default_codeql_version_2_16_5_enabled: true,
      default_codeql_version_2_16_6_enabled: false,
      default_codeql_version_2_17_0_enabled: true,
      default_codeql_version_2_17_1_enabled: true,
      default_codeql_version_2_17_2_enabled: false,
      default_codeql_version_2_17_3_enabled: false,
      default_codeql_version_2_17_4_enabled: false,
      default_codeql_version_2_17_5_enabled: false,
      default_codeql_version_2_17_6_enabled: false,
      disable_java_buildless_enabled: false,
      disable_kotlin_analysis_enabled: false,
      disable_python_dependency_installation_enabled: true,
      python_default_is_to_skip_dependency_installation_enabled: true,
      evaluator_fine_grained_parallelism_enabled: true,
      export_code_scanning_config_enabled: true,
      export_diagnostics_enabled: true,
      file_baseline_information_enabled: true,
      golang_extraction_reconciliation_enabled: true,
      language_baseline_config_enabled: true,
      lua_tracer_config_enabled: true,
      ml_powered_queries_enabled: false,
      qa_telemetry_enabled: false,
      scaling_reserved_ram_enabled: true,
      sublanguage_file_coverage_enabled: true,
      trap_caching_enabled: true,
      upload_failed_sarif_enabled: true,
      /* eslint-enable @typescript-eslint/naming-convention */
    };

    expect(getDefaultCliVersion(features)).toBe("2.17.1");
  });

  it("getDefaultCliVersion without version features", () => {
    const features = {
      /* eslint-disable @typescript-eslint/naming-convention -- names are from an API response */
      analysis_summary_v2_enabled: true,
      upload_failed_sarif_enabled: true,
      /* eslint-enable @typescript-eslint/naming-convention */
    };

    expect(getDefaultCliVersion(features)).toBe(undefined);
  });
});
