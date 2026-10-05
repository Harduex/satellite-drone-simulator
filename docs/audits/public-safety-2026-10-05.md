# Public-repository safety audit

Assessed 2026-10-05 against simulator commit `10b8d70`, with refreshed `origin` references. Scope: disclosure safety of outgoing Git content, not application security or provider-use permission.

## Verdict

**F1 — Active branch: safe to push on the checks performed.** The seven outgoing commits on `codex/wind-daylight` contain no detected secrets, private keys, machine-local paths, personal content addresses or conversation artifacts. All seven author and committer identities use the verified public GitHub noreply address. The documentation consolidation is checked separately before its local commit. Nothing was pushed.

**A1 — Other local history:** There are 17 local-only commits across all refs at the audit baseline, including the seven active-branch commits. Two stash-history commits (`1a95d8a9d`, `e52f9f967`) retain personal contact metadata. Neither is contained in the active branch or another local branch; pushing the active branch does not send them. Do not publish those stash refs without a separate metadata cleanup decision. Existing remote history also contains a non-noreply identity; this audit does not rewrite already-public history.

## Evidence

- Enumerated all 86 commits reachable from local/remote refs and checked all 681 unique committed file blobs, including text/metadata strings in binaries. No private-key markers, identified local-user/project paths, private attachment/transcript markers or non-example content email addresses were found.
- Gitleaks 8.30.1 reported 84 scanned commits across all refs, approximately 1.26 MB, with redacted output and no findings. Independent file-tree enumeration covered all 86 reachable commits. Both native stdin and Git-history synthetic-token self-tests detected the planted token. The bundled shell self-test failed with this setup; its result was not used as evidence of cleanliness.
- Enumerated committed environment/key/database/archive/media paths across history. The only environment candidates were six revisions of `.env.example`; they are setup templates, not tracked local environment files. Gitleaks found no credentials in them.
- The only committed binary blobs were five traffic GLBs and their shared palette PNG. Kenney provenance/CC0 text and the original A3/CX-5 generator/dedication are recorded in the [asset manifest](../../public/models/traffic/ATTRIBUTION.md). No local scenery probes, proprietary game meshes, screenshots, recordings or Blender checkpoints are committed.
- Actual `.env`, build output, source probes, screenshots, recordings and audit scratch remain outside tracked Git content. The scan covers intermediate commits, not only the latest tree.

## Limits and follow-up

**A2 — Separate release questions:** Source publication does not establish permission for every external provider's runtime use or recorded imagery. Existing recording/provider caveats remain in the [recording design](../superpowers/specs/2026-10-04-flight-recording-design.md). Those caveats are independent of the clean leakage result.

Repeat staged-diff, file-list, public identity and redacted secret checks before future commits. A clean scanner result supplements content/provenance inspection; it is not a guarantee against every possible private string or application vulnerability.
