export function camelize(_: string, value: any): any {
  if (value && typeof value === "object") {
    for (const k in value) {
      if (/-./.exec(k)) {
        const l = k.replace(/-./g, (x) => x[1].toUpperCase());
        value[l] = value[k];
        delete value[k];
      }
    }
  }
  return value;
}
