import { debug, warning } from "@actions/core";
import { valid } from "semver";

const DEFAULT_VERSION_FEATURE_FLAG_PREFIX = "default_codeql_version_";
const DEFAULT_VERSION_FEATURE_FLAG_SUFFIX = "_enabled";

function getCliVersionFromFeatureFlag(f: string): string | undefined {
  if (
    !f.startsWith(DEFAULT_VERSION_FEATURE_FLAG_PREFIX) ||
    !f.endsWith(DEFAULT_VERSION_FEATURE_FLAG_SUFFIX)
  ) {
    return undefined;
  }
  const version = f
    .substring(
      DEFAULT_VERSION_FEATURE_FLAG_PREFIX.length,
      f.length - DEFAULT_VERSION_FEATURE_FLAG_SUFFIX.length,
    )
    .replace(/_/g, ".");

  if (!valid(version)) {
    warning(
      `Ignoring feature flag ${f} as it does not specify a valid CodeQL version.`,
    );
    return undefined;
  }
  return version;
}

export function getDefaultCliVersion(
  features: Record<string, boolean>,
): string | undefined {
  const enabledFeatureFlagCliVersions = Object.entries(features)
    .map(([f, isEnabled]) =>
      isEnabled ? getCliVersionFromFeatureFlag(f) : undefined,
    )
    .filter((f): f is string => f !== undefined);

  if (enabledFeatureFlagCliVersions.length === 0) {
    return undefined;
  }

  const maxCliVersion = enabledFeatureFlagCliVersions.reduce(
    (maxVersion, currentVersion) =>
      currentVersion > maxVersion ? currentVersion : maxVersion,
    enabledFeatureFlagCliVersions[0],
  );
  debug(`Derived default CLI version of ${maxCliVersion} from feature flags.`);

  return maxCliVersion;
}
