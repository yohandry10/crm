import { z } from "zod"
import { webFormDialogSchema } from "@/lib/schemas"

export type WebFormDialogData = z.infer<typeof webFormDialogSchema>

