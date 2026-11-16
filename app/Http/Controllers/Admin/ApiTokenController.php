<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\CreateApiTokenRequest;
use App\Models\ApiToken;
use App\Support\AuditLogger;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Str;

class ApiTokenController extends Controller
{
    /**
     * API tokens are managed on the system settings page.
     */
    public function index(): RedirectResponse
    {
        return to_route('admin.system-settings.index');
    }

    public function store(CreateApiTokenRequest $request): RedirectResponse
    {
        $plaintext = Str::random(64);

        $token = ApiToken::create([
            'name' => $request->validated('name'),
            'token' => hash('sha256', $plaintext),
            'token_prefix' => substr($plaintext, 0, 8),
            'abilities' => $request->validated('abilities') ?: ['fleet.read'],
            'device_group_ids' => $request->validated('device_group_ids') ?: null,
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
