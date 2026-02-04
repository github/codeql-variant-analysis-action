/**
 * Custom Jest resolver to handle ESM packages from @actions
 */

module.exports = (request, options) => {
  // Use Jest's default resolver
  return options.defaultResolver(request, {
    ...options,
    // Add package condition for node environment
    packageFilter: (pkg) => {
      // For ESM packages that have conditional exports, ensure we resolve correctly
      if (pkg.exports && typeof pkg.exports === 'object') {
        // If the package has exports, ensure we're using the right conditions
        const conditions = options.conditions || [];
        if (!conditions.includes('node')) {
          options.conditions = [...conditions, 'node', 'import', 'require', 'default'];
        }
      }
      return pkg;
    },
  });
};
