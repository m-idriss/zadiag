# AI authoring privacy and regulatory readiness gate

Status: **NOT APPROVED — prescription extraction, assisted translation and dynamic quiz generation must remain disabled. Standard routine proposals use the separate operator-controlled boundary documented in `ai-authoring-controls.md`.**

Last engineering review: 2026-07-21. This is a readiness checklist, not legal advice, an AIPD, an HDS certification, or a medical-device classification decision.

## Processing scope and boundaries

| Capability | Data considered | Purpose | Prohibited use | Proposed maximum retention |
| --- | --- | --- | --- | --- |
| Prescription extraction | Explicitly consented prescription image and bounded extracted fields | Prepare an editable private draft for human transcription | Diagnosis, prescription validation, dose calculation, treatment substitution, publishing, assignment, training | Original: deletion on confirm/cancel and hard maximum 24 hours; derived extraction: deletion after copy/cancel and hard maximum 7 days |
| Routine translation | User-selected private routine text | Suggest a reviewable translation diff | Silent replacement, publishing, assignment, participant/proof/prescription processing, training | Provider payload/output transient and hard maximum 24 hours; only explicitly approved text becomes ordinary private draft content |
| Routine proposal/refinement | Bounded non-medical, non-identifying user intent, selected response mode and explicitly submitted refinement | Suggest a private challenge proposal pending explicit user creation | Silent draft mutation, prescription interpretation, training | Provider payload/output transient; only the explicitly created proposal becomes ordinary private draft content |
| Dynamic quiz generation | Bounded learning topic, recent question text and weak concept labels | Create a frozen question set and private correction for one check | Profiling beyond quiz progress, diagnosis, answer-key exposure before submission, training | Provider payload/output transient; server-only answer key deleted on submission or check expiry; frozen result follows check-history retention |

Data controller, processors/subprocessors, lawful basis under GDPR Article 6, special-category condition under Article 9, contractual purpose limitation, transfer mechanism and exact retention jobs remain **undecided**. Consent UX alone is not treated as sufficient legal approval.

## Mandatory decisions before approval

- DPO/privacy owner completes and signs an AIPD covering necessity, proportionality, data flows, rights, security risks, minors/participants and residual risk. CNIL explains that an AIPD is required for processing likely to create high risk and specifically discusses AI documentation.
- Legal owner records the Article 6 and Article 9 bases, controller/processor roles, Article 28 terms, subprocessors, international transfers and data-subject request handling.
- Security owner verifies encryption, tenant isolation, access logging, deletion evidence, incident notification, prompt/output logging disabled, no provider training, and EU/approved residency.
- Hosting owner determines the exact HDS scope and provides evidence that every relevant hosting/provider activity meets the current HDS V2 requirements before prescription data leaves the approved boundary.
- Regulatory owner documents the intended purpose and obtains a qualified decision on MDR and AI Act classification. Product copy and behavior must preserve the non-diagnostic, preparatory, mandatory-human-review boundary.
- Product owner validates explicit scoped consent, withdrawal, manual fallback and user information in French and English.

## Approval record enforced by Functions

Production activation of prescription extraction, assisted translation or dynamic quizzes requires an `AI_AUTHORING_CONFIG.approval` record containing an ID, `approved` status, approval and expiry timestamps, named DPO, legal and security approvers, provider contract identifier, data residency, and exact approved capabilities. The server rejects missing names, expired records and capability mismatch even when those switches are enabled. Standard routine generation is intentionally excluded from this medical-readiness approval and remains controlled by the global and dedicated operator switches.

Default operator structure (not an approval of any sensitive capability):

```json
{
  "globalEnabled": true,
  "capabilities": {
    "prescriptionExtraction": false,
    "routineTranslation": false,
    "routineGeneration": true,
    "dynamicQuizGeneration": false
  },
  "approval": {
    "id": "REPLACE_AFTER_FORMAL_REVIEW",
    "status": "pending",
    "approvedAt": "",
    "expiresAt": "",
    "dpoApprovedBy": "",
    "legalApprovedBy": "",
    "securityApprovedBy": "",
    "provider": "",
    "dataResidency": "",
    "capabilities": []
  }
}
```

## Rights, withdrawal and deletion acceptance

Before activation, implementation must prove access/information, correction during review, deletion, consent withdrawal without loss of manual drafts, export where applicable, and bounded non-sensitive deletion receipts. A withdrawal immediately blocks new provider calls and deletes pending original/derived prescription data. Provider unavailability or contract termination invokes the same kill switch and deletion procedure.

## Official references reviewed

- [CNIL — AIPD](https://www.cnil.fr/fr/RGPD-analyse-impact-protection-des-donnees-aipd)
- [CNIL — IA : réaliser une analyse d’impact si nécessaire](https://www.cnil.fr/fr/realiser-une-analyse-dimpact-si-necessaire)
- [ANS — référentiels de certification HDS](https://esante.gouv.fr/services/hebergeurs-de-donnees-de-sante/les-referentiels-de-la-procedure-de-certification)
- [Règlement européen sur l’IA 2024/1689](https://eur-lex.europa.eu/eli/reg/2024/1689/oj?locale=fr)
- [Règlement européen relatif aux dispositifs médicaux 2017/745](https://eur-lex.europa.eu/eli/reg/2017/745/oj?locale=fr)

## Exit criteria

This document may move to **APPROVED** only when the decisions and evidence above are linked, the named approval record is reviewed, deletion/security tests pass, and a production smoke test first confirms every sensitive capability disabled. Approval is capability-specific; approval of one capability cannot activate another, and the routine-generation operator switch cannot activate a sensitive capability.
