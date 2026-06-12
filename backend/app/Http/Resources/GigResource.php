<?php

namespace App\Http\Resources;

use App\Models\Gig;
use App\Models\Review;
use App\Models\User;
use App\Models\VerificationRecord;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

/**
 * @mixin Gig
 */
class GigResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'status' => $this->status,
            'description' => $this->description,
            'tasks_included' => $this->tasks_included ?? [],
            'hourly_rate_cents' => (int) $this->hourly_rate_cents,
            'hourly_rate_dollars' => round($this->hourly_rate_cents / 100, 2),
            'photo_url' => $this->resolvePhotoUrl($this->photo_path),
            'published_at' => $this->published_at?->toIso8601String(),
            'service_category' => $this->whenLoaded(
                'serviceCategory',
                fn () => new ServiceCategoryResource($this->serviceCategory),
            ),
            'caregiver' => $this->whenLoaded(
                'caregiverProfile',
                fn () => $this->shapeCaregiver(),
            ),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
            // Match score 0-100 from MatchingEngine::gigsForRecipient.
            // Only present when the request specified a `recipient_id`;
            // null otherwise.
            'match_score' => $this->resource->match_score ?? null,
        ];
    }

    /**
     * Photo paths can be either a relative key under the public disk
     * (uploaded files) or a fully-qualified URL (seeded placeholder
     * images). Disk URL resolution would prefix the latter with
     * `/storage/` and break it, so check the protocol first.
     */
    private function resolvePhotoUrl(?string $path): ?string
    {
        if (! $path) {
            return null;
        }
        if (str_starts_with($path, 'http://') || str_starts_with($path, 'https://')) {
            return $path;
        }

        return Storage::disk('public')->url($path);
    }

    /**
     * Caregiver summary that the family marketplace card needs — name,
     * photo, headline-y signals. Full profile lives at /caregivers/{id}.
     *
     * @return array<string, mixed>
     */
    private function shapeCaregiver(): array
    {
        $profile = $this->caregiverProfile;
        $user = $profile->user;

        // Marketplace + gig detail BOTH render this card, so eager-loading
        // verificationRecords once here is cheaper than a per-card query.
        $user->loadMissing('verificationRecords');

        return [
            'user_id' => $user->id,
            'profile_id' => $profile->id,
            'display_name' => $user->name,
            'photo_url' => $this->resolvePhotoUrl($profile->photo_path),
            'years_of_experience' => $profile->years_of_experience,
            'languages' => $profile->languages ?? [],
            // The booking page uses this to soft-warn when the family's
            // requested window falls outside the caregiver's published hours.
            // The matcher reads the same shape (`weekly.{day}` = array of
            // {start, end}); empty/null means "always available".
            'availability' => $profile->availability ?? null,
            // Trust signals so marketplace + gig detail can render without a
            // round trip to /caregivers/{id}. Verification checks return only
            // the public-safe slice (type/status/date) — operational metadata
            // stays admin-only.
            'is_verified' => $user->isFullyVerified(),
            'verification_checks' => $this->publicSafeVerificationChecks($user),
            'rating' => $this->ratingFor($user),
        ];
    }

    /**
     * Public verification slice — what was checked, its current status, and
     * when it was reviewed. No provider names, admin notes, or rejection
     * reasons.
     *
     * @return array<int, array{check_type: string, status: string, reviewed_at: string|null}>
     */
    private function publicSafeVerificationChecks(User $user): array
    {
        return $user->verificationRecords
            ->whereIn('check_type', VerificationRecord::ALL_CHECK_TYPES)
            ->map(fn (VerificationRecord $r) => [
                'check_type' => $r->check_type,
                'status' => $r->status,
                'reviewed_at' => Carbon::make($r->reviewed_at)?->toIso8601String(),
            ])
            ->values()
            ->all();
    }

    /**
     * @return array{average: float|null, count: int}
     */
    private function ratingFor(User $user): array
    {
        $reviews = Review::query()
            ->forRatee($user->id)
            ->visible()
            ->get(['stars']);

        return [
            'average' => $reviews->isEmpty() ? null : round((float) $reviews->avg('stars'), 1),
            'count' => $reviews->count(),
        ];
    }
}
