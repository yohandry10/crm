import {
  AlignLeft,
  Calendar,
  CheckSquare,
  Hash,
  List,
  Mail,
  Phone,
  Type,
} from "lucide-react"

export const FIELD_TYPES = [
  { type: "text", label: "Texto corto", icon: Type },
  { type: "textarea", label: "Texto largo", icon: AlignLeft },
  { type: "email", label: "Email", icon: Mail },
  { type: "phone", label: "Teléfono", icon: Phone },
  { type: "number", label: "Número", icon: Hash },
  { type: "select", label: "Selección", icon: List },
  { type: "date", label: "Fecha", icon: Calendar },
  { type: "checkbox", label: "Checkbox", icon: CheckSquare },
]

export const DEFAULT_FIELDS = [
  { id: "name", type: "text", label: "Nombre", placeholder: "Tu nombre", required: true },
  { id: "email", type: "email", label: "Email", placeholder: "tu@email.com", required: true },
  { id: "phone", type: "phone", label: "Teléfono", placeholder: "+51 999 999 999", required: false },
]

