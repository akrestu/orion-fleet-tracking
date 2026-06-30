<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Change enum to varchar so we can add new categories freely
        Schema::table('devices', function (Blueprint $table) {
            $table->string('unit_type', 50)->default('other')->change();
            $table->string('unit_model', 100)->nullable()->after('unit_type');
        });

        // Migrate old 'hauler' → 'oht'
        DB::table('devices')->where('unit_type', 'hauler')->update(['unit_type' => 'oht']);
    }

    public function down(): void
    {
        Schema::table('devices', function (Blueprint $table) {
            $table->dropColumn('unit_model');
        });

        DB::table('devices')->where('unit_type', 'oht')->update(['unit_type' => 'hauler']);

        Schema::table('devices', function (Blueprint $table) {
            $table->enum('unit_type', ['hauler', 'dozer', 'excavator', 'grader', 'other'])
                ->default('hauler')
                ->change();
        });
    }
};
