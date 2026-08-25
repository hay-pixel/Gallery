# Analysis Service

Permanent runtime boundary for visual understanding of canonical assets.

The analysis service must be deployable and runnable without the temporary build agent that implemented it. A build worker such as Manus, Codex, Gemini, ChatGPT or a human may create or improve this service, but production analysis must execute through an approved permanent model/runtime behind this boundary.

Persisted outputs must remain provider/runtime-independent and versioned. Search and Gallery consume normalized analysis records and visual features rather than proprietary build-agent response shapes.

Visual similarity/finder retrieval is exposed through the permanent Search layer using analysis-produced visual features or embeddings.
