import { createAdminClient } from "@/lib/supabase/admin";

// Always fetch fresh data (this is a live inbox).
export const dynamic = "force-dynamic";

type Contact = {
  id: string;
  wa_id: string;
  profile_name: string | null;
  last_message_at: string | null;
};

type Message = {
  id: string;
  wa_id: string;
  direction: "inbound" | "outbound";
  body: string | null;
  msg_type: string;
  status: string | null;
  created_at: string;
};

function fmt(ts: string | null): string {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

export default async function Home() {
  let contacts: Contact[] = [];
  let messages: Message[] = [];
  let loadError: string | null = null;
  let notMigrated = false;

  try {
    const supabase = createAdminClient();

    const [{ data: c, error: cErr }, { data: m, error: mErr }] = await Promise.all([
      supabase
        .from("whatsapp_contacts")
        .select("id, wa_id, profile_name, last_message_at")
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(50),
      supabase
        .from("whatsapp_messages")
        .select("id, wa_id, direction, body, msg_type, status, created_at")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    if (cErr || mErr) {
      const msg = cErr?.message || mErr?.message || "Unknown error";
      // Table missing => migration 0007 not run yet.
      if (/relation .* does not exist|could not find the table/i.test(msg)) {
        notMigrated = true;
      } else {
        loadError = msg;
      }
    } else {
      contacts = (c as Contact[]) ?? [];
      messages = (m as Message[]) ?? [];
    }
  } catch (err) {
    loadError = err instanceof Error ? err.message : String(err);
  }

  const inboundCount = messages.filter((m) => m.direction === "inbound").length;
  const outboundCount = messages.filter((m) => m.direction === "outbound").length;
  const passwordSet = Boolean(process.env.DASHBOARD_PASSWORD);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">WhatsApp Inbox</h1>
          <p className="text-sm text-gray-500">
            GrowthifyEdge auto-responder — incoming messages and automatic replies.
          </p>
        </div>
        <a
          href="/"
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-50"
        >
          Refresh
        </a>
      </header>

      {!passwordSet && (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ⚠️ This dashboard is currently <strong>open to anyone with the link</strong>.
          Set a <code>DASHBOARD_PASSWORD</code> (and optional <code>DASHBOARD_USER</code>)
          environment variable to protect it.
        </div>
      )}

      {notMigrated && (
        <div className="rounded-md border border-blue-300 bg-blue-50 px-4 py-6 text-sm text-blue-800">
          The message tables don’t exist yet. Run{" "}
          <code>supabase/migrations/0007_whatsapp.sql</code> in your Supabase SQL
          Editor, then refresh this page.
        </div>
      )}

      {loadError && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-4 text-sm text-red-800">
          Couldn’t load messages: {loadError}
        </div>
      )}

      {!notMigrated && !loadError && (
        <>
          {/* Stat cards */}
          <div className="mb-8 grid grid-cols-3 gap-4">
            <Stat label="Conversations" value={contacts.length} />
            <Stat label="Received (recent)" value={inboundCount} />
            <Stat label="Auto-replies sent" value={outboundCount} />
          </div>

          {/* Conversations */}
          <section className="mb-8">
            <h2 className="mb-3 text-lg font-semibold">Conversations</h2>
            {contacts.length === 0 ? (
              <EmptyState text="No conversations yet. Send a WhatsApp message to your number to see it appear here." />
            ) : (
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-gray-500">
                    <tr>
                      <th className="px-4 py-2 font-medium">Name</th>
                      <th className="px-4 py-2 font-medium">Number</th>
                      <th className="px-4 py-2 font-medium">Last message</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {contacts.map((ct) => (
                      <tr key={ct.id}>
                        <td className="px-4 py-2">{ct.profile_name || "—"}</td>
                        <td className="px-4 py-2 font-mono text-xs">{ct.wa_id}</td>
                        <td className="px-4 py-2 text-gray-500">
                          {fmt(ct.last_message_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Recent messages */}
          <section>
            <h2 className="mb-3 text-lg font-semibold">Recent messages</h2>
            {messages.length === 0 ? (
              <EmptyState text="No messages yet." />
            ) : (
              <div className="space-y-2">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex flex-col rounded-lg border px-4 py-2 ${
                      m.direction === "inbound"
                        ? "border-gray-200 bg-white"
                        : "border-green-200 bg-green-50"
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
                      <span>
                        {m.direction === "inbound" ? "⬅ From" : "➡ Auto-reply to"}{" "}
                        <span className="font-mono">{m.wa_id}</span>
                        {m.status ? ` · ${m.status}` : ""}
                      </span>
                      <span>{fmt(m.created_at)}</span>
                    </div>
                    <div className="text-sm text-gray-900">
                      {m.body || <span className="text-gray-400">({m.msg_type})</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-4">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500">
      {text}
    </div>
  );
}
