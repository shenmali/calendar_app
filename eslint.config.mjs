import { FlatCompat } from '@eslint/eslintrc';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFile);
const compat = new FlatCompat({ baseDirectory: currentDirectory });

const config = [
  {
    ignores: [
      '.next/**',
      'next-env.d.ts',
      'node_modules/**',
      'playwright-report/**',
      'supabase/.temp/**',
      'test-results/**',
    ],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
];

export default config;
