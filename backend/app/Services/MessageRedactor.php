<?php

namespace App\Services;

/**
 * Redacts personally-identifying or off-platform contact attempts from
 * message bodies before they're persisted. Returns both the cleaned body
 * and a list of what was caught — admins use the catch-list to spot
 * patterns (e.g. a caregiver repeatedly trying to share their cell).
 *
 * Patterns are deliberately conservative: false negatives (missed redact)
 * are easier to escalate via the report-message flow than false positives
 * that frustrate legitimate communication. The Phase 11 follow-up can
 * tighten this with a profanity allowlist + ML moderation if needed.
 */
class MessageRedactor
{
    /**
     * Compiled patterns. Key = redaction kind. Value = a regex that matches
     * the offending substring. We replace with `[{kind} redacted]` so the
     * recipient can still parse the message structure.
     *
     * Order matters — we run email before phone because emails contain
     * digits in the local-part and would otherwise look phone-ish.
     *
     * @var array<string, string>
     */
    private const PATTERNS = [
        // Email: any token with @ in the middle.
        'email' => '/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i',

        // Canadian postal code: A1A 1A1 (with optional space/hyphen).
        'postal_code' => '/\b[A-Z]\d[A-Z][\s-]?\d[A-Z]\d\b/i',

        // North American phone: handles +1 (xxx) xxx-xxxx, xxx-xxx-xxxx,
        // xxx.xxx.xxxx, xxxxxxxxxx variants. 10-11 digits with optional
        // separators. Anchored on word boundaries to avoid matching
        // ordinary numbers.
        'phone' => '/(?<!\d)(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)/',

        // Off-platform contact mentions. Case-insensitive whole-word match
        // on the most common venues family/caregivers try to migrate to.
        'off_platform' => '/\b(?:whatsapp|telegram|signal|wechat|venmo|cashapp|cash\s?app|paypal|e[\s-]?transfer|interac|zelle|instagram|snapchat|facebook|messenger|fb\s?messenger)\b/i',
    ];

    /**
     * @return array{
     *   body: string,
     *   redactions: array<int, array<string, string>>
     * }
     */
    public function redact(string $body): array
    {
        $redactions = [];
        $cleaned = $body;

        foreach (self::PATTERNS as $kind => $pattern) {
            $cleaned = preg_replace_callback(
                $pattern,
                function (array $match) use ($kind, &$redactions) {
                    $redactions[] = [
                        'kind' => $kind,
                        'original' => $match[0],
                        'replacement' => '['.$kind.' redacted]',
                    ];

                    return '['.$kind.' redacted]';
                },
                $cleaned,
            ) ?? $cleaned;
        }

        return [
            'body' => $cleaned,
            'redactions' => $redactions,
        ];
    }
}
