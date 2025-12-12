if (typeof globalThis !== "undefined" && typeof globalThis.self === "undefined") {
  // Polyfill `self` in Node.js to unblock browser-only libs during SSR/build
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  globalThis.self = globalThis
}
