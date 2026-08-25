# Search Evaluation Matrix Fixture Specification

Future automated evaluation should build labelled fixtures for these cases.

| Fixture | Required labels | Expected retrieval mode |
|---|---|---|
| exact byte duplicate | same `asset_id`, multiple source occurrence IDs | metadata |
| filename/path match | expected original path/name | metadata |
| tag/category | expected normalized tags/categories | metadata |
| OCR receipt | expected OCR terms | metadata or semantic |
| near duplicate | visually close but different content hash | visual_similarity |
| similar scene | same scene/object/composition class | visual_similarity |
| semantic concept | natural-language relevant set | semantic |
| hybrid concept/filter | semantic concept plus deterministic filter | hybrid |
| ambiguous query | multiple possible intents | query routing |
| no match | empty relevant set | all modes |
| incompatible model family | visual vector used against semantic or incompatible visual family | visual_similarity or semantic |
| incompatible dimension | vector dimension differs from index dimension | visual_similarity or semantic |
| incompatible similarity/normalization | similarity family or normalization semantics differ from index family | visual_similarity |
| incompatible version | model/index/feature extractor revision differs from requested compatible profile | visual_similarity or semantic |
| stale derived input/index | superseded exact Analysis `result_id`, logical `analysis_id`, feature extractor revision, feature model/version, semantic input revision, embedding model/version, or index version | visual_similarity or semantic |
| unavailable index | requested metadata, visual, or semantic index is missing/offline | all indexed modes |

Minimum reported measures:

- precision@5;
- precision@10;
- precision@50 where fixture size supports it;
- recall@5 where labelled positives exist;
- recall@10 where labelled positives exist;
- recall@50 where fixture size and labelled positives support it;
- MRR for known-item queries;
- p50/p95 latency per mode;
- index size and memory use;
- stale/unavailable classification correctness.
