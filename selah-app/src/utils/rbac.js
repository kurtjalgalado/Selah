/**
 * Role-Based Access Control (RBAC) definitions and helpers for Selah Worship Planner.
 * 
 * Roles hierarchy:
 * 1. superuser: Can elevate/change RBAC roles of accounts, manage schedules, manage setlists.
 * 2. admin: Can schedule and assign ministers for worship services, manage setlists.
 * 3. worship_leader: Can create and manage setlist song lineups.
 * 4. worship_team_member: Regular account that can read setlists, schedules, and chord charts.
 */

export const ROLES = {
    SUPERUSER: 'superuser',
    ADMIN: 'admin',
    WORSHIP_LEADER: 'worship_leader',
    WORSHIP_TEAM_MEMBER: 'worship_team_member',
};

export const SUPERUSER_EMAIL = 'kurt.jalgalado@gmail.com';

/**
 * Check if the user is a superuser.
 * Automatically gives superuser status to the owner email kurt.jalgalado@gmail.com.
 */
export function isSuperuser(user, profile) {
    if (user?.email?.toLowerCase() === SUPERUSER_EMAIL.toLowerCase()) return true;
    if (profile?.email?.toLowerCase() === SUPERUSER_EMAIL.toLowerCase()) return true;
    const role = profile?.role || user?.user_metadata?.role;
    return role === ROLES.SUPERUSER;
}

/**
 * Check if the user is an admin or superuser.
 */
export function isAdmin(user, profile) {
    if (isSuperuser(user, profile)) return true;
    const role = profile?.role || user?.user_metadata?.role;
    return role === ROLES.ADMIN;
}

/**
 * Check if the user can create and manage setlists (Worship Leader, Admin, Superuser).
 */
export function isWorshipLeader(user, profile) {
    if (isAdmin(user, profile)) return true;
    const role = profile?.role || user?.user_metadata?.role;
    // Default fallback role for legacy users is worship_leader
    return role === ROLES.WORSHIP_LEADER || !role;
}

/**
 * Check if the user can manage minister schedules (Admin or Superuser).
 */
export function canManageSchedule(user, profile) {
    return isAdmin(user, profile);
}

/**
 * Check if the user can elevate or change RBAC roles (Superuser only).
 */
export function canManageRoles(user, profile) {
    return isSuperuser(user, profile);
}

/**
 * Check if the user can create/edit setlists (Worship Leader, Admin, or Superuser).
 */
export function canManageSetlists(user, profile) {
    return isWorshipLeader(user, profile);
}

/**
 * Get display label for a role.
 */
export function getRoleLabel(role) {
    switch (role) {
        case ROLES.SUPERUSER:
            return 'Superuser';
        case ROLES.ADMIN:
            return 'Admin';
        case ROLES.WORSHIP_LEADER:
            return 'Worship Leader';
        case ROLES.WORSHIP_TEAM_MEMBER:
        default:
            return 'Worship Team Member';
    }
}

/**
 * Get badge styling classes for a role.
 */
export function getRoleBadgeStyle(role) {
    switch (role) {
        case ROLES.SUPERUSER:
            return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
        case ROLES.ADMIN:
            return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
        case ROLES.WORSHIP_LEADER:
            return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
        case ROLES.WORSHIP_TEAM_MEMBER:
        default:
            return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    }
}
