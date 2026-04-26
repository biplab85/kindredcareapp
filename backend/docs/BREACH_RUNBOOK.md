# Data Breach Incident Response Runbook

**Status:** Phase 15.D scaffolding — must be reviewed by counsel before public launch.

## Trigger conditions

A data breach is suspected when any of the following occurs:

- Database export, dump, or unauthorized read confirmed in logs
- Customer reports their data appearing on a third-party site
- Pen-test or security researcher discloses a remote code execution
- Cloud account credential rotation reveals unauthorized access
- Backup file confirmed downloaded by non-staff IP
- Any other event with reasonable suspicion of personal data exposure

## 0–1 hour: Containment

1. **Notify the safety lead** via the on-call channel (Phase 1 deferred — replace with PagerDuty / OpsGenie at production).
2. **Identify the scope** — which user data classes, how many records, time window.
3. **Stop the bleeding** — revoke credentials, rotate keys, pull suspect IP ranges from CDN/firewall.
4. **Preserve evidence** — snapshot logs and database state before further investigation.
5. Open an incident ticket with a unique `INCIDENT_ID` (format: `INC-YYYYMMDD-NN`). All subsequent communication references it.

## 1–24 hours: Triage

1. Confirm the breach (or rule out — false positives are common). Document the determination.
2. Engage outside counsel if the breach is confirmed to involve personal information of any user.
3. Determine whether the breach poses a "real risk of significant harm" (RROSH) under PIPEDA — financial loss, identity theft, fraud, harm to reputation, or relationship damage. **If yes, notification is mandatory.**
4. Identify affected users by ID. Build the list as a CSV.

## 24–72 hours: Notification

PIPEDA requires notification "as soon as feasible" after determining a breach with RROSH. Practically, treat 72 hours as the hard ceiling.

### Office of the Privacy Commissioner of Canada (OPC)

Submit a Privacy Breach Report at https://www.priv.gc.ca/en/report-a-concern/report-a-privacy-breach-at-your-business/.

Required fields:
- Date of breach + date of confirmation
- Number of individuals affected
- Description of incident
- Personal information involved
- Cause and assessment of harm
- Mitigation steps + future prevention

### Affected users

Dispatch via `BreachNotification`:

```php
use App\Notifications\BreachNotification;
use App\Models\User;
use Illuminate\Support\Facades\Notification;

$users = User::query()->whereIn('id', [1, 2, 3])->get();

Notification::send($users, new BreachNotification(
    incidentId: 'INC-20260426-01',
    whatHappened: 'Concrete description of the incident.',
    dataAffected: 'Specific categories — names, emails, partial booking history.',
    stepsTaken: 'What we have done — credential rotation, log review, etc.',
    stepsForUser: 'What the user should do — change password, monitor cards, etc.',
));
```

## After notification: Recovery

1. Document root cause + timeline in a written post-mortem.
2. Implement preventative controls; track in the security backlog.
3. Update this runbook with lessons learned.
4. Retain breach records for at least 24 months per PIPEDA s. 10.3(1).

## Decision matrix: do we need to notify?

| Question | Answer | Action |
|---|---|---|
| Was personal information involved? | No | No PIPEDA notification required (still document internally) |
| Was personal information involved? | Yes | Continue |
| Real risk of significant harm? | No | OPC notification optional but recommended; user notification not required |
| Real risk of significant harm? | Yes | OPC + user notification within 72h is mandatory |

## Templates

The `BreachNotification` notification class wraps the user-facing email. Copy of OPC report template lives at `docs/BREACH_OPC_REPORT_TEMPLATE.md` (TODO).

## Roles

- **Privacy Officer** — owns the incident, decides on notification, files OPC report
- **Engineering on-call** — leads containment + forensics
- **Customer Success** — handles individual user inquiries post-notification
- **Outside counsel** — engaged if RROSH determination is made
