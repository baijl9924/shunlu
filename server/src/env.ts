import path from 'node:path';
import fs from 'node:fs';

// 读取项目根目录的 .env（需在其他模块之前导入）
const envFile = path.resolve(import.meta.dirname, '../../.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
