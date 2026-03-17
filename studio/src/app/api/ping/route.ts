export const runtime = 'edge'; // Edge runtime = instant, no cold start on this route itself

export async function GET() {
  return new Response('ok', { status: 200 });
}
