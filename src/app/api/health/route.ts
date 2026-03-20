import { NextResponse } from 'next/server';
import { getRuntimeDiagnostics } from '@/server/services/runtime';

/**
 * Public health check endpoint.
 * Used by Docker healthcheck and monitoring tools.
 * Does NOT require authentication.
 */
export async function GET() {
  const diagnostics = getRuntimeDiagnostics();

  return NextResponse.json(diagnostics, {
    status: diagnostics.ready ? 200 : 503,
  });
}
