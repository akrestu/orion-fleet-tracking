<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\CreateApiTokenRequest;
use App\Models\ApiToken;
use App\Support\AuditLogger;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class ApiTokenController extends Controller
{
    public function index(): Response
    {
        $tokens = ApiToken::with('creator:id,name')
            ->orderByDesc('created_at')
            ->get(['id', 'name', 'token_prefix', 'abilities', 'last_used_at', 'expires_at', 'created_by', 'created_at']);

        return Inertia::render('admin/system-settings/index', [
            'apiTokens' => $tokens->map(fn (ApiToken $t) => [
                'id' => $t->id,
                'name' => $t->name,
                'token_preview' => ($t->token_prefix ?? '????????').'...',
                'abilities' => $t->abilities ?? [],
                'last_used_at' => $t->last_used_at?->diffForHumans(),
                'expires_at' => $t->expires_at?->toDateString(),
                'created_by' => $t->creator?->name,
                'created_at' => $t->created_at->diffForHumans(),
            ]),
        ]);
    }

    public function store(CreateApiTokenRequest $request): RedirectResponse
    {
        $plaintext = Str::random(64);

        $token = ApiToken::create([
            'name' => $request->validated('name'),
            'token' => hash('sha256', $plaintext),
            'token_prefix' => substr($plaintext, 0, 8),
            'abilities' => $request->validated('abilities', []),
            'expires_at' => $request->validated('expires_at'),
            'created_by' => auth()->id(),
        ]);

        AuditLogger::log('api_token_created', "API token \"{$token->name}\" created", null, [], $request);

        return back()->with('new_token', $plaintext);
    }

    public function destroy(ApiToken $apiToken): RedirectResponse
    {
        AuditLogger::log('api_token_deleted', "API token \"{$apiToken->name}\" deleted");

        $apiToken->delete();

        return back()->with('success', 'Token revoked.');
    }
}
