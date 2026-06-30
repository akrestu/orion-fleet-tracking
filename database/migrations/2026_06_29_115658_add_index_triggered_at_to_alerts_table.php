<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('alerts', function (Blueprint $table) {
            $table->index('triggered_at');
            $table->index(['dev_eui', 'triggered_at']);
            $table->index(['alert_type', 'triggered_at']);
        });
    }

    public function down(): void
    {
        Schema::table('alerts', function (Blueprint $table) {
            $table->dropIndex(['triggered_at']);
            $table->dropIndex(['dev_eui', 'triggered_at']);
            $table->dropIndex(['alert_type', 'triggered_at']);
        });
    }
};
