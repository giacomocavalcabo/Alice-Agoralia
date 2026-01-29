import Link from 'next/link';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getLatestPosts() {
  return [];
}

async function getLeads() {
  try {
    const leads = await prisma.lead.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return leads.map(lead => ({
      _id: lead.id,
      name: lead.name,
      email: lead.email,
      company: lead.company,
      phone: lead.phone,
      message: lead.message,
      locale: lead.locale,
      createdAt: lead.createdAt.toISOString()
    }));
  } catch (e) {
    console.error('Error fetching leads:', e);
    return []; 
  }
}

export default async function Admin() {
  const [posts, leads] = await Promise.all([getLatestPosts(), getLeads()]);

  const plausiblePublic = `https://plausible.io/share/${process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN}?auth=...`;

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Admin Dashboard</h1>

      <section className="grid md:grid-cols-2 gap-6">
        <div className="rounded-2xl border p-4">
          <h2 className="font-medium mb-2">💰 Prezzi Dinamici</h2>
          <p className="text-sm text-muted-foreground">Gestisci prezzi per tier e paesi</p>
          <Link className="mt-3 inline-block rounded-lg bg-black text-white px-3 py-2" href="/admin/pricing">Apri Pricing</Link>
        </div>

        <div className="rounded-2xl border p-4">
          <h2 className="font-medium mb-2">🌍 Traduzioni i18n</h2>
          <p className="text-sm text-muted-foreground">Gestisci traduzioni e lingue</p>
          <Link className="mt-3 inline-block rounded-lg bg-black text-white px-3 py-2" href="/admin/i18n">Apri Dashboard i18n</Link>
        </div>

        <div className="rounded-2xl border p-4">
          <h2 className="font-medium mb-2">📊 Finance</h2>
          <p className="text-sm text-muted-foreground">Revenue, expenses, MRR, ARPU</p>
          <Link className="mt-3 inline-block rounded-lg bg-black text-white px-3 py-2" href="/admin/finance">Apri Finance</Link>
        </div>

        <div className="rounded-2xl border p-4">
          <h2 className="font-medium mb-2">📞 Chiamate Attive</h2>
          <p className="text-sm text-muted-foreground">Monitora chiamate in corso realtime</p>
          <Link className="mt-3 inline-block rounded-lg bg-black text-white px-3 py-2" href="/admin/calls">Apri Calls</Link>
        </div>

        <div className="rounded-2xl border p-4">
          <h2 className="font-medium mb-2">Blog</h2>
          <p className="text-sm text-muted-foreground">Gestisci articoli</p>
          <Link className="mt-3 inline-block rounded-lg bg-black text-white px-3 py-2" href="/studio">Apri Studio</Link>
          <div className="mt-4">
            <h3 className="text-sm font-semibold mb-2">Ultimi post</h3>
            <ul className="space-y-1 text-sm">
              {posts.map((p: any) => (
                <li key={p._id}>
                  <a href={`/${p.locale}/blog/${p.slug}`} className="underline">{p.title}</a>
                  <span className="text-gray-500"> — {new Date(p.publishedAt).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="rounded-2xl border p-4">
          <h2 className="font-medium mb-2">Analytics</h2>
          <p className="text-sm">Vedi traffico e conversioni</p>
          <a className="mt-3 inline-block rounded-lg bg-black text-white px-3 py-2" href={`https://plausible.io/${process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN}`} target="_blank">Apri Plausible</a>
          {/* <iframe className="mt-4 w-full h-72 rounded-xl" src={plausiblePublic} /> */}
        </div>

        <div className="rounded-2xl border p-4 md:col-span-2">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-medium">Leads ({leads.length})</h2>
            <Link className="inline-block rounded-lg bg-black text-white px-3 py-2 text-sm" href="/studio">Gestisci in Studio</Link>
          </div>
          {!leads.length ? (
            <p className="text-sm text-gray-500">Nessun lead ancora. Invia il form di contatto per popolare.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 border-b">
                    <th className="pb-2">Data</th>
                    <th className="pb-2">Nome</th>
                    <th className="pb-2">Email</th>
                    <th className="pb-2">Telefono</th>
                    <th className="pb-2">Azienda</th>
                    <th className="pb-2">Lingua</th>
                    <th className="pb-2">Messaggio</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((s: any) => (
                    <tr key={s._id} className="border-b hover:bg-gray-50">
                      <td className="py-3">{new Date(s.createdAt).toLocaleString()}</td>
                      <td className="py-3">{s.name || '-'}</td>
                      <td className="py-3"><a href={`mailto:${s.email}`} className="text-blue-600 hover:underline">{s.email}</a></td>
                      <td className="py-3">{s.phone ? <a href={`tel:${s.phone}`} className="text-blue-600 hover:underline">{s.phone}</a> : '-'}</td>
                      <td className="py-3">{s.company || '-'}</td>
                      <td className="py-3">{s.locale || '-'}</td>
                      <td className="py-3 max-w-[40ch]">{s.message || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}


