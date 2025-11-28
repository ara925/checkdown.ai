import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

const TaskStateEnum = z.enum(['unassigned','assigned','pending_review','approved','rejected']);

export const TaskPayloadSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  state: TaskStateEnum,
  deadline_at: z.string().nullable().optional(),
  assignee_id: z.number().nullable().optional(),
  manager_id: z.number().nullable().optional(),
  review_comment: z.string().nullable().optional(),
});

export type TaskPayload = z.infer<typeof TaskPayloadSchema>;

export async function persistTaskUpdate(client: SupabaseClient, id: number, payload: TaskPayload) {
  const parsed = TaskPayloadSchema.safeParse(payload);
  if (!parsed.success) throw new Error(parsed.error.errors[0]?.message || 'Invalid task payload');
  const { error } = await client.from('tasks').update(payload).eq('id', id);
  if (error) throw error;
  const { data, error: readErr } = await client.from('tasks').select('*').eq('id', id).limit(1).maybeSingle();
  if (readErr) throw readErr;
  if (!data) throw new Error('Task not found after update');
  if (payload.title && data.title !== payload.title) throw new Error('Integrity check failed: title mismatch');
  if (payload.state && data.state !== payload.state) throw new Error('Integrity check failed: state mismatch');
  if (typeof payload.deadline_at !== 'undefined' && data.deadline_at !== payload.deadline_at) throw new Error('Integrity check failed: deadline mismatch');
  return data;
}

export async function persistTaskInsert(client: SupabaseClient, payload: TaskPayload) {
  const parsed = TaskPayloadSchema.safeParse(payload);
  if (!parsed.success) throw new Error(parsed.error.errors[0]?.message || 'Invalid task payload');
  const { data, error } = await client.from('tasks').insert(payload).select().single();
  if (error) throw error;
  if (!data?.id) throw new Error('Insert did not return task id');
  const { data: row, error: readErr } = await client.from('tasks').select('*').eq('id', data.id).limit(1).maybeSingle();
  if (readErr) throw readErr;
  if (!row) throw new Error('Task not found after insert');
  if (payload.title && row.title !== payload.title) throw new Error('Integrity check failed: title mismatch');
  return row;
}

export type TaskLink = { id?: number; url: string; description?: string | null };

export async function persistTaskLinks(client: SupabaseClient, taskId: number, links: TaskLink[], userId: number) {
  const { data: existing, error: readErr } = await client
    .from('task_links')
    .select('id, url, description')
    .eq('task_id', taskId);
  if (readErr) throw readErr;
  const existingMap = new Map<number, { id: number; url: string; description: string | null }>();
  (existing || []).forEach(l => existingMap.set(l.id as number, { id: l.id as number, url: l.url as string, description: (l.description as string | null) ?? null }));

  const desiredById = new Map<number, TaskLink>();
  links.filter(l => typeof l.id === 'number').forEach(l => desiredById.set(l.id as number, { id: l.id as number, url: l.url, description: l.description ?? null }));

  const idsToDelete = (existing || [])
    .filter(l => !desiredById.has(l.id as number))
    .map(l => l.id as number);

  if (idsToDelete.length > 0) {
    const { error: delErr } = await client.from('task_links').delete().in('id', idsToDelete);
    if (delErr) throw delErr;
  }

  const updates = links.filter(l => typeof l.id === 'number')
    .filter(l => {
      const e = existingMap.get(l.id as number);
      return !!e && (e.url !== l.url || (e.description ?? null) !== (l.description ?? null));
    });
  for (const u of updates) {
    const { error: upErr } = await client
      .from('task_links')
      .update({ url: u.url, description: u.description ?? null })
      .eq('id', u.id as number);
    if (upErr) throw upErr;
  }

  const inserts = links.filter(l => !l.id);
  if (inserts.length > 0) {
    const { error: insErr } = await client
      .from('task_links')
      .insert(inserts.map(l => ({ task_id: taskId, url: l.url, description: l.description ?? null, created_by: userId })));
    if (insErr) throw insErr;
  }

  const { data: after, error: verifyErr } = await client
    .from('task_links')
    .select('id, url, description')
    .eq('task_id', taskId);
  if (verifyErr) throw verifyErr;
  const desiredSet = new Set(links.map(l => `${l.url}|${l.description ?? null}`));
  const afterSet = new Set((after || []).map(l => `${l.url}|${(l.description as string | null) ?? null}`));
  if (desiredSet.size !== afterSet.size) throw new Error('Integrity check failed: link count mismatch');
  for (const k of desiredSet) { if (!afterSet.has(k)) throw new Error('Integrity check failed: link content mismatch'); }
}

export function toTwoDigits(n: number): string { return String(n).padStart(2, '0'); }
