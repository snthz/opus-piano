/**
 * Esquema neutro para pedirle JSON estructurado al modelo.
 *
 * Cada proveedor exige una variante distinta de JSON Schema (OpenAI en modo
 * estricto no admite `anyOf`; Anthropic no admite tipos en array como
 * ["string","null"]), así que el esquema se describe una sola vez de forma
 * neutra y `toJsonSchema` emite la que toque.
 */

export type SchemaNode =
  | { kind: "string"; description?: string; enum?: string[] }
  | { kind: "integer"; description?: string }
  | { kind: "array"; items: SchemaNode; description?: string }
  | { kind: "object"; properties: Record<string, SchemaNode> }
  | { kind: "nullable"; inner: SchemaNode; description?: string };

export const str = (description?: string): SchemaNode => ({ kind: "string", description });
export const en = (values: readonly string[], description?: string): SchemaNode => ({ kind: "string", enum: [...values], description });
export const int = (description?: string): SchemaNode => ({ kind: "integer", description });
export const arr = (items: SchemaNode, description?: string): SchemaNode => ({ kind: "array", items, description });
export const obj = (properties: Record<string, SchemaNode>): SchemaNode => ({ kind: "object", properties });
export const nullable = (inner: SchemaNode, description?: string): SchemaNode => ({ kind: "nullable", inner, description });

/** Cómo expresar «o null»: OpenAI estricto quiere `"type": [..., "null"]`; Anthropic quiere `anyOf`. */
export type NullableStyle = "typeArray" | "anyOf";

export function toJsonSchema(node: SchemaNode, style: NullableStyle): Record<string, unknown> {
  const desc = (d?: string) => (d ? { description: d } : {});
  switch (node.kind) {
    case "string":
      return { type: "string", ...(node.enum ? { enum: node.enum } : {}), ...desc(node.description) };
    case "integer":
      return { type: "integer", ...desc(node.description) };
    case "array":
      return { type: "array", items: toJsonSchema(node.items, style), ...desc(node.description) };
    case "object": {
      const properties: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node.properties)) properties[k] = toJsonSchema(v, style);
      return { type: "object", additionalProperties: false, properties, required: Object.keys(node.properties) };
    }
    case "nullable": {
      const inner = toJsonSchema(node.inner, style);
      if (style === "anyOf") return { anyOf: [inner, { type: "null" }], ...desc(node.description) };
      const { type, enum: values, ...rest } = inner as { type: string; enum?: string[] };
      return { ...rest, type: [type, "null"], ...(values ? { enum: [...values, null] } : {}), ...desc(node.description) };
    }
  }
}
