/**
 * Neutral schema for requesting structured JSON from the model. Described
 * once with these helpers; `toJsonSchema` emits the variant Anthropic's API
 * accepts (`anyOf` for "or null", closed objects with every property
 * required, as strict mode demands).
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
      // Anthropic doesn't accept array types like ["string","null"]
      return { anyOf: [toJsonSchema(node.inner), { type: "null" }], ...desc(node.description) };
  }
}
