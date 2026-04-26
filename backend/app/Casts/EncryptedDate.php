<?php

namespace App\Casts;

use Carbon\CarbonImmutable;
use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Crypt;

/**
 * Phase 15.B — encrypted-at-rest cast for date columns.
 *
 * Laravel's built-in `encrypted` casts only cover string/array/object —
 * dates need an explicit cast that round-trips through Crypt and re-parses
 * to a Carbon instance on read. Stored shape is the same encrypted blob
 * format Laravel uses for `encrypted` strings, so a future migration to
 * the framework's native solution stays straightforward.
 *
 * @implements CastsAttributes<CarbonImmutable|null, mixed>
 */
class EncryptedDate implements CastsAttributes
{
    public function get(Model $model, string $key, mixed $value, array $attributes): ?CarbonImmutable
    {
        if ($value === null) {
            return null;
        }

        return CarbonImmutable::parse(Crypt::decryptString((string) $value));
    }

    public function set(Model $model, string $key, mixed $value, array $attributes): ?string
    {
        if ($value === null) {
            return null;
        }

        $date = $value instanceof \DateTimeInterface
            ? $value->format('Y-m-d')
            : CarbonImmutable::parse((string) $value)->format('Y-m-d');

        return Crypt::encryptString($date);
    }
}
