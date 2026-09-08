/**
 * Esquema neutro para pedirle JSON estructurado al modelo.
 *
 * Se describe una vez con estos ayudantes y `toJsonSchema` lo emite en la
 * variante que admite la API de Anthropic (`anyOf` para «o null», objetos
 * cerrados y con todas las propiedades obligatorias, que es lo que exige el
 * modo estricto).
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

export function toJsonSchema(node: SchemaNode): Record<string, unknown> {
  const desc = (d?: string) => (d ? { description: d } : {});
  switch (node.kind) {
    case "string":
      return { type: "string", ...(node.enum ? { enum: node.enum } : {}), ...desc(node.description) };
    case "integer":
      return { type: "integer", ...desc(node.description) };
    case "array":
      return { type: "array", items: toJsonSchema(node.items), ...desc(node.description) };
    case "object": {
      const properties: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node.properties)) properties[k] = toJsonSchema(v);
      return { type: "object", additionalProperties: false, properties, required: Object.keys(node.properties) };
    }
    case "nullable":
      // Anthropic no admite tipos en array como ["string","null"].
      return { anyOf: [toJsonSchema(node.inner), { type: "null" }], ...desc(node.description) };
  }
}
