// Admin dashboard backend. Read-only. Only emails listed in public.dn_admins get in.
import { createClient } from "npm:@supabase/supabase-js@2";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const out = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const URL_ = Deno.env.get("SUPABASE_URL")!;
const svc = () => createClient(URL_, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const trunc = (v: any): any => typeof v === "string" ? (v.length > 240 ? v.slice(0, 240) + "… (" + v.length + " chars)" : v)
  : Array.isArray(v) ? v.map(trunc) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, trunc(x)])) : v;
async function q(sql: string, max = 500) {
  const { data, error } = await svc().rpc("dn_admin_query", { q: sql, max_rows: max });
  if (error) throw new Error(error.message);
  return trunc(data);
}
async function guard(req: Request) {
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return null;
  const u = createClient(URL_, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: "Bearer " + jwt } } });
  const { data, error } = await u.auth.getUser();
  if (error || !data.user?.email || !data.user.email_confirmed_at && !data.user.confirmed_at) return null;
  const { data: a } = await svc().from("dn_admins").select("email").eq("email", data.user.email.toLowerCase()).maybeSingle();
  return a ? data.user.email : null;
}
const time = async (f: () => Promise<any>) => { const t = performance.now(); try { const r = await f(); return { ok: true, ms: Math.round(performance.now() - t), ...r }; } catch (e) { return { ok: false, ms: Math.round(performance.now() - t), error: String((e as Error).message ?? e) }; } };
const ping = (url: string, init: RequestInit = {}) => time(async () => { const r = await fetch(url, { ...init, signal: AbortSignal.timeout(8000) }); return { status: r.status, ok: r.status < 500 }; });

