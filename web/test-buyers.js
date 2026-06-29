"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var supabase_js_1 = require("@supabase/supabase-js");
var dotenv = __importStar(require("dotenv"));
var path_1 = __importDefault(require("path"));
dotenv.config({ path: path_1.default.resolve(process.cwd(), ".env.local") });
var supabase = (0, supabase_js_1.createClient)(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
function run() {
    return __awaiter(this, void 0, void 0, function () {
        var invs, ids_1, _a, c1, e1, matching, anyMatching;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase
                        .from("inventory")
                        .select("id, model, deal_type, availability_status")
                        .ilike("model", "%كيا سبورتاج%")
                        .limit(5)];
                case 1:
                    invs = (_b.sent()).data;
                    console.log("Cars:", invs);
                    if (!(invs && invs.length > 0)) return [3 /*break*/, 3];
                    ids_1 = invs.map(function (i) { return i.id; });
                    return [4 /*yield*/, supabase
                            .from("customers")
                            .select("id, full_name, metadata, operation_type, status, is_active")];
                case 2:
                    _a = _b.sent(), c1 = _a.data, e1 = _a.error;
                    if (e1) {
                        console.error(e1);
                        return [2 /*return*/];
                    }
                    console.log("Total customers:", c1 === null || c1 === void 0 ? void 0 : c1.length);
                    matching = c1 === null || c1 === void 0 ? void 0 : c1.filter(function (c) {
                        var meta = c.metadata;
                        return meta && meta.selected_inventory_id && ids_1.includes(meta.selected_inventory_id);
                    });
                    console.log("Matching customers by selected_inventory_id:", matching);
                    anyMatching = c1 === null || c1 === void 0 ? void 0 : c1.filter(function (c) {
                        var meta = c.metadata;
                        return meta && meta.selected_inventory_id;
                    });
                    console.log("Any customers with selected_inventory_id:", anyMatching === null || anyMatching === void 0 ? void 0 : anyMatching.length);
                    if (anyMatching && anyMatching.length > 0) {
                        console.log("Sample:", anyMatching.slice(0, 2).map(function (c) { return ({ id: c.id, full_name: c.full_name, operation_type: c.operation_type, selected: c.metadata.selected_inventory_id }); }));
                    }
                    _b.label = 3;
                case 3: return [2 /*return*/];
            }
        });
    });
}
run();
