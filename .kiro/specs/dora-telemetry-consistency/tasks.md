# Tasks: DORA Telemetry Consistency

- [x] Define shared namespace (`DevEx/DORA`) and dimension names (`TeamName`, `WorkIdPrefix`)
      in both `dora.py` and `metrics.ts`.
- [x] `devex dora report --emit-cloudwatch` reads `work_id_prefix` from `.devex.yml` and
      attaches it as both dimensions.
- [x] Fail with a clear error (not a silent undimensioned emit) when `.devex.yml` is missing.
- [x] `emitLeadTimeMetric()` (TypeScript) attaches the same dimension names from
      `DoraDimensions`.
- [ ] Add a mocked-boto3 unit test for `_emit_to_cloudwatch()` asserting the exact
      `Dimensions` payload sent to `put_metric_data` (tracked gap — not yet implemented).
- [ ] Add an equivalent mocked `CloudWatchClient` test for `emitLeadTimeMetric()` asserting
      `cwDimensions` (tracked gap — not yet implemented).
