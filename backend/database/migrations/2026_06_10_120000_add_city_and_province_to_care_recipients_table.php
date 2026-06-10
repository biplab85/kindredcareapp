<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('care_recipients', function (Blueprint $table) {
            $table->string('city', 100)->nullable()->after('street_address');
            // 2-char ISO province code (ON, QC, BC…). Defaults to ON since the
            // MVP targets Durham Region, Ontario — keeps the form 1-click for
            // most users without forcing a hard non-null at the DB level.
            $table->string('province', 2)->nullable()->after('city');
        });
    }

    public function down(): void
    {
        Schema::table('care_recipients', function (Blueprint $table) {
            $table->dropColumn(['city', 'province']);
        });
    }
};
