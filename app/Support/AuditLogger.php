<?php

namespace App\Support;

use App\Models\AuditLog;
use Illuminate\Http\Request;

class AuditLogger
{
    /**
     * @param  array<string, mixed>  $properties
     */
    public static function log(
        string $event,
        string $description,
        ?int $userId = null,
        array $properties = [],
        ?Request $request = null
    ): void {
        $request ??= app(Request::class);

        AuditLog::create([
            'user_id' => $userId ?? auth()->id(),
            'event' => $event,
            'description' => $description,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'properties' => $properties ?: null,
        ]);
    }
}
