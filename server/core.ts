import { randomUUID, createHash } from 'node:crypto';
import { z } from 'zod';
import type { DB, Row } from './db.js';

export const id = () => randomUUID();
export const digest = (v: string | Buffer) => createHash('sha256').update(v).digest('hex');
export class Fault extends Error { constructor(public status: number, public code: string, message: string) { super(message); } }
export function requireThat(value: unknown, code = 'FORBIDDEN', message = 'This action is outside your authorized scope.', status = 403): asserts value {
  if (!value) throw new Fault(status, code, message);
}
export const text = z.string().trim().min(1).max(200);
export const identifier = z.string().uuid();
export const day = z.iso.date();
export const roles = z.enum(['owner','principal','teacher','office','parent','student']);
export type Actor = { id: string; org_id: string; role: z.infer<typeof roles>; name: string; email: string; csrf?: string; workspace?:'school'|'platform' };
export const portal = (a: Actor) => ['parent','student'].includes(a.role);
export const allow = (a: Actor, list: Actor['role'][]) => requireThat(list.includes(a.role));
export async function audit(db: DB, a: Actor, operation: string, entity: string, entityId: string, changes: Row = {}, branchId: string | null = null, reason: string | null = null) {
  await db.query('INSERT INTO audit_events(id,org_id,actor_id,operation,entity,entity_id,changes,branch_id,reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)', [id(),a.org_id,a.id,operation,entity,entityId,changes,branchId,reason]);
}
export async function notify(db: DB, org: string, user: string, key: string, title: string, route: string) {
  const [recipient]=await db.query('SELECT preferences,active FROM users WHERE org_id=$1 AND id=$2',[org,user]);if(!recipient?.active||recipient.preferences?.inAppNotifications===false)return;
  await db.query('INSERT INTO notifications(id,org_id,user_id,event_key,title,route) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(org_id,user_id,event_key) DO NOTHING', [id(),org,user,key,title,route]);
}
export async function enqueue(db: DB, org: string, key: string, kind: string, data: Row, at?: string) {
  await db.query('INSERT INTO outbox(id,org_id,event_key,kind,data,available_at) VALUES($1,$2,$3,$4,$5,COALESCE($6::timestamptz,now())) ON CONFLICT(org_id,event_key) DO NOTHING', [id(),org,key,kind,data,at||null]);
}
export async function branchAccess(db: DB, a: Actor, branchId: string) {
  const [b] = await db.query('SELECT * FROM branches WHERE org_id=$1 AND id=$2 AND active', [a.org_id,branchId]);
  requireThat(b);
  if (a.role !== 'owner') {
    const [grant] = await db.query('SELECT 1 FROM branch_assignments WHERE org_id=$1 AND branch_id=$2 AND user_id=$3', [a.org_id,branchId,a.id]);
    requireThat(grant);
  }
  return b;
}
export async function classAccess(db: DB, a: Actor, classId: string, subjectId?: string) {
  const [c] = await db.query('SELECT * FROM classes WHERE org_id=$1 AND id=$2', [a.org_id,classId]);
  requireThat(c);
  if (portal(a)) {
    const children = await visibleStudents(db,a);
    requireThat(children.some(s => s.class_id === classId));
  } else {
    await branchAccess(db,a,c.branch_id);
    if (a.role === 'teacher') {
      const [grant] = await db.query('SELECT 1 FROM teacher_assignments WHERE org_id=$1 AND user_id=$2 AND class_id=$3 AND ($4::text IS NULL OR subject_id=$4)', [a.org_id,a.id,classId,subjectId||null]);
      requireThat(grant);
    }
  }
  return c;
}
export async function visibleStudents(db: DB, a: Actor) {
  return db.query(`SELECT DISTINCT s.*,e.class_id,c.name AS class_name FROM students s
    LEFT JOIN enrollments e ON e.org_id=s.org_id AND e.student_id=s.id AND e.active
    LEFT JOIN classes c ON c.org_id=e.org_id AND c.id=e.class_id
    WHERE s.org_id=$1 AND s.active AND (
    $3='owner' OR
    ($3 IN ('principal','office') AND EXISTS(SELECT 1 FROM branch_assignments b WHERE b.org_id=s.org_id AND b.branch_id=s.branch_id AND b.user_id=$2)) OR
    ($3='teacher' AND EXISTS(SELECT 1 FROM branch_assignments b JOIN teacher_assignments t ON t.org_id=b.org_id AND t.user_id=b.user_id WHERE b.org_id=s.org_id AND b.branch_id=s.branch_id AND b.user_id=$2 AND t.class_id=e.class_id)) OR
    ($3='parent' AND EXISTS(SELECT 1 FROM guardian_links g WHERE g.org_id=s.org_id AND g.user_id=$2 AND g.student_id=s.id)) OR
    ($3='student' AND s.user_id=$2)) ORDER BY s.name`, [a.org_id,a.id,a.role]);
}
export async function studentAccess(db: DB, a: Actor, studentId: string) {
  const s = (await visibleStudents(db,a)).find(s => s.id === studentId);
  requireThat(s);
  return s;
}
export async function fileAccess(db: DB, a: Actor, f: Row) {
  requireThat(f.org_id === a.org_id);
  if (f.student_id) await studentAccess(db,a,f.student_id);
  else if (f.class_id) await classAccess(db,a,f.class_id);
  else { requireThat(!portal(a)); await branchAccess(db,a,f.branch_id); if (a.role==='teacher') requireThat(f.owner_id===a.id); }
}
export async function actorById(db: DB, org: string, user: string): Promise<Actor> {
  const [a] = await db.query("SELECT u.id,u.org_id,u.role,u.name,u.email FROM users u JOIN organizations o ON o.id=u.org_id WHERE u.org_id=$1 AND u.id=$2 AND u.active AND o.status='active'", [org,user]);
  requireThat(a,'ACCESS_REVOKED','Account access has been revoked.');
  return a as Actor;
}
