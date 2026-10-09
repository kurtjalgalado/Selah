import { describe, it, expect } from 'vitest';
import { 
    isSuperuser, 
    isAdmin, 
    isWorshipLeader, 
    canManageSchedule, 
    canManageRoles, 
    canManageSetlists, 
    getRoleLabel,
    ROLES,
    SUPERUSER_EMAIL
} from './rbac';

describe('RBAC Role & Permission Helpers', () => {
    it('discreetly designates kurt.jalgalado@gmail.com as superuser regardless of stored role', () => {
        const user = { email: 'kurt.jalgalado@gmail.com' };
        const profile = { email: 'kurt.jalgalado@gmail.com', role: 'worship_team_member' };

        expect(isSuperuser(user, profile)).toBe(true);
        expect(isAdmin(user, profile)).toBe(true);
        expect(canManageSchedule(user, profile)).toBe(true);
        expect(canManageRoles(user, profile)).toBe(true);
        expect(canManageSetlists(user, profile)).toBe(true);
    });

    it('identifies superuser role correctly', () => {
        const user = { email: 'other@example.com' };
        const profile = { email: 'other@example.com', role: ROLES.SUPERUSER };

        expect(isSuperuser(user, profile)).toBe(true);
        expect(canManageRoles(user, profile)).toBe(true);
        expect(canManageSchedule(user, profile)).toBe(true);
    });

    it('identifies admin role correctly', () => {
        const user = { email: 'admin@example.com' };
        const profile = { email: 'admin@example.com', role: ROLES.ADMIN };

        expect(isSuperuser(user, profile)).toBe(false);
        expect(isAdmin(user, profile)).toBe(true);
        expect(canManageRoles(user, profile)).toBe(false);
        expect(canManageSchedule(user, profile)).toBe(true);
        expect(canManageSetlists(user, profile)).toBe(true);
    });

    it('identifies worship leader role correctly', () => {
        const user = { email: 'leader@example.com' };
        const profile = { email: 'leader@example.com', role: ROLES.WORSHIP_LEADER };

        expect(isSuperuser(user, profile)).toBe(false);
        expect(isAdmin(user, profile)).toBe(false);
        expect(canManageSchedule(user, profile)).toBe(false);
        expect(canManageSetlists(user, profile)).toBe(true);
    });

    it('identifies regular worship team member role correctly', () => {
        const user = { email: 'member@example.com' };
        const profile = { email: 'member@example.com', role: ROLES.WORSHIP_TEAM_MEMBER };

        expect(isSuperuser(user, profile)).toBe(false);
        expect(isAdmin(user, profile)).toBe(false);
        expect(canManageSchedule(user, profile)).toBe(false);
        expect(canManageSetlists(user, profile)).toBe(false);
    });

    it('returns appropriate labels for roles', () => {
        expect(getRoleLabel(ROLES.SUPERUSER)).toBe('Superuser');
        expect(getRoleLabel(ROLES.ADMIN)).toBe('Admin');
        expect(getRoleLabel(ROLES.WORSHIP_LEADER)).toBe('Worship Leader');
        expect(getRoleLabel(ROLES.WORSHIP_TEAM_MEMBER)).toBe('Worship Team Member');
    });
});
