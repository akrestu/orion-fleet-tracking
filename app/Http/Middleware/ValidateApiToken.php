<?php

namespace App\Http\Middleware;

use App\Models\ApiToken;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ValidateApiToken
{
    /**
     * Validate a Bearer API token against the api_tokens table.
     * On success, marks last_used_at and binds the token to the request.
     *
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next, string ...$abilities): Response
    {
        $bearer = $request->bearerToken();

        if (! $bearer) {
            return response()->json(['message' => 'API token required.'], Response::HTTP_UNAUTHORIZED);
        }

        $token = ApiToken::where('token', hash('sha256', $bearer))->first();

        if (! $token) {
            return response()->json(['message' => 'Invalid API token.'], Response::HTTP_UNAUTHORIZED);
        }

        if ($token->expires_at !== null && $token->expires_at->isPast()) {
            return response()->json(['message' => 'API token has expired.'], Response::HTTP_UNAUTHORIZED);
        }

        if (! empty($abilities)) {
            foreach ($abilities as $ability) {
                if (! in_array($ability, $token->abilities ?? [], true)) {
                    return response()->json(['message' => 'Token does not have required ability.'], Response::HTTP_FORBIDDEN);
                }
            }
        }

        $token->updateQuietly(['last_used_at' => now()]);

        $request->attributes->set('api_token', $token);

        return $next($request);
    }
}
