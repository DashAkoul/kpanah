import type { Env } from '../types';

/**
 * Supabase REST client (PostgREST) using the service-role key.
 *
 * We talk to PostgREST directly rather than pulling in @supabase/supabase-js:
 * smaller bundle, faster cold start, and we only need CRUD + RPC.
 */

export class SupabaseClient {
  private readonly baseUrl: string;
  private readonly serviceKey: string;

  constructor(env: Env) {
    this.baseUrl = `${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1`;
    this.serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  }

  private headers(extra: Record<string, string> = {}): HeadersInit {
    return {
      apikey: this.serviceKey,
      Authorization: `Bearer ${this.serviceKey}`,
      'Content-Type': 'application/json',
      ...extra,
    };
  }

  // ── SELECT ────────────────────────────────────────────────────────
  async select<T>(
    table: string,
    query: Record<string, string> = {},
    options: { single?: boolean } = {}
  ): Promise<T | T[] | null> {
    const url = new URL(`${this.baseUrl}/${table}`);
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);

    const headers = this.headers(
      options.single ? { Accept: 'application/vnd.pgrst.object+json' } : {}
    );

    const res = await fetch(url.toString(), { method: 'GET', headers });
    if (!options.single && (res.status === 200 || res.status === 206)) {
      return (await res.json()) as T[];
    }
    if (options.single && res.status === 200) {
      return (await res.json()) as T;
    }
    if (res.status === 404 || res.status === 406 || res.status === 200) {
      return null;
    }
    throw new SupabaseError(res.status, await res.text(), `${table} select`);
  }

  // ── INSERT ────────────────────────────────────────────────────────
  async insert<T>(
    table: string,
    rows: Record<string, unknown> | Record<string, unknown>[],
    options: { returning?: boolean; upsertOn?: string } = {}
  ): Promise<T | T[] | null> {
    const url = new URL(`${this.baseUrl}/${table}`);
    const prefer: string[] = [];
    if (options.returning !== false) prefer.push('return=representation');
    if (options.upsertOn) {
      prefer.push('resolution=merge-duplicates');
      url.searchParams.set('on_conflict', options.upsertOn);
    }

    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: this.headers({ Prefer: prefer.join(',') }),
      body: JSON.stringify(rows),
    });

    if (!res.ok) {
      throw new SupabaseError(res.status, await res.text(), `${table} insert`);
    }
    if (options.returning === false) return null;
    const json = await res.json();
    return Array.isArray(rows) ? (json as T[]) : (json as T[])[0] ?? null;
  }

  // ── UPDATE ────────────────────────────────────────────────────────
  async update<T>(
    table: string,
    match: Record<string, string | number>,
    patch: Record<string, unknown>,
    options: { single?: boolean } = {}
  ): Promise<T | null> {
    const url = new URL(`${this.baseUrl}/${table}`);
    for (const [k, v] of Object.entries(match)) url.searchParams.set(k, `eq.${v}`);

    const res = await fetch(url.toString(), {
      method: 'PATCH',
      headers: this.headers({ Prefer: 'return=representation' }),
      body: JSON.stringify(patch),
    });

    if (!res.ok) {
      throw new SupabaseError(res.status, await res.text(), `${table} update`);
    }
    const json = (await res.json()) as T[];
    if (json.length === 0) return null;
    return options.single ? json[0]! : json[0]!;
  }

  // ── DELETE ────────────────────────────────────────────────────────
  async delete(table: string, match: Record<string, string | number>): Promise<void> {
    const url = new URL(`${this.baseUrl}/${table}`);
    for (const [k, v] of Object.entries(match)) url.searchParams.set(k, `eq.${v}`);

    const res = await fetch(url.toString(), {
      method: 'DELETE',
      headers: this.headers({ Prefer: 'return=minimal' }),
    });
    if (!res.ok) {
      throw new SupabaseError(res.status, await res.text(), `${table} delete`);
    }
  }

  // ── RPC ───────────────────────────────────────────────────────────
  async rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T | null> {
    const res = await fetch(`${this.baseUrl}/rpc/${fn}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(args),
    });
    if (!res.ok) {
      throw new SupabaseError(res.status, await res.text(), `rpc ${fn}`);
    }
    const text = await res.text();
    return text ? (JSON.parse(text) as T) : null;
  }

  // ── COUNT ─────────────────────────────────────────────────────────
  async count(table: string, query: Record<string, string> = {}): Promise<number> {
    const url = new URL(`${this.baseUrl}/${table}`);
    url.searchParams.set('select', 'id');
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);

    const res = await fetch(url.toString(), {
      method: 'HEAD',
      headers: this.headers({ Prefer: 'count=exact', Range: '0-0' }),
    });
    const range = res.headers.get('Content-Range');
    if (!range) return 0;
    const total = range.split('/')[1];
    return total ? Number(total) : 0;
  }
}

export class SupabaseError extends Error {
  constructor(
    public status: number,
    public body: string,
    public op: string
  ) {
    // PGRST116 = no rows returned for .single() — not a real error
    const isNotFound = status === 404 || body.includes('PGRST116');
    super(`Supabase ${op} failed [${status}]${isNotFound ? ' (not found)' : ''}: ${body.slice(0, 300)}`);
    this.name = 'SupabaseError';
  }

  get isNotFound(): boolean {
    return this.status === 404 || this.body.includes('PGRST116');
  }

  get isConflict(): boolean {
    return this.status === 409;
  }
}
