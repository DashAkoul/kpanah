import type { RequestContext } from '../types';
import { jsonSuccess, jsonError, readJson } from '../lib/response';
import { ContentRepository } from '../services/repository';
import { SupabaseClient } from '../services/supabase';

/**
 * پیام‌های مدیر به کاربر.
 *
 *   messages-list — پیام‌های خوانده‌نشدهٔ کاربر (برای نمایش در ورود)
 *   messages-read — علامت‌گذاری به‌عنوان خوانده‌شده
 */

function repo(env: RequestContext['env']): ContentRepository {
  return new ContentRepository(new SupabaseClient(env), env);
}

export async function handleMessagesList(
  _request: Request,
  context: RequestContext
): Promise<Response> {
  const { env, requestId, userId } = context;
  if (!userId) return jsonError('UNAUTHORIZED', 'No identity', requestId, env, 401);

  const r = repo(env);
  const messages = await r.listUserMessages(userId);
  return jsonSuccess({ messages }, requestId, env);
}

export async function handleMessagesRead(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const { env, requestId, userId } = context;
  if (!userId) return jsonError('UNAUTHORIZED', 'No identity', requestId, env, 401);

  const body = await readJson<{ ids?: string[] }>(request);
  const r = repo(env);
  await r.markMessagesRead(userId, body?.ids);
  return jsonSuccess({ ok: true }, requestId, env);
}
