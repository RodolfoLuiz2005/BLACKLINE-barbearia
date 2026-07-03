# Firestore Rules Analysis - Blackline Barbearia

Project: blackline-93c09 / database `(default)`
Edition detected by Firebase CLI: STANDARD / FIRESTORE_NATIVE / location `nam5`

## Collections and access patterns

- `agendamentos`: private appointment source of truth. Contains PII (`nome`, `telefone`) and is readable/listable only by admin.
- `consultasAgendamento`: client lookup documents keyed by SHA-256 of WhatsApp + code. Public clients may `get` one exact document; public `list` is denied.
- `ocupacaoHorarios`: minimal slot occupancy documents keyed by `profissionalId_YYYY-MM-DD_HH:MM`. Public clients may `get` exact slot docs to render availability; public `list` is denied. No PII is stored here.
- `servicos`, `profissionais`, `configuracoes`, `galeria`, `planos`: public catalog/config collections, admin-write only.

## Firestore SDK operations

- Public booking creation uses a Firestore transaction that creates:
  - one `agendamentos/{appointmentId}` doc,
  - one `consultasAgendamento/{consultaId}` doc,
  - one to three `ocupacaoHorarios/{slotId}` docs according to service duration.
- Public availability reads only exact `ocupacaoHorarios/{slotId}` docs.
- Client consultation reads only exact `consultasAgendamento/{consultaId}`.
- Client cancel/reschedule updates `agendamentos` and `consultasAgendamento` together and releases/moves slot docs in the same transaction.
- Admin reads `agendamentos` and updates status through authenticated Firestore rules.

## Security notes

- Public users cannot read/list `agendamentos`.
- Public users cannot list lookup or slot collections.
- Public create/update requires strict schema validation, allowed status transitions, bounded strings, bounded price/duration and deterministic slot IDs.
- Duplicate bookings are blocked by deterministic slot document IDs and Firestore transaction retries.
- Admin authorization is based on custom claim `admin` or a configured UID fallback.

## Devil's advocate checks

```json
{
  "score": 4,
  "summary": "Rules compile successfully and close the original PII/listing hole. The design uses deterministic occupancy docs plus transactional getAfter checks to prevent duplicate active slots without public appointment reads. Residual risk: a fully public static app cannot enforce rate limiting or secret server-side verification of WhatsApp+code; App Check or a Cloud Function would harden abuse resistance.",
  "findings": [
    {
      "check": "Public List Exploit",
      "severity": "minor",
      "issue": "Public list is denied for agendamentos, consultasAgendamento and ocupacaoHorarios. Public get on consultasAgendamento is allowed by unguessable hash id.",
      "recommendation": "Keep code entropy high and add App Check/rate limiting if abuse appears."
    },
    {
      "check": "Update Bypass",
      "severity": "minor",
      "issue": "Public updates must keep schema valid and can only cancel or reschedule mutable appointments while mirroring lookup and appointment docs.",
      "recommendation": "Retest with emulator before broad launch and consider moving client mutations to Cloud Functions for stronger server-side validation."
    },
    {
      "check": "Storage Abuse",
      "severity": "minor",
      "issue": "All public string fields have length limits and slotIds are capped at 3.",
      "recommendation": "Keep service durations within the supported 90 minute cap or update rules and UI together."
    },
    {
      "check": "Authority Source",
      "severity": "minor",
      "issue": "Admin authority does not rely on user-created Firestore data; it uses the Auth token custom claim with a configured UID fallback.",
      "recommendation": "Prefer the `admin` custom claim for production admin management and retire the UID fallback once bootstrapping is complete."
    }
  ]
}
```

## Validation performed

- `npx -y firebase-tools@latest firestore:databases:list --project blackline-93c09`
- `npx -y firebase-tools@latest deploy --only firestore:rules --dry-run --project blackline-93c09`

Dry run completed successfully with no warnings after UTF-8 BOM removal.
