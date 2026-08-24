import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';

const projectRoot = resolve(import.meta.dirname, '../..');

test('local Supabase passwordless email is configured as a code-only template', () => {
  const config = readFileSync(resolve(projectRoot, 'supabase/config.toml'), 'utf8');
  const template = readFileSync(resolve(projectRoot, 'supabase/templates/magic-link.html'), 'utf8');

  expect(config).toContain('[auth.email.template.magic_link]');
  expect(config).toContain('content_path = "./supabase/templates/magic-link.html"');
  expect(template).toContain('{{ .Token }}');
  expect(template).not.toContain('{{ .ConfirmationURL }}');
});
