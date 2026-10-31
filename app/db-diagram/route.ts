import { readFile } from "fs/promises";
import path from "path";
import { query } from "@/lib/db";

// Public page (excluded from auth in proxy.ts): ER diagram of the live
// "public" schema. Only structure is exposed — never row data.
export const dynamic = "force-dynamic";

const CACHE_MS = 5 * 60 * 1000;
let cache: { html: string; at: number } | null = null;

const SCHEMA_SQL = `
with rels as (
  select c.oid, c.relname, c.relkind
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r','v')
),
cols as (
  select r.relname, json_agg(json_build_object(
    'n', a.attname,
    't', format_type(a.atttypid, a.atttypmod),
    'nn', a.attnotnull,
    'd', pg_get_expr(ad.adbin, ad.adrelid),
    'g', a.attgenerated <> '') order by a.attnum) as cols
  from rels r join pg_attribute a on a.attrelid = r.oid and a.attnum > 0 and not a.attisdropped
  left join pg_attrdef ad on ad.adrelid = r.oid and ad.adnum = a.attnum
  group by r.relname
),
cons as (
  select cl.relname, json_agg(json_build_object(
    'name', co.conname, 'type', co.contype,
    'cols', (select json_agg(attname order by k.ord) from unnest(co.conkey) with ordinality k(num, ord)
             join pg_attribute on attrelid = co.conrelid and attnum = k.num),
    'ref', case when co.contype = 'f' then (select relname from pg_class where oid = co.confrelid) end,
    'refcols', case when co.contype = 'f' then (select json_agg(attname order by k.ord) from unnest(co.confkey) with ordinality k(num, ord)
             join pg_attribute on attrelid = co.confrelid and attnum = k.num) end,
    'del', co.confdeltype,
    'def', pg_get_constraintdef(co.oid)) order by co.contype, co.conname) as cons
  from pg_constraint co join pg_class cl on cl.oid = co.conrelid join pg_namespace n on n.oid = cl.relnamespace
  where n.nspname = 'public' group by cl.relname
),
idx as (
  select tablename as relname, json_agg(json_build_object('name', indexname, 'def', indexdef) order by indexname) as idx
  from pg_indexes where schemaname = 'public' group by tablename
),
trg as (
  select c.relname, json_agg(json_build_object('name', t.tgname) order by t.tgname) as trg
  from pg_trigger t join pg_class c on c.oid = t.tgrelid where not t.tgisinternal group by c.relname
),
deps as (
  select v.relname, json_agg(distinct src.relname) as deps
  from pg_class v join pg_rewrite rw on rw.ev_class = v.oid
  join pg_depend d on d.objid = rw.oid and d.classid = 'pg_rewrite'::regclass and d.refclassid = 'pg_class'::regclass
  join pg_class src on src.oid = d.refobjid and src.oid <> v.oid
  join pg_namespace n on n.oid = v.relnamespace
  where n.nspname = 'public' and v.relkind = 'v' group by v.relname
)
select json_agg(json_build_object(
  'name', r.relname, 'kind', r.relkind,
  'columns', cols.cols, 'constraints', cons.cons, 'indexes', idx.idx, 'triggers', trg.trg, 'deps', deps.deps
) order by r.relkind, r.relname) as schema,
current_setting('server_version') as version
from rels r left join cols using (relname) left join cons using (relname)
left join idx using (relname) left join trg using (relname) left join deps using (relname)`;

// Keeps a JSON payload from closing the inline <script> it is embedded in.
const toScript = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c");

async function render(): Promise<string> {
  const [template, res] = await Promise.all([
    readFile(path.join(process.cwd(), "lib", "schema-diagram.html"), "utf8"),
    query<{ schema: unknown[]; version: string }>(SCHEMA_SQL),
  ]);
  const { schema, version } = res.rows[0];
  return template
    .replace("/*__DATA__*/", () => toScript(schema ?? []))
    .replace("/*__META__*/", () => toScript({ version: version.split(" ")[0] }));
}

export async function GET() {
  try {
    if (!cache || Date.now() - cache.at > CACHE_MS) {
      cache = { html: await render(), at: Date.now() };
    }
    return new Response(cache.html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=300",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  } catch (err) {
    console.error("db-diagram error", err);
    return new Response("No se pudo generar el diagrama.", { status: 500 });
  }
}
