<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(): void
    {
        $this->call([
            ServiceCategorySeeder::class,
            TestUsersSeeder::class,
            EmilyExtraGigsSeeder::class,
            CertificationSeeder::class,
            SafetySeeder::class,
            AuditLogSeeder::class,
            ReviewSeeder::class,
            RevenueSeeder::class,
            VisitEvidenceSeeder::class,
        ]);
    }
}
