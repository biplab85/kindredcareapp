<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('gigs', function (Blueprint $table) {
            $table->enum('posting_mode', ['matched', 'open'])
                ->default('matched')
                ->after('status');

            $table->index('posting_mode');
        });
    }

    public function down(): void
    {
        Schema::table('gigs', function (Blueprint $table) {
            $table->dropIndex(['posting_mode']);
            $table->dropColumn('posting_mode');
        });
    }
};
