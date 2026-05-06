import { ValidationError } from "@/lib/error-handler"

export async function validateSalesOrderReferences(supabase: any, organizationId: string, order: any) {
    const { account_id, contact_id, opportunity_id, items = [] } = order

    const accountQuery = account_id
        ? supabase.from("accounts").select("id").eq("id", account_id).eq("organization_id", organizationId).maybeSingle()
        : Promise.resolve({ data: null, error: null })

    const contactQuery = contact_id
        ? supabase.from("contacts").select("id").eq("id", contact_id).eq("organization_id", organizationId).maybeSingle()
        : Promise.resolve({ data: null, error: null })

    const opportunityQuery = opportunity_id
        ? supabase.from("opportunities").select("id").eq("id", opportunity_id).eq("organization_id", organizationId).maybeSingle()
        : Promise.resolve({ data: null, error: null })

    const productIds = [...new Set(items.map((item: any) => item.product_id).filter(Boolean))] as string[]
    const productsQuery = productIds.length > 0
        ? supabase.from("products").select("id").eq("organization_id", organizationId).in("id", productIds)
        : Promise.resolve({ data: [], error: null })

    const [
        { data: account, error: accountError },
        { data: contact, error: contactError },
        { data: opportunity, error: opportunityError },
        { data: products, error: productsError },
    ] = await Promise.all([accountQuery, contactQuery, opportunityQuery, productsQuery])

    if (accountError) throw accountError
    if (account_id && !account) {
        throw new ValidationError("La cuenta seleccionada no existe o no pertenece a tu organización")
    }

    if (contactError) throw contactError
    if (contact_id && !contact) {
        throw new ValidationError("El contacto seleccionado no existe o no pertenece a tu organización")
    }

    if (opportunityError) throw opportunityError
    if (opportunity_id && !opportunity) {
        throw new ValidationError("La oportunidad seleccionada no existe o no pertenece a tu organización")
    }

    if (productsError) throw productsError
    if (productIds.length > 0 && (products || []).length !== productIds.length) {
        throw new ValidationError("Uno o más productos no existen o no pertenecen a tu organización")
    }
}
