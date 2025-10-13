#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node scripts/scaffold-nest-module.js <module-path> [--force]');
  process.exit(1);
}

const rawPath = args[0];
const force = args.includes('--force');
const segments = rawPath
  .split('/')
  .map((segment) => segment.trim())
  .filter(Boolean);

if (segments.length === 0) {
  console.error('Error: module path must contain at least one segment.');
  process.exit(1);
}

const rootDir = path.resolve(__dirname, '..', 'apps', 'api', 'src');
const targetDir = path.join(rootDir, ...segments);

const baseName = segments[segments.length - 1];

const toPascalCase = (value) =>
  value
    .split(/[-_\s]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');

const toCamelCase = (value) => {
  const pascal = toPascalCase(value);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
};

const classNamePrefix = toPascalCase(baseName);
const routePath = segments.join('/');

const files = [
  {
    name: `${baseName}.module.ts`,
    content: `import { Module } from '@nestjs/common';\nimport { ${classNamePrefix}Service } from './${baseName}.service';\nimport { ${classNamePrefix}Controller } from './${baseName}.controller';\n\n@Module({\n  controllers: [${classNamePrefix}Controller],\n  providers: [${classNamePrefix}Service],\n})\nexport class ${classNamePrefix}Module {}\n`,
  },
  {
    name: `${baseName}.service.ts`,
    content: `import { Injectable } from '@nestjs/common';\n\n@Injectable()\nexport class ${classNamePrefix}Service {\n  findAll() {\n    return [];\n  }\n\n  findOne(id: string) {\n    return { id };\n  }\n\n  create(payload: unknown) {\n    return { ...payload };\n  }\n\n  update(id: string, payload: unknown) {\n    return { id, ...payload };\n  }\n\n  remove(id: string) {\n    return { id };\n  }\n}\n`,
  },
  {
    name: `${baseName}.controller.ts`,
    content: `import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';\nimport { ${classNamePrefix}Service } from './${baseName}.service';\nimport { Create${classNamePrefix}Dto } from './dto/create-${baseName}.dto';\nimport { Update${classNamePrefix}Dto } from './dto/update-${baseName}.dto';\n\n@Controller('${routePath}')\nexport class ${classNamePrefix}Controller {\n  constructor(private readonly ${toCamelCase(baseName)}Service: ${classNamePrefix}Service) {}\n\n  @Get()\n  findAll() {\n    return this.${toCamelCase(baseName)}Service.findAll();\n  }\n\n  @Get(':id')\n  findOne(@Param('id') id: string) {\n    return this.${toCamelCase(baseName)}Service.findOne(id);\n  }\n\n  @Post()\n  create(@Body() payload: Create${classNamePrefix}Dto) {\n    return this.${toCamelCase(baseName)}Service.create(payload);\n  }\n\n  @Put(':id')\n  update(@Param('id') id: string, @Body() payload: Update${classNamePrefix}Dto) {\n    return this.${toCamelCase(baseName)}Service.update(id, payload);\n  }\n\n  @Delete(':id')\n  remove(@Param('id') id: string) {\n    return this.${toCamelCase(baseName)}Service.remove(id);\n  }\n}\n`,
  },
];

const dtoDir = path.join(targetDir, 'dto');
const entityDir = path.join(targetDir, 'entities');

const dtoFiles = [
  {
    name: `create-${baseName}.dto.ts`,
    content: `export class Create${classNamePrefix}Dto {\n  // TODO: define create DTO properties\n}\n`,
  },
  {
    name: `update-${baseName}.dto.ts`,
    content: `export class Update${classNamePrefix}Dto {\n  // TODO: define update DTO properties\n}\n`,
  },
];

const entityFiles = [
  {
    name: `${baseName}.entity.ts`,
    content: `export class ${classNamePrefix} {\n  // TODO: define entity fields\n}\n`,
  },
];

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const writeFile = (filePath, content) => {
  if (fs.existsSync(filePath) && !force) {
    console.log(`skip: ${path.relative(process.cwd(), filePath)} already exists`);
    return;
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`create: ${path.relative(process.cwd(), filePath)}`);
};

ensureDir(targetDir);
files.forEach(({ name, content }) => {
  const filePath = path.join(targetDir, name);
  writeFile(filePath, content);
});

ensureDir(dtoDir);
dtoFiles.forEach(({ name, content }) => {
  const filePath = path.join(dtoDir, name);
  writeFile(filePath, content);
});

ensureDir(entityDir);
entityFiles.forEach(({ name, content }) => {
  const filePath = path.join(entityDir, name);
  writeFile(filePath, content);
});

console.log('Nest module scaffold complete.');
