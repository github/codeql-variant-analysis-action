export function camelize(_: string, value: unknown): unknown {
  if (value && typeof value === "object") {
    for (const k in value) {
      if (/-./.exec(k)) {
        const l = k.replace(/-./g, (x) => x[1].toUpperCase());
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        value[l] = value[k];
        delete value[k];
      }
    }
  }
  return value;
}
