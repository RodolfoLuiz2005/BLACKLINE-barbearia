# Firestore Rules Analysis - Blackline Barbearia

Project: blackline-93c09 / 233160577064
Database: (default), STANDARD, FIRESTORE_NATIVE, location nam5

Collections used by the current app:
- agendamentos: public booking creates; admin reads, updates, deletes.
- servicos, profissionais, configuracoes, galeria, planos: catalog/config collections. Current local UI still seeds many of these from static blackline-config.js, but rules keep them readable and admin-writable for future CMS usage.

Firestore SDK operations introduced/used:
- agendamentos setDoc(doc(db, 'agendamentos', codigo), data) for public booking creation.
- agendamentos getDocs(collection(db, 'agendamentos')) and query(orderBy('data'), orderBy('horario')) for authenticated admin panel.
- agendamentos updateDoc(doc(db, 'agendamentos', id), patch) for admin status/reschedule updates.

Auth patterns:
- Public users are unauthenticated and may create only valid pending appointment documents.
- Admin users sign in with Firebase Authentication using Email/Password or Google popup.
- Admin authorization is controlled by firestore.rules isAdmin(), currently hardcoded to the existing admin UID and allowing future custom claim admin == true.

Sensitive data:
- agendamentos contains PII: nome and telefone. It must not be publicly readable.
- Catalog collections should not contain client PII if they remain publicly readable.

Rules risks addressed:
- Strict schema validation for agendamentos creates and updates.
- Length limits on all strings accepted from public clients.
- Public creates cannot set arbitrary status, extra fields, or oversized strings.
- Admin updates still must preserve valid document shape.

Devil's advocate checks:
- Public list agendamentos: denied because read is admin-only.
- Public update/delete agendamentos: denied because update/delete is admin-only.
- Public schema pollution: denied by hasOnly().
- Public resource exhaustion: mitigated by string size limits.
- Public invalid status: denied; only pendente is allowed on public create.
- Admin update bypass: mitigated by validator on update, though admin remains intentionally privileged.