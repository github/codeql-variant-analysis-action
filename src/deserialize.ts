export { deserialize };

function camelize(_: string, value: any) {
  if (value && typeof value === "object") {
    for (const k in value) {
      if (k.match(/-./)) {
        const l = k.replace(/-./g, (x) => x[1].toUpperCase());
        value[l] = value[k];
        delete value[k];
      }
    }
  }
  return value;
}

function deserialize<T>(s: string): T {
  return JSON.parse(s, camelize);
}
