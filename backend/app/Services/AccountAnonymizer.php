<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\CareRecipient;
use App\Models\Message;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * PIPEDA right-to-deletion + CRA 7-year tax retention.
 *
 * The platform CANNOT hard-delete user rows because Booking carries
 * financial records that must survive for 7 years (CRA T4A reporting).
 * Instead we *anonymize*: clear personal fields, retain the row, mark
 * status=deleted so logins are blocked.
 *
 * Anonymization is deliberately destructive — name/email/phone/dob are
 * replaced with stable placeholders so future joins still work but no
 * personal data remains on disk.
 */
class AccountAnonymizer
{
    public function anonymize(User $user): void
    {
        DB::transaction(function () use ($user) {
            // 1. Revoke all tokens — leaked tokens shouldn't survive deletion.
            $user->tokens()->delete();

            // 2. Care recipients have no tax basis; safe to hard-delete.
            //    Family-profile-owned data that isn't load-bearing for
            //    booking/payment history goes here.
            if ($user->familyProfile !== null) {
                CareRecipient::where('family_profile_id', $user->familyProfile->id)->delete();
            }

            // 3. Anonymize message bodies authored by this user. We keep
            //    the row (it's part of the booking thread audit trail)
            //    but the body becomes a placeholder so personal narrative
            //    doesn't survive. Loop through model instances so the
            //    `encrypted` cast applies to the placeholder — `update()`
            //    on the query builder skips casts.
            Message::query()
                ->where('sender_user_id', $user->id)
                ->each(function (Message $message): void {
                    $message->body = '[Message removed at user request.]';
                    $message->redactions = null;
                    $message->save();
                });

            // 4. Caregiver/family profile: clear narrative fields.
            if ($user->caregiverProfile !== null) {
                $user->caregiverProfile->update([
                    'bio' => null,
                    'photo_path' => null,
                    'languages' => null,
                    'personality_tags' => null,
                    'interests' => null,
                    'emergency_contact_name' => null,
                    'emergency_contact_phone' => null,
                ]);
                // Certs and their uploaded documents are PII — drop the
                // rows and their private-disk files entirely.
                foreach ($user->caregiverProfile->certifications as $cert) {
                    if ($cert->document_path) {
                        Storage::disk('private')->delete($cert->document_path);
                    }
                    $cert->delete();
                }
            }

            // 5. The user row itself. Replace identifiers with stable
            //    placeholders so foreign keys still resolve. Email gets
            //    a unique suffix so we can re-register the address later
            //    without uniqueness collision.
            $anonId = (string) Str::random(10);
            $user->update([
                'name' => '[deleted user]',
                'email' => "deleted-{$anonId}@kindred.deleted",
                'phone' => null,
                'phone_verified_at' => null,
                'date_of_birth' => null,
                'gender' => null,
                'status' => 'deleted',
                'two_factor_secret' => null,
                'two_factor_recovery_codes' => null,
                'two_factor_confirmed_at' => null,
            ]);

            // 6. Bookings: name fields ride on User joins, so anonymizing
            //    the User row covers them automatically. Subtotal/payout
            //    cents stay intact for CRA reporting.
            //
            //    Reviews stay attributed to the anonymized user — the
            //    rendering layer shows "[deleted user]" via the join.
            //
            //    No further action needed; the join chain anonymizes
            //    transitively.
            unset($user); // sentinel: nothing else to mutate at this point
        });
    }

    /**
     * Whether the user has any retention-locked data that prevents
     * full purge. For now, every user with any Booking row is locked
     * because CRA requires 7 years.
     */
    public function hasRetentionLocked(User $user): bool
    {
        $caregiverBookings = Booking::query()
            ->where('caregiver_user_id', $user->id)
            ->exists();

        $familyBookings = $user->familyProfile !== null
            && Booking::query()
                ->where('family_profile_id', $user->familyProfile->id)
                ->exists();

        return $caregiverBookings || $familyBookings;
    }
}
