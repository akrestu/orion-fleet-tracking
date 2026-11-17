<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Add the login identifier (Unique ID) and give every existing user a
     * generated one (ORN-0001, ORN-0002, … in id order) so nobody is locked out.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('unique_id', 32)->nullable()->after('name');
        });

        $sequence = 0;

        DB::table('users')->orderBy('id')->select('id')->chunkById(500, function ($users) use (&$sequence) {
            foreach ($users as $user) {
                $sequence++;

                DB::table('users')
                    ->where('id', $user->id)
                    ->update(['unique_id' => sprintf('ORN-%04d', $sequence)]);
            }
        });

        Schema::table('users', function (Blueprint $table) {
            $table->string('unique_id', 32)->nullable(false)->change();
            $table->unique('unique_id');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['unique_id']);
            $table->dropColumn('unique_id');
        });
    }
};
