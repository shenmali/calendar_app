import { expect, test } from 'vitest';
import { appName } from '@/lib/app-config';

test('uygulama adı Takvim olur', () => {
  expect(appName).toBe('Takvim');
});
