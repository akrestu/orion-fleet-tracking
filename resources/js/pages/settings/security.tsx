import { Form, Head } from '@inertiajs/react';
import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import SecurityController from '@/actions/App/Http/Controllers/Settings/SecurityController';
import InputError from '@/components/input-error';
import type { Props as ManagePasskeysProps } from '@/components/manage-passkeys';
import ManagePasskeys from '@/components/manage-passkeys';
import type { Props as ManageTwoFactorProps } from '@/components/manage-two-factor';
import ManageTwoFactor from '@/components/manage-two-factor';
import PasswordInput from '@/components/password-input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { edit } from '@/routes/security';

type Props = {
    passwordRules: string;
} & ManagePasskeysProps &
    ManageTwoFactorProps;

const STRENGTH = [
    { label: 'Too weak', cls: 'bg-danger', text: 'text-danger' },
    { label: 'Weak', cls: 'bg-danger', text: 'text-danger' },
    { label: 'Fair', cls: 'bg-warning', text: 'text-warning' },
    { label: 'Good', cls: 'bg-online', text: 'text-online' },
    { label: 'Strong', cls: 'bg-online', text: 'text-online' },
] as const;

/** 0–4: one point each for length ≥ 12, mixed case, a digit, a symbol (length < 8 caps at 1). */
function passwordScore(value: string): number {
    if (value === '') {
        return 0;
    }

    const points = [
        value.length >= 12,
        /[a-z]/.test(value) && /[A-Z]/.test(value),
        /\d/.test(value),
        /[^A-Za-z0-9]/.test(value),
    ].filter(Boolean).length;

    return value.length < 8 ? Math.min(points, 1) : points;
}

function StrengthMeter({ value }: { value: string }) {
    if (value === '') {
        return null;
    }

    const score = passwordScore(value);
    const level = STRENGTH[score];

    return (
        <div aria-live="polite">
            <div className="mt-1 grid grid-cols-4 gap-1.5" aria-hidden>
                {[1, 2, 3, 4].map((step) => (
                    <span
                        key={step}
                        className={cn(
                            'h-1 rounded-full',
                            step <= score ? level.cls : 'bg-muted',
                        )}
                    />
                ))}
            </div>
            <p className={cn('mt-1 text-xs font-medium', level.text)}>
                {level.label}
            </p>
        </div>
    );
}

/** Card shell for the starter-kit 2FA / passkey panels (they render their own heading). */
function Card({ children }: { children: ReactNode }) {
    return (
        <section className="rounded-xl border bg-card px-6 py-5">
            {children}
        </section>
    );
}

export default function Security(props: Props) {
    const passwordInput = useRef<HTMLInputElement>(null);
    const currentPasswordInput = useRef<HTMLInputElement>(null);
    const [newPassword, setNewPassword] = useState('');

    return (
        <>
            <Head title="Security" />

            <h1 className="sr-only">Security settings</h1>

            <section className="rounded-xl border bg-card">
                <header className="border-b px-6 py-5">
                    <h2 className="text-lg font-semibold">Password</h2>
                    <p className="text-sm text-muted-foreground">
                        Use a long, unique password — 12+ characters with mixed
                        case, numbers and a symbol.
                    </p>
                </header>

                <Form
                    {...SecurityController.update.form()}
                    options={{ preserveScroll: true }}
                    resetOnError={[
                        'password',
                        'password_confirmation',
                        'current_password',
                    ]}
                    resetOnSuccess
                    onSuccess={() => setNewPassword('')}
                    onError={(errors) => {
                        if (errors.password) {
                            passwordInput.current?.focus();
                        }

                        if (errors.current_password) {
                            currentPasswordInput.current?.focus();
                        }
                    }}
                >
                    {({ errors, processing }) => (
                        <>
                            <div className="grid gap-5 px-6 py-5 sm:grid-cols-2">
                                <div className="grid gap-1.5 sm:col-span-2 sm:max-w-[calc(50%-0.625rem)]">
                                    <Label htmlFor="current_password">
                                        Current password
                                    </Label>
                                    <PasswordInput
                                        id="current_password"
                                        ref={currentPasswordInput}
                                        name="current_password"
                                        autoComplete="current-password"
                                    />
                                    <InputError
                                        message={errors.current_password}
                                    />
                                </div>

                                <div className="grid content-start gap-1.5">
                                    <Label htmlFor="password">
                                        New password
                                    </Label>
                                    <PasswordInput
                                        id="password"
                                        ref={passwordInput}
                                        name="password"
                                        autoComplete="new-password"
                                        passwordrules={props.passwordRules}
                                        onChange={(e) =>
                                            setNewPassword(e.target.value)
                                        }
                                    />
                                    <StrengthMeter value={newPassword} />
                                    <InputError message={errors.password} />
                                </div>

                                <div className="grid content-start gap-1.5">
                                    <Label htmlFor="password_confirmation">
                                        Confirm new password
                                    </Label>
                                    <PasswordInput
                                        id="password_confirmation"
                                        name="password_confirmation"
                                        autoComplete="new-password"
                                        passwordrules={props.passwordRules}
                                    />
                                    <InputError
                                        message={errors.password_confirmation}
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end border-t px-6 py-4">
                                <Button
                                    disabled={processing}
                                    data-test="update-password-button"
                                >
                                    Update password
                                </Button>
                            </div>
                        </>
                    )}
                </Form>
            </section>

            <Card>
                <ManageTwoFactor
                    canManageTwoFactor={props.canManageTwoFactor}
                    requiresConfirmation={props.requiresConfirmation}
                    twoFactorEnabled={props.twoFactorEnabled}
                />
            </Card>

            <Card>
                <ManagePasskeys
                    canManagePasskeys={props.canManagePasskeys}
                    passkeys={props.passkeys}
                />
            </Card>
        </>
    );
}

Security.layout = {
    breadcrumbs: [{ title: 'Security', href: edit() }],
};
