<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('care_recipients', function (Blueprint $table) {
            $table->string('street_address')->nullable()->after('name');
        });
    }

    public function down(): void
    {
        Schema::table('care_recipients', function (Blueprint $table) {
            $table->dropColumn('street_address');
        });
    }
};
