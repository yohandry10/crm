"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "_instrument_sentry_server_config_ts";
exports.ids = ["_instrument_sentry_server_config_ts"];
exports.modules = {

/***/ "(instrument)/./sentry.server.config.ts":
/*!*********************************!*\
  !*** ./sentry.server.config.ts ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony import */ var _sentry_nextjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @sentry/nextjs */ \"(instrument)/./node_modules/.pnpm/@sentry+nextjs@10.30.0_@opentelemetry+context-async-hooks@2.2.0_@opentelemetry+api@1.9.0__@op_nngcnbvlgwul5k2b4juelj6qwu/node_modules/@sentry/nextjs/build/cjs/index.server.js\");\n/* harmony import */ var _sentry_nextjs__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_sentry_nextjs__WEBPACK_IMPORTED_MODULE_0__);\n// This file configures the initialization of Sentry on the server.\n// The config you add here will be used whenever the server handles a request.\n// https://docs.sentry.io/platforms/javascript/guides/nextjs/\n\n_sentry_nextjs__WEBPACK_IMPORTED_MODULE_0__.init({\n    dsn: \"https://d50c19f3ca9cc8201a9e2478aeb50c7e@o4510515718782976.ingest.us.sentry.io/4510515720486912\",\n    // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.\n    tracesSampleRate: 1,\n    // Enable logs to be sent to Sentry\n    enableLogs: true,\n    // Enable sending user PII (Personally Identifiable Information)\n    // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii\n    sendDefaultPii: true\n});\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKGluc3RydW1lbnQpLy4vc2VudHJ5LnNlcnZlci5jb25maWcudHMiLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUVBQW1FO0FBQ25FLDhFQUE4RTtBQUM5RSw2REFBNkQ7QUFFcEI7QUFFekNBLGdEQUFXLENBQUM7SUFDVkUsS0FBSztJQUVMLG1IQUFtSDtJQUNuSEMsa0JBQWtCO0lBRWxCLG1DQUFtQztJQUNuQ0MsWUFBWTtJQUVaLGdFQUFnRTtJQUNoRSxrR0FBa0c7SUFDbEdDLGdCQUFnQjtBQUNsQiIsInNvdXJjZXMiOlsiQzpcXFVzZXJzXFxQQ1xcRGVza3RvcFxcY3JtXFxzZW50cnkuc2VydmVyLmNvbmZpZy50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBUaGlzIGZpbGUgY29uZmlndXJlcyB0aGUgaW5pdGlhbGl6YXRpb24gb2YgU2VudHJ5IG9uIHRoZSBzZXJ2ZXIuXG4vLyBUaGUgY29uZmlnIHlvdSBhZGQgaGVyZSB3aWxsIGJlIHVzZWQgd2hlbmV2ZXIgdGhlIHNlcnZlciBoYW5kbGVzIGEgcmVxdWVzdC5cbi8vIGh0dHBzOi8vZG9jcy5zZW50cnkuaW8vcGxhdGZvcm1zL2phdmFzY3JpcHQvZ3VpZGVzL25leHRqcy9cblxuaW1wb3J0ICogYXMgU2VudHJ5IGZyb20gXCJAc2VudHJ5L25leHRqc1wiO1xuXG5TZW50cnkuaW5pdCh7XG4gIGRzbjogXCJodHRwczovL2Q1MGMxOWYzY2E5Y2M4MjAxYTllMjQ3OGFlYjUwYzdlQG80NTEwNTE1NzE4NzgyOTc2LmluZ2VzdC51cy5zZW50cnkuaW8vNDUxMDUxNTcyMDQ4NjkxMlwiLFxuXG4gIC8vIERlZmluZSBob3cgbGlrZWx5IHRyYWNlcyBhcmUgc2FtcGxlZC4gQWRqdXN0IHRoaXMgdmFsdWUgaW4gcHJvZHVjdGlvbiwgb3IgdXNlIHRyYWNlc1NhbXBsZXIgZm9yIGdyZWF0ZXIgY29udHJvbC5cbiAgdHJhY2VzU2FtcGxlUmF0ZTogMSxcblxuICAvLyBFbmFibGUgbG9ncyB0byBiZSBzZW50IHRvIFNlbnRyeVxuICBlbmFibGVMb2dzOiB0cnVlLFxuXG4gIC8vIEVuYWJsZSBzZW5kaW5nIHVzZXIgUElJIChQZXJzb25hbGx5IElkZW50aWZpYWJsZSBJbmZvcm1hdGlvbilcbiAgLy8gaHR0cHM6Ly9kb2NzLnNlbnRyeS5pby9wbGF0Zm9ybXMvamF2YXNjcmlwdC9ndWlkZXMvbmV4dGpzL2NvbmZpZ3VyYXRpb24vb3B0aW9ucy8jc2VuZERlZmF1bHRQaWlcbiAgc2VuZERlZmF1bHRQaWk6IHRydWUsXG59KTtcbiJdLCJuYW1lcyI6WyJTZW50cnkiLCJpbml0IiwiZHNuIiwidHJhY2VzU2FtcGxlUmF0ZSIsImVuYWJsZUxvZ3MiLCJzZW5kRGVmYXVsdFBpaSJdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(instrument)/./sentry.server.config.ts\n");

/***/ })

};
;