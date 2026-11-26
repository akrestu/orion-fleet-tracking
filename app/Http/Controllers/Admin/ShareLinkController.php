<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreShareLinkRequest;
use App\Models\ShareLink;
use App\Support\AuditLogger;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class ShareLinkController extends Controller
{
    public function index(): Response
    {
        $links = ShareLink::with('creator:id,name')
            ->latest()
            ->get()
            ->map(fn (ShareLink $link) => [
                'id' => $link->id,
                'name' => $link->name,
                'url' => route('live.show', $link->token),
                'expires_at' => $link->expires_at?->toIso8601String(),
                'is_expired' => $link->isExpired(),
                'last_accessed_at' => $link->last_accessed_at?->toIso8601String(),
                'created_by' => $link->creator?->name,
                'created_at' => $link->created_at?->toIso8601String(),
            ]);

        return Inertia::render('admin/share-links/index', [
            'links' => $links,
        ]);
    }

    public function store(StoreShareLinkRequest $request): RedirectResponse
    {
        $token = ShareLink::generateToken();

        $link = ShareLink::create([
            'name' => $request->validated('name'),
            'token' => $token,
            'token_hash' => ShareLink::hashToken($token),
            'expires_at' => $request->validated('expires_at'),
            'created_by' => $request->user()?->id,
        ]);

        AuditLogger::log('share_link_created', "Live map link \"{$link->name}\" created", null, [], $request);

        return back()->with('success', 'Link created.');
    }

    public function destroy(ShareLink $shareLink): RedirectResponse
    {
        AuditLogger::log('share_link_revoked', "Live map link \"{$shareLink->name}\" revoked");

        $shareLink->delete();

        return back()->with('success', 'Link revoked.');
    }
}
