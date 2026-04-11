import { prisma } from "./prisma";

interface AuditLogParams {
  organizationId: string;
  userId: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "VERIFY" | "CANCEL" | "TRANSFER" | "WAIVE";
  entity: string;
  entityId: string;
  changes?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Log an audit entry. Fire-and-forget — does not throw on failure.
 */
export async function logAudit(params: AuditLogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        organizationId: params.organizationId,
        userId: params.userId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        changes: params.changes || undefined,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    });
  } catch (error) {
    // Don't let audit failures break the main flow
    console.error("Audit log failed:", error);
  }
}

/**
 * Compute a diff between old and new objects for audit trail
 */
export function computeChanges(
  oldObj: Record<string, any>,
  newObj: Record<string, any>,
  fieldsToTrack?: string[]
): Record<string, { from: any; to: any }> | null {
  const changes: Record<string, { from: any; to: any }> = {};
  const keys = fieldsToTrack || Object.keys(newObj);

  for (const key of keys) {
    if (key === "updatedAt" || key === "createdAt") continue;
    if (newObj[key] !== undefined && String(oldObj[key]) !== String(newObj[key])) {
      changes[key] = { from: oldObj[key], to: newObj[key] };
    }
  }

  return Object.keys(changes).length > 0 ? changes : null;
}
