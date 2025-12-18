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

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   createSupabaseServiceClient: () => (/* binding */ createSupabaseServiceClient)\n/* harmony export */ });\n/* harmony import */ var _supabase_supabase_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @supabase/supabase-js */ \"@supabase/supabase-js\");\n/* harmony import */ var _supabase_supabase_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_supabase_supabase_js__WEBPACK_IMPORTED_MODULE_0__);\n\n/**\n * Servicio con rol elevado (solo server). No se permiten valores por defecto:\n * debe fallar si faltan las variables obligatorias.\n */ function createSupabaseServiceClient() {\n    const SUPABASE_URL = \"https://crqnkdpjxeoqkfpttncq.supabase.co\";\n    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;\n    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {\n        throw new Error('Missing Supabase service credentials (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)');\n    }\n    return (0,_supabase_supabase_js__WEBPACK_IMPORTED_MODULE_0__.createClient)(SUPABASE_URL, SUPABASE_SERVICE_KEY, {\n        auth: {\n            persistSession: false\n        }\n    });\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9saWIvc3VwYWJhc2Utc2VydmljZS50cyIsIm1hcHBpbmdzIjoiOzs7Ozs7QUFBb0Q7QUFHcEQ7OztDQUdDLEdBQ00sU0FBU0M7SUFDZCxNQUFNQyxlQUFlQywwQ0FBb0M7SUFDekQsTUFBTUcsdUJBQXVCSCxRQUFRQyxHQUFHLENBQUNHLHlCQUF5QjtJQUVsRSxJQUFJLENBQUNMLGdCQUFnQixDQUFDSSxzQkFBc0I7UUFDMUMsTUFBTSxJQUFJRSxNQUFNO0lBQ2xCO0lBRUEsT0FBT1IsbUVBQVlBLENBQUNFLGNBQWNJLHNCQUFzQjtRQUN0REcsTUFBTTtZQUFFQyxnQkFBZ0I7UUFBTTtJQUNoQztBQUNGIiwic291cmNlcyI6WyJDOlxcVXNlcnNcXFBDXFxEZXNrdG9wXFxjcm1cXGxpYlxcc3VwYWJhc2Utc2VydmljZS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBjcmVhdGVDbGllbnQgfSBmcm9tICdAc3VwYWJhc2Uvc3VwYWJhc2UtanMnXG5pbXBvcnQgdHlwZSB7IFN1cGFiYXNlQ2xpZW50IH0gZnJvbSAnQHN1cGFiYXNlL3N1cGFiYXNlLWpzJ1xuXG4vKipcbiAqIFNlcnZpY2lvIGNvbiByb2wgZWxldmFkbyAoc29sbyBzZXJ2ZXIpLiBObyBzZSBwZXJtaXRlbiB2YWxvcmVzIHBvciBkZWZlY3RvOlxuICogZGViZSBmYWxsYXIgc2kgZmFsdGFuIGxhcyB2YXJpYWJsZXMgb2JsaWdhdG9yaWFzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlU3VwYWJhc2VTZXJ2aWNlQ2xpZW50KCk6IFN1cGFiYXNlQ2xpZW50IHtcbiAgY29uc3QgU1VQQUJBU0VfVVJMID0gcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfU1VQQUJBU0VfVVJMXG4gIGNvbnN0IFNVUEFCQVNFX1NFUlZJQ0VfS0VZID0gcHJvY2Vzcy5lbnYuU1VQQUJBU0VfU0VSVklDRV9ST0xFX0tFWVxuXG4gIGlmICghU1VQQUJBU0VfVVJMIHx8ICFTVVBBQkFTRV9TRVJWSUNFX0tFWSkge1xuICAgIHRocm93IG5ldyBFcnJvcignTWlzc2luZyBTdXBhYmFzZSBzZXJ2aWNlIGNyZWRlbnRpYWxzIChORVhUX1BVQkxJQ19TVVBBQkFTRV9VUkwgLyBTVVBBQkFTRV9TRVJWSUNFX1JPTEVfS0VZKScpXG4gIH1cblxuICByZXR1cm4gY3JlYXRlQ2xpZW50KFNVUEFCQVNFX1VSTCwgU1VQQUJBU0VfU0VSVklDRV9LRVksIHtcbiAgICBhdXRoOiB7IHBlcnNpc3RTZXNzaW9uOiBmYWxzZSB9XG4gIH0pXG59XG4iXSwibmFtZXMiOlsiY3JlYXRlQ2xpZW50IiwiY3JlYXRlU3VwYWJhc2VTZXJ2aWNlQ2xpZW50IiwiU1VQQUJBU0VfVVJMIiwicHJvY2VzcyIsImVudiIsIk5FWFRfUFVCTElDX1NVUEFCQVNFX1VSTCIsIlNVUEFCQVNFX1NFUlZJQ0VfS0VZIiwiU1VQQUJBU0VfU0VSVklDRV9ST0xFX0tFWSIsIkVycm9yIiwiYXV0aCIsInBlcnNpc3RTZXNzaW9uIl0sImlnbm9yZUxpc3QiOltdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(rsc)/./lib/supabase-service.ts\n");

/***/ })

};
;