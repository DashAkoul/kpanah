import type { RequestContext } from '../types';
import { jsonSuccess, jsonError, readJson } from '../lib/response';
import { ContentRepository } from '../services/repository';
import { SupabaseClient } from '../services/supabase';

/** سازندهٔ مخزن با کلاینت Supabase (service-role) */
function repo(env: RequestContext['env']): ContentRepository {
  return new ContentRepository(new SupabaseClient(env), env);
}

/**
 * پشتیبانی (تیکت‌ها).
 *
 * اکشن‌ها:
 *   support-create  — کاربر تیکت جدید می‌سازد
 *   support-list    — کاربر تیکت‌های خودش را می‌بیند
 *   support-thread  — پیام‌های یک تیکت
 *   support-reply   — کاربر به تیکت خودش پاسخ می‌دهد
 *   support-close   — کاربر تیکت را می‌بندد
 *
 * پاسخ ادمین در `routes/admin.ts` (اکشن admin-support-reply) است.
 */

const MAX_SUBJECT = 120;
const MAX_BODY = 2000;

const CATEGORIES = ['GENERAL', 'BILLING', 'TECHNICAL', 'CONTENT', 'REPORT'] as const;

export async function handleSupportCreate(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const { env, requestId, userId, telegramId } = context;
  if (!userId || !telegramId) {
    return jsonError('UNAUTHORIZED', 'No identity', requestId, env, 401);
  }

  const body = await readJson<{ subject?: string; body?: string; category?: string }>(request);
  const subject = (body?.subject ?? '').trim().slice(0, MAX_SUBJECT);
  const message = (body?.body ?? '').trim().slice(0, MAX_BODY);
  const category = CATEGORIES.includes((body?.category ?? '') as never)
    ? (body!.category as string)
    : 'GENERAL';

  if (subject.length < 2 || message.length < 2) {
    return jsonError('VALIDATION_ERROR', 'subject and body are required', requestId, env, 400);
  }

  const r = repo(env);
  const ticket = await r.createSupportTicket({
    userId,
    telegramId,
    subject,
    category,
    body: message,
  });

  return jsonSuccess({ ticket }, requestId, env);
}

export async function handleSupportList(
  _request: Request,
  context: RequestContext
): Promise<Response> {
  const { env, requestId, userId } = context;
  if (!userId) return jsonError('UNAUTHORIZED', 'No identity', requestId, env, 401);

  const r = repo(env);
  const tickets = await r.listSupportTickets(userId);
  return jsonSuccess({ tickets }, requestId, env);
}

export async function handleSupportThread(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const { env, requestId, userId } = context;
  if (!userId) return jsonError('UNAUTHORIZED', 'No identity', requestId, env, 401);

  const ticketId = new URL(request.url).searchParams.get('ticketId');
  if (!ticketId) {
    return jsonError('VALIDATION_ERROR', 'ticketId is required', requestId, env, 400);
  }

  const r = repo(env);
  const thread = await r.getSupportThread(ticketId, userId);
  if (!thread) return jsonError('NOT_FOUND', 'Ticket not found', requestId, env, 404);

  return jsonSuccess(thread, requestId, env);
}

export async function handleSupportReply(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const { env, requestId, userId } = context;
  if (!userId) return jsonError('UNAUTHORIZED', 'No identity', requestId, env, 401);

  const body = await readJson<{ ticketId?: string; body?: string }>(request);
  const ticketId = body?.ticketId;
  const message = (body?.body ?? '').trim().slice(0, MAX_BODY);

  if (!ticketId || message.length < 1) {
    return jsonError('VALIDATION_ERROR', 'ticketId and body are required', requestId, env, 400);
  }

  const r = repo(env);
  const ok = await r.addSupportMessage({
    ticketId,
    userId,
    author: 'USER',
    body: message,
  });
  if (!ok) return jsonError('NOT_FOUND', 'Ticket not found', requestId, env, 404);

  return jsonSuccess({ ok: true }, requestId, env);
}

export async function handleSupportClose(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const { env, requestId, userId } = context;
  if (!userId) return jsonError('UNAUTHORIZED', 'No identity', requestId, env, 401);

  const body = await readJson<{ ticketId?: string }>(request);
  if (!body?.ticketId) {
    return jsonError('VALIDATION_ERROR', 'ticketId is required', requestId, env, 400);
  }

  const r = repo(env);
  await r.closeSupportTicket(body.ticketId, userId);
  return jsonSuccess({ ok: true }, requestId, env);
}
