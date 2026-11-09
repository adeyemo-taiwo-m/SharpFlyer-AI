# SharpFlyer template specification

This specification will document the versioned template JSON schema, field types, regions, palettes, assets, and rendering constraints.

The canonical schema is implemented in `src/schemas/template.ts` and must preserve the invariants in `README.md`: templates are data, published versions are immutable, critical text comes from structured input, and all assets are licensed.
