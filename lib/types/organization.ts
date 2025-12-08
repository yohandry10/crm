// =====================================================
// MULTI-TENANT TYPES
// =====================================================

export type OrgRole = 'owner' | 'admin' | 'manager' | 'member' | 'viewer';

export interface Organization {
    id: string;
    name: string;
    slug: string;
    ruc?: string;
    legal_name?: string;
    industry?: string;
    website?: string;
    phone?: string;
    email?: string;
    address?: string;
    city?: string;
    country?: string;
    timezone?: string;
    currency?: string;
    logo_url?: string;
    plan?: string;
    max_users?: number;
    max_contacts?: number;
    is_active?: boolean;
    settings?: Record<string, unknown>;
    created_at?: string;
    updated_at?: string;
}

export interface OrganizationMember {
    id: string;
    organization_id: string;
    user_id: string;
    role: OrgRole;
    permissions?: Record<string, unknown>;
    is_active?: boolean;
    invited_by?: string;
    invited_at?: string;
    accepted_at?: string;
    job_title?: string;
    department?: string;
    created_at?: string;
    updated_at?: string;
    // Joined data
    user?: {
        email: string;
        full_name?: string;
        avatar_url?: string;
    };
}

export interface OrganizationInvitation {
    id: string;
    organization_id: string;
    email: string;
    role: OrgRole;
    token: string;
    expires_at: string;
    status: 'pending' | 'accepted' | 'expired' | 'cancelled';
    invited_by: string;
    message?: string;
    created_at?: string;
}

export interface OrganizationContext {
    organization: Organization;
    membership: OrganizationMember;
    role: OrgRole;
    permissions: {
        canManageMembers: boolean;
        canManageSettings: boolean;
        canDelete: boolean;
        canInvite: boolean;
    };
}

// Helper to check permissions
export function hasPermission(role: OrgRole, action: 'read' | 'write' | 'delete' | 'admin'): boolean {
    const permissions: Record<OrgRole, string[]> = {
        owner: ['read', 'write', 'delete', 'admin'],
        admin: ['read', 'write', 'delete', 'admin'],
        manager: ['read', 'write', 'delete'],
        member: ['read', 'write'],
        viewer: ['read'],
    };
    return permissions[role]?.includes(action) ?? false;
}

export function canManageMembers(role: OrgRole): boolean {
    return ['owner', 'admin'].includes(role);
}

export function canManageSettings(role: OrgRole): boolean {
    return ['owner', 'admin'].includes(role);
}

export function canDeleteOrganization(role: OrgRole): boolean {
    return role === 'owner';
}
