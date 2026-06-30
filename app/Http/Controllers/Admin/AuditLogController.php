<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Inertia\Inertia;
use Inertia\Response;

class AuditLogController extends Controller
{
    public function index(): Response
    {
        $logs = AuditLog::with('user:id,name')
            ->orderByDesc('created_at')
            ->paginate(50);

        return Inertia::render('admin/system-settings/index', [
            'auditLogs' => [
                'data' => $logs->map(fn (AuditLog $log) => [
                    'id' => $log->id,
                    'event' => $log->event,
                    'description' => $log->description,
                    'user' => $log->user?->name ?? 'System',
                    'ip_address' => $log->ip_address,
                    'properties' => $log->properties,
                    'created_at' => $log->created_at->format('Y-m-d H:i:s'),
                ]),
                'total' => $logs->total(),
                'current_page' => $logs->currentPage(),
                'last_page' => $logs->lastPage(),
            ],
        ]);
    }
}
