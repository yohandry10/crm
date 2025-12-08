/**
 * Auth Context Wrapper
 * Re-exports getAuthenticatedContext with userId for backward compatibility
 */

import { getAuthenticatedContext as getAuthContext } from './supabase-auth'

export async function getAuthenticatedContext() {
    const ctx = await getAuthContext()
    return {
        ...ctx,
        userId: ctx.user.id, // Add userId for backward compatibility
    }
}

// Re-export other functions
export { 
    createSupabaseRouteClient,
    createAuthenticatedClient,
    requireAuth,
    getAuthenticatedClientAndUser,
    requireOrgRole,
    withAuth
} from './supabase-auth'