async function overview() {
  const tabs: any[] = await q(`select table_name t from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1`);
  const counts = "select 'auth.users' t, count(*)::int n from auth.users union all " + tabs.map((x) => `select 'public.${x.t}', count(*)::int from public."${x.t}"`).join(" union all ");
  const Q: Record<string, string> = {
    counts,
    tables: `select s.schemaname sch, s.relname tbl, s.n_live_tup live, s.n_tup_ins ins, s.n_tup_upd upd, s.n_tup_del del, s.seq_scan, s.idx_scan, pg_total_relation_size(s.relid) bytes, c.relrowsecurity rls, (select count(*) from pg_policy p where p.polrelid=c.oid)::int policies from pg_stat_user_tables s join pg_class c on c.oid=s.relid order by bytes desc`,
    db: `select numbackends, xact_commit, xact_rollback, blks_read, blks_hit, tup_returned, tup_fetched, tup_inserted, tup_updated, tup_deleted, deadlocks, temp_files, temp_bytes, stats_reset, pg_database_size(current_database()) dbsize, now() now, version() version from pg_stat_database where datname=current_database()`,
    conns: `select coalesce(state,'background') state, count(*)::int n from pg_stat_activity where datname=current_database() group by 1 order by 2 desc`,
    users: `select count(*)::int total, count(*) filter (where last_sign_in_at>now()-interval '1 day')::int active_1d, count(*) filter (where last_sign_in_at>now()-interval '7 days')::int active_7d, count(*) filter (where last_sign_in_at>now()-interval '30 days')::int active_30d, count(*) filter (where created_at>now()-interval '7 days')::int new_7d from auth.users`,
    signups: `select to_char(date_trunc('day',created_at),'YYYY-MM-DD') d, count(*)::int n from auth.users where created_at>now()-interval '30 days' group by 1 order by 1`,
    providers: `select provider, count(*)::int n from auth.identities group by 1 order by 2 desc`,
    renders_day: `select to_char(date_trunc('day',created_at),'YYYY-MM-DD') d, count(*) filter (where status<>'failed')::int ok, count(*) filter (where status='failed')::int failed from render_log where created_at>now()-interval '30 days' group by 1 order by 1`,
    renders_mode: `select mode, count(*)::int n, count(*) filter (where status='failed')::int failed from render_log group by 1 order by 2 desc`,
    renders_user: `select coalesce(u.email, r.user_id::text) who, count(*)::int n from render_log r left join auth.users u on u.id=r.user_id group by 1 order by 2 desc limit 8`,
    renders_tot: `select count(*) filter (where status<>'failed')::int used, count(*) filter (where status='failed')::int failed, count(*)::int total, max(created_at) last from render_log`,
    credits: `select count(*)::int users, coalesce(sum(credits),0)::int total, round(avg(credits),1) avg, min(credits) min, max(credits) max, count(*) filter (where credits<=0)::int empty from profiles`,
    shares: `select (select count(*) from dn_shares)::int shares, (select count(*) from dn_shares where expires_at>now())::int active, (select count(*) from dn_votes)::int votes`,
    kv: `select split_part(k,':',1) prefix, count(*)::int n, coalesce(sum(length(v)),0)::bigint bytes from kv group by 1 order by 3 desc`,
    storage: `select bucket_id, count(*)::int n, coalesce(sum((metadata->>'size')::bigint),0)::bigint bytes from storage.objects group by 1`,
    statements: `select case when query ilike 'with pgrst_source%' then 'REST API (PostgREST)' when query ilike 'select%' then 'SELECT' when query ilike 'insert%' then 'INSERT' when query ilike 'update%' then 'UPDATE' when query ilike 'delete%' then 'DELETE' else 'Other' end kind, sum(calls)::bigint calls, sum(rows)::bigint rows, round(sum(total_exec_time)::numeric,0) total_ms from pg_stat_statements group by 1 order by 2 desc`,
    slow: `select left(regexp_replace(query,'\\s+',' ','g'),140) query, calls, round(total_exec_time::numeric,0) total_ms, round(mean_exec_time::numeric,2) mean_ms, rows from pg_stat_statements where query not ilike '%pg_stat%' order by total_exec_time desc limit 8`,
    extensions: `select extname, extversion from pg_extension order by 1`,
    nopolicy: `select schemaname sch, tablename tbl, rowsecurity rls from pg_tables where schemaname='public' order by 1,2`,
  };
  const keys = Object.keys(Q);
  const res = await Promise.all(keys.map(async (k) => { try { return [k, await q(Q[k], 200)]; } catch (e) { return [k, { error: String((e as Error).message) }]; } }));
  return { generated: new Date().toISOString(), ...Object.fromEntries(res), env: { MAX_TOTAL_RENDERS: Number(Deno.env.get("MAX_TOTAL_RENDERS") ?? "300"), GEMINI_API_KEY: !!Deno.env.get("GEMINI_API_KEY"), ANTHROPIC_API_KEY: !!Deno.env.get("ANTHROPIC_API_KEY") } };
}
async function health(siteUrl: string) {
  const fn = (n: string) => ping(`${URL_}/functions/v1/${n}`, { method: "OPTIONS" });
  const [db, rest, auth, ai, generate, plan, phone, site] = await Promise.all([
    time(async () => { await q("select 1 as ok", 1); return {}; }),
    ping(`${URL_}/rest/v1/`, { headers: { apikey: Deno.env.get("SUPABASE_ANON_KEY")! } }),
    ping(`${URL_}/auth/v1/health`, { headers: { apikey: Deno.env.get("SUPABASE_ANON_KEY")! } }),
    fn("ai"), fn("generate"), fn("dn-plan"), fn("dn-phone-login"), ping(siteUrl),
  ]);
  return { checked: new Date().toISOString(), checks: { "Database": db, "REST API": rest, "Auth": auth, "Edge: ai": ai, "Edge: generate": generate, "Edge: dn-plan": plan, "Edge: dn-phone-login": phone, "Netlify site": site } };
}
async function table(b: any) {
  const name = String(b.name ?? ""), sch = b.schema === "auth" ? "auth" : "public";
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error("bad table name");
  const ok: any[] = await q(`select 1 from information_schema.tables where table_schema='${sch}' and table_name='${name}' and table_type='BASE TABLE'`, 1);
  if (!ok.length) throw new Error("unknown table");
  if (sch === "auth" && !["users", "identities", "sessions"].includes(name)) throw new Error("not available");
  const cols: any[] = await q(`select column_name c, data_type t from information_schema.columns where table_schema='${sch}' and table_name='${name}' order by ordinal_position`, 200);
  const hide = new Set(["encrypted_password", "confirmation_token", "recovery_token", "email_change_token_new", "email_change_token_current", "reauthentication_token", "phone_change_token", "email_change", "raw_app_meta_data", "raw_user_meta_data", "refresh_token", "factor_id"]);
  const list = cols.filter((c) => !hide.has(c.c)).map((c) => `"${c.c}"`).join(",");
  const off = Math.max(0, Number(b.offset) || 0), lim = Math.min(200, Math.max(1, Number(b.limit) || 50));
  const filter = b.filter ? ` where (${'"' + cols[0].c + '"'}::text ilike '%${String(b.filter).replace(/[^\w@.\- ]/g, "")}%' or row_to_json(t)::text ilike '%${String(b.filter).replace(/[^\w@.\- ]/g, "")}%')` : "";
  const base = `${sch}."${name}" t`;
  const total: any[] = await q(`select count(*)::int n from ${base}${filter}`, 1);
  const rows = await q(`select ${list} from ${base}${filter} order by 1 desc offset ${off} limit ${lim}`, lim);
  return { columns: cols.filter((c) => !hide.has(c.c)), rows, total: total[0]?.n ?? 0, offset: off, limit: lim };
}
async function netlify(b: any) {
  const token = String(b.token ?? ""); if (!token) throw new Error("Paste a Netlify personal access token first.");
  const site = String(b.site ?? "").replace(/[^\w.\-]/g, "");
  const H = { Authorization: "Bearer " + token, "User-Agent": "DecoNova-Admin" };
  const get = async (p: string) => { const r = await fetch("https://api.netlify.com/api/v1" + p, { headers: H, signal: AbortSignal.timeout(12000) }); if (!r.ok) throw new Error("Netlify " + r.status + " on " + p.split("?")[0]); return r.json(); };
  const s = await get(`/sites/${site}`);
  const [deploys, files] = await Promise.all([get(`/sites/${s.id}/deploys?per_page=25`), get(`/sites/${s.id}/files`).catch(() => [])]);
  return trunc({ site: { name: s.name, url: s.ssl_url || s.url, admin_url: s.admin_url, state: s.state, created_at: s.created_at, updated_at: s.updated_at, account: s.account_name, plan: s.plan, custom_domain: s.custom_domain, published_deploy: s.published_deploy && { id: s.published_deploy.id, published_at: s.published_deploy.published_at, deploy_time: s.published_deploy.deploy_time }, build_settings: s.build_settings && { repo_url: s.build_settings.repo_url } },
    deploys: deploys.map((d: any) => ({ id: d.id, state: d.state, created_at: d.created_at, published_at: d.published_at, deploy_time: d.deploy_time, branch: d.branch, context: d.context, title: d.title, error: d.error_message, url: d.deploy_ssl_url })), file_count: Array.isArray(files) ? files.length : null, total_size: Array.isArray(files) ? files.reduce((a: number, f: any) => a + (f.size || 0), 0) : null });
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const who = await guard(req);
    if (!who) return out({ ok: false, code: "forbidden", message: "This page is only for DecoNova admins. Sign in with an admin account." }, 403);
    const b = await req.json().catch(() => ({}));
    switch (b.action) {
      case "whoami": return out({ ok: true, email: who });
      case "overview": return out({ ok: true, ...(await overview()) });
      case "health": return out({ ok: true, ...(await health(String(b.site_url || "https://stirring-piroshki-b4494b.netlify.app"))) });
      case "table": return out({ ok: true, ...(await table(b)) });
      case "query": { const t = performance.now(); const rows = await q(String(b.sql ?? ""), Math.min(2000, Number(b.max) || 500)); return out({ ok: true, rows, ms: Math.round(performance.now() - t) }); }
      case "netlify": return out({ ok: true, ...(await netlify(b)) });
      default: return out({ ok: false, message: "Unknown action." }, 400);
    }
  } catch (e) { return out({ ok: false, message: String((e as Error).message ?? e) }, 200); }
});
