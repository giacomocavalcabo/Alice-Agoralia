import { NextResponse } from 'next/server';

export async function GET() {
  const token = process.env.FORMSPREE_API_TOKEN!;
  const formId = process.env.FORMSPREE_FORM_ID!;
  if (!token || !formId) return NextResponse.json({ submissions: [] });

  const r = await fetch(`https://api.formspree.io/forms/${formId}/submissions`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store'
  });
  if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: r.status });
  const data = await r.json();
  return NextResponse.json(data);
}


