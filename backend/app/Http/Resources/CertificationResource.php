<?php

namespace App\Http\Resources;

use App\Models\Certification;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Certification
 *
 * Public-side rendering of a cert. `has_document` instead of the raw path
 * because the private-disk path is meaningless to the client (the actual
 * preview goes through a signed admin route — caregivers don't get to
 * see their own doc back through this resource).
 */
class CertificationResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'issuer' => $this->issuer,
            'year' => $this->year,
            'status' => $this->status,
            'has_document' => $this->document_path !== null,
            'expires_at' => $this->expires_at?->toDateString(),
            'rejection_reason' => $this->rejection_reason,
            'reviewed_at' => $this->reviewed_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
