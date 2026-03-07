"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageGeneratorModule = void 0;
const common_1 = require("@nestjs/common");
const image_generator_service_1 = require("./image-generator.service");
let ImageGeneratorModule = class ImageGeneratorModule {
};
exports.ImageGeneratorModule = ImageGeneratorModule;
exports.ImageGeneratorModule = ImageGeneratorModule = __decorate([
    (0, common_1.Module)({
        providers: [image_generator_service_1.ImageGeneratorService],
        exports: [image_generator_service_1.ImageGeneratorService],
    })
], ImageGeneratorModule);
//# sourceMappingURL=image-generator.module.js.map