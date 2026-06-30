<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('api_tokens', function (Blueprint $table) {
            // Store first 8 chars of plaintext for display; hash stored in 'token'
            $table->string('token_prefix', 8)->after('name')->nullable();
            // Widen column to accommodate SHA-256 hash (64 hex chars)
            $table->string('token', 64)->change();
        });
    }

    public function down(): void
    {
        Schema::table('api_tokens', function (Blueprint $table) {
            $table->dropColumn('token_prefix');
        });
    }
};
