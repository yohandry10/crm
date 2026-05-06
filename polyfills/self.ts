if (typeof globalThis !== "undefined" && typeof globalThis.self === "undefined") {
  // Polyfill `self` in Node.js to unblock browser-only libs during SSR/build

  // @ts-ignore
  globalThis.self = globalThis
}
