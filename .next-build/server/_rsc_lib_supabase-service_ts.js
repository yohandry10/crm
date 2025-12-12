"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "_rsc_lib_supabase-service_ts";
exports.ids = ["_rsc_lib_supabase-service_ts"];
exports.modules = {

/***/ "(rsc)/./lib/supabase-service.ts":
/*!*********************************!*\
  !*** ./lib/supabase-service.ts ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   createSupabaseServiceClient: () => (/* binding */ createSupabaseServiceClient)\n/* harmony export */ });\n/* harmony import */ var _supabase_supabase_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @supabase/supabase-js */ \"(rsc)/./node_modules/.pnpm/@supabase+supabase-js@2.75.0/node_modules/@supabase/supabase-js/dist/module/index.js\");\n\n/**\n * Servicio con rol elevado (solo server). No se permiten valores por defecto:\n * debe fallar si faltan las variables obligatorias.\n */ function createSupabaseServiceClient() {\n    const SUPABASE_URL = \"https://crqnkdpjxeoqkfpttncq.supabase.co\";\n    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;\n    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {\n        throw new Error('Missing Supabase service credentials (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)');\n    }\n    return (0,_supabase_supabase_js__WEBPACK_IMPORTED_MODULE_0__.createClient)(SUPABASE_URL, SUPABASE_SERVICE_KEY, {\n        auth: {\n            persistSession: false\n        }\n    });\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9saWIvc3VwYWJhc2Utc2VydmljZS50cyIsIm1hcHBpbmdzIjoiOzs7OztBQUFvRDtBQUdwRDs7O0NBR0MsR0FDTSxTQUFTQztJQUNkLE1BQU1DLGVBQWVDLDBDQUFvQztJQUN6RCxNQUFNRyx1QkFBdUJILFFBQVFDLEdBQUcsQ0FBQ0cseUJBQXlCO0lBRWxFLElBQUksQ0FBQ0wsZ0JBQWdCLENBQUNJLHNCQUFzQjtRQUMxQyxNQUFNLElBQUlFLE1BQU07SUFDbEI7SUFFQSxPQUFPUixtRUFBWUEsQ0FBQ0UsY0FBY0ksc0JBQXNCO1FBQ3RERyxNQUFNO1lBQUVDLGdCQUFnQjtRQUFNO0lBQ2hDO0FBQ0YiLCJzb3VyY2VzIjpbIkM6XFxVc2Vyc1xcUENcXERlc2t0b3BcXGNybVxcbGliXFxzdXBhYmFzZS1zZXJ2aWNlLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGNyZWF0ZUNsaWVudCB9IGZyb20gJ0BzdXBhYmFzZS9zdXBhYmFzZS1qcydcbmltcG9ydCB0eXBlIHsgU3VwYWJhc2VDbGllbnQgfSBmcm9tICdAc3VwYWJhc2Uvc3VwYWJhc2UtanMnXG5cbi8qKlxuICogU2VydmljaW8gY29uIHJvbCBlbGV2YWRvIChzb2xvIHNlcnZlcikuIE5vIHNlIHBlcm1pdGVuIHZhbG9yZXMgcG9yIGRlZmVjdG86XG4gKiBkZWJlIGZhbGxhciBzaSBmYWx0YW4gbGFzIHZhcmlhYmxlcyBvYmxpZ2F0b3JpYXMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVTdXBhYmFzZVNlcnZpY2VDbGllbnQoKTogU3VwYWJhc2VDbGllbnQge1xuICBjb25zdCBTVVBBQkFTRV9VUkwgPSBwcm9jZXNzLmVudi5ORVhUX1BVQkxJQ19TVVBBQkFTRV9VUkxcbiAgY29uc3QgU1VQQUJBU0VfU0VSVklDRV9LRVkgPSBwcm9jZXNzLmVudi5TVVBBQkFTRV9TRVJWSUNFX1JPTEVfS0VZXG5cbiAgaWYgKCFTVVBBQkFTRV9VUkwgfHwgIVNVUEFCQVNFX1NFUlZJQ0VfS0VZKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdNaXNzaW5nIFN1cGFiYXNlIHNlcnZpY2UgY3JlZGVudGlhbHMgKE5FWFRfUFVCTElDX1NVUEFCQVNFX1VSTCAvIFNVUEFCQVNFX1NFUlZJQ0VfUk9MRV9LRVkpJylcbiAgfVxuXG4gIHJldHVybiBjcmVhdGVDbGllbnQoU1VQQUJBU0VfVVJMLCBTVVBBQkFTRV9TRVJWSUNFX0tFWSwge1xuICAgIGF1dGg6IHsgcGVyc2lzdFNlc3Npb246IGZhbHNlIH1cbiAgfSlcbn1cbiJdLCJuYW1lcyI6WyJjcmVhdGVDbGllbnQiLCJjcmVhdGVTdXBhYmFzZVNlcnZpY2VDbGllbnQiLCJTVVBBQkFTRV9VUkwiLCJwcm9jZXNzIiwiZW52IiwiTkVYVF9QVUJMSUNfU1VQQUJBU0VfVVJMIiwiU1VQQUJBU0VfU0VSVklDRV9LRVkiLCJTVVBBQkFTRV9TRVJWSUNFX1JPTEVfS0VZIiwiRXJyb3IiLCJhdXRoIiwicGVyc2lzdFNlc3Npb24iXSwiaWdub3JlTGlzdCI6W10sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(rsc)/./lib/supabase-service.ts\n");

/***/ })

};
;