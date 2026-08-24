import { NextRequest } from 'next/server';

import { handleOAuthCallback } from '@/lib/providers/callback';

export async function GET(request: NextRequest) {
  return handleOAuthCallback(request, 'google');
}
