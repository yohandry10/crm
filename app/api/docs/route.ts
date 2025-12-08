import { type NextRequest, NextResponse } from "next/server"
import { openApiSpec, generateApiDocsHTML } from "@/lib/openapi-spec"

// GET: Return OpenAPI spec or HTML docs
export async function GET(request: NextRequest) {
  const accept = request.headers.get("accept") || ""
  const format = request.nextUrl.searchParams.get("format")

  // Return JSON spec
  if (format === "json" || accept.includes("application/json")) {
    return NextResponse.json(openApiSpec)
  }

  // Return YAML spec
  if (format === "yaml") {
    const yaml = jsonToYaml(openApiSpec)
    return new NextResponse(yaml, {
      headers: {
        "Content-Type": "text/yaml",
        "Content-Disposition": "inline; filename=openapi.yaml"
      }
    })
  }

  // Return HTML documentation
  const html = generateApiDocsHTML()
  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html",
    }
  })
}

// Simple JSON to YAML converter
function jsonToYaml(obj: any, indent = 0): string {
  const spaces = "  ".repeat(indent)
  let yaml = ""

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue

    if (Array.isArray(value)) {
      yaml += `${spaces}${key}:\n`
      for (const item of value) {
        if (typeof item === "object") {
          yaml += `${spaces}- \n${jsonToYaml(item, indent + 2).replace(/^/gm, "  ")}`
        } else {
          yaml += `${spaces}- ${item}\n`
        }
      }
    } else if (typeof value === "object") {
      yaml += `${spaces}${key}:\n${jsonToYaml(value, indent + 1)}`
    } else if (typeof value === "string" && (value.includes(":") || value.includes("#") || value.includes("\n"))) {
      yaml += `${spaces}${key}: "${value.replace(/"/g, '\\"')}"\n`
    } else {
      yaml += `${spaces}${key}: ${value}\n`
    }
  }

  return yaml
}
