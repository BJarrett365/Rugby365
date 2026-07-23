# Import Rules

Part of the Rugby365 Knowledge Base. See the [Rule Book](./rule-book.md) for permanent standards.

## Hard uniqueness

Imports must **not** create duplicate:

- players  
- teams  
- competitions  
- seasons (within a competition)  
- fixtures  

Resolution order for each entity:

1. Provider external id (confirmed mapping)  
2. Canonical / normalised name (and competition + year for seasons)  
3. Only then create a new row  

If a row already exists under a different slug or provider id but the same canonical identity, **reuse and enrich** it — never insert a parallel copy.

Competition display aliases (e.g. International Matches → International) must resolve to one competition. Season labels that share the same year under that competition must merge into one season row.
