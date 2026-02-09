'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';
import type { Organization, OrganizationMember, OrgRole } from '@/lib/types/organization';

interface OrganizationState {
    organization: Organization | null;
    membership: OrganizationMember | null;
    organizations: Organization[];
    isLoading: boolean;
    error: string | null;
}

interface OrganizationContextValue extends OrganizationState {
    switchOrganization: (orgId: string) => Promise<void>;
    refreshOrganizations: () => Promise<void>;
    createOrganization: (data: Partial<Organization>) => Promise<Organization>;
    updateOrganization: (data: Partial<Organization>) => Promise<void>;
    role: OrgRole | null;
    canManageMembers: boolean;
    canManageSettings: boolean;
    canDelete: boolean;
}

const OrganizationCtx = createContext<OrganizationContextValue | null>(null);

export function OrganizationProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<OrganizationState>({
        organization: null,
        membership: null,
        organizations: [],
        isLoading: true,
        error: null,
    });

    const supabase = getSupabaseBrowserClient();

    const fetchOrganizations = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setState(s => ({ ...s, isLoading: false }));
                return;
            }

            // Get all organizations user is member of
            const { data: memberships, error: memError } = await supabase
                .from('organization_members')
                .select(`
                    *,
                    organization:organizations(*)
                `)
                .eq('user_id', user.id)
                .eq('is_active', true);

            if (memError) throw memError;

            const orgs = memberships?.map(m => m.organization).filter(Boolean) || [];

            // Get current org from profile
            const { data: profile } = await supabase
                .from('profiles')
                .select('current_organization_id')
                .eq('id', user.id)
                .maybeSingle();

            let currentOrg = orgs.find(o => o.id === profile?.current_organization_id) || orgs[0];
            let currentMembership = memberships?.find(m => m.organization_id === currentOrg?.id);

            setState({
                organization: currentOrg || null,
                membership: currentMembership || null,
                organizations: orgs,
                isLoading: false,
                error: null,
            });
        } catch (err: any) {
            setState(s => ({ ...s, isLoading: false, error: err.message }));
        }
    }, [supabase]);

    useEffect(() => {
        fetchOrganizations();
    }, [fetchOrganizations]);

    const switchOrganization = async (orgId: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        await supabase
            .from('profiles')
            .update({ current_organization_id: orgId })
            .eq('id', user.id);

        await fetchOrganizations();
    };

    const createOrganization = async (data: Partial<Organization>): Promise<Organization> => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const slug = data.slug || data.name?.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

        const { data: org, error } = await supabase
            .from('organizations')
            .insert({ ...data, slug, created_by: user.id })
            .select()
            .single();

        if (error) throw error;

        await fetchOrganizations();
        return org;
    };

    const updateOrganization = async (data: Partial<Organization>) => {
        if (!state.organization) throw new Error('No organization selected');

        const { error } = await supabase
            .from('organizations')
            .update(data)
            .eq('id', state.organization.id);

        if (error) throw error;
        await fetchOrganizations();
    };

    const role = state.membership?.role || null;

    const value: OrganizationContextValue = {
        ...state,
        switchOrganization,
        refreshOrganizations: fetchOrganizations,
        createOrganization,
        updateOrganization,
        role,
        canManageMembers: ['owner', 'admin'].includes(role || ''),
        canManageSettings: ['owner', 'admin'].includes(role || ''),
        canDelete: role === 'owner',
    };

    return <OrganizationCtx.Provider value={value}>{children}</OrganizationCtx.Provider>;
}

export function useOrganization() {
    const ctx = useContext(OrganizationCtx);
    if (!ctx) throw new Error('useOrganization must be used within OrganizationProvider');
    return ctx;
}

export function useRequireOrganization() {
    const ctx = useOrganization();
    if (!ctx.organization) throw new Error('No organization selected');
    return { ...ctx, organization: ctx.organization, membership: ctx.membership! };
}
