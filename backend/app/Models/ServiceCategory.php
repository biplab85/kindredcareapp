<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ServiceCategory extends Model
{
    protected $fillable = [
        'name',
        'slug',
        'description',
        'icon',
        'tier_required',
        'default_tasks',
        'example_tasks',
        'is_active',
        'sort_order',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'default_tasks' => 'array',
            'example_tasks' => 'array',
            'is_active' => 'boolean',
        ];
    }
}
