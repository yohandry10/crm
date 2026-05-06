import { z } from "zod"
import { ValidationError } from "@/lib/error-handler"

const hexColorSchema = z
    .string()
    .regex(/^#([0-9a-fA-F]{3}){1,2}$/, "Color inválido")

export const webFormApiFieldSchema = z.object({
    id: z.string().min(1).max(80).regex(/^[a-zA-Z0-9_-]+$/, "ID de campo inválido"),
    type: z.enum(["text", "textarea", "email", "phone", "number", "select", "date", "checkbox"]),
    label: z.string().min(1).max(100),
    placeholder: z.string().max(200).optional().nullable(),
    required: z.boolean().default(false),
    options: z.array(z.string().min(1).max(100)).max(50).optional().nullable(),
}).superRefine((field, ctx) => {
    if (field.type === "select" && (!field.options || field.options.length === 0)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Opciones requeridas para campos tipo selección",
            path: ["options"],
        })
    }
})

const notifyEmailsSchema = z
    .array(z.string().email("Email de notificación inválido"))
    .max(20)
    .default([])

export const webFormApiSchema = z.object({
    name: z.string().min(1, "Nombre requerido").max(100),
    description: z.string().max(500).optional().nullable().default(null),
    fields: z.array(webFormApiFieldSchema).min(1).max(100),
    settings: z.record(z.any()).optional().default({}),
    theme: z.object({
        primaryColor: hexColorSchema.default("#3b82f6"),
        backgroundColor: hexColorSchema.default("#ffffff"),
    }).default({ primaryColor: "#3b82f6", backgroundColor: "#ffffff" }),
    redirect_url: z.string().url().optional().nullable().or(z.literal("")).transform((value) => value || null),
    success_message: z.string().max(300).optional().nullable().default("¡Gracias! Hemos recibido tu información."),
    auto_create_contact: z.boolean().default(true),
    default_lead_status: z.enum(["cold", "warm", "hot", "converted", "lost"]).default("warm"),
    default_lead_source: z.string().min(1).max(50).default("web_form"),
    default_tags: z.array(z.string().min(1).max(50)).max(20).default([]),
    assigned_to: z.string().uuid().optional().nullable().default(null),
    notify_emails: notifyEmailsSchema,
    notify_on_submit: z.boolean().default(true),
    is_active: z.boolean().optional(),
})

export const webFormApiUpdateSchema = webFormApiSchema.partial()

export function createSlugFromName(name: string) {
    return name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .substring(0, 50) || "formulario"
}

export async function validateWebFormAssignee(supabase: any, organizationId: string, assignedTo?: string | null) {
    if (!assignedTo) return

    const { data, error } = await supabase
        .from("organization_members")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("user_id", assignedTo)
        .eq("is_active", true)
        .maybeSingle()

    if (error) throw error
    if (!data) {
        throw new ValidationError("El usuario asignado no existe o no pertenece a tu organización")
    }
}
