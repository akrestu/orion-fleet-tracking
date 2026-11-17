import { Form, Head } from '@inertiajs/react';
import { CheckCircle2, IdCard, Lock } from 'lucide-react';
import { AuthField } from '@/components/orion/auth-field';
import PasskeyVerify from '@/components/passkey-verify';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { store } from '@/routes/login';
import { request } from '@/routes/password';

type Props = {
    status?: string;
    canResetPassword: boolean;
};

export default function Login({ status, canResetPassword }: Props) {
    return (
        <>
            <Head title="Masuk" />

            {status && (
                <div
                    role="status"
                    className="mb-5 flex items-center gap-2 rounded-xl bg-online-bg px-4 py-3 text-sm text-online"
                >
                    <CheckCircle2 className="size-4 shrink-0" />
                    {status}
                </div>
            )}

            <Form
                {...store.form()}
                resetOnSuccess={['password']}
                className="flex flex-col gap-5"
            >
                {({ processing, errors }) => (
                    <>
                        <AuthField
                            id="unique_id"
                            name="unique_id"
                            label="Unique ID"
                            icon={IdCard}
                            required
                            autoFocus
                            autoComplete="username"
                            autoCapitalize="characters"
                            spellCheck={false}
                            placeholder="mis. WBK-0457"
                            error={errors.unique_id}
                        />

                        <AuthField
                            id="password"
                            name="password"
                            type="password"
                            label="Kata sandi"
                            icon={Lock}
                            required
                            autoComplete="current-password"
                            placeholder="Kata sandi"
                            error={errors.password}
                        />

                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                                <Checkbox
                                    id="remember"
                                    name="remember"
                                    className="size-5"
                                />
                                <Label
                                    htmlFor="remember"
                                    className="font-normal"
                                >
                                    Ingat perangkat ini
                                </Label>
                            </div>
                            {canResetPassword && (
                                <TextLink
                                    href={request()}
                                    className="text-sm font-medium"
                                >
                                    Lupa kata sandi?
                                </TextLink>
                            )}
                        </div>

                        <Button
                            type="submit"
                            disabled={processing}
                            className="h-14 rounded-full bg-foreground text-base font-semibold text-background hover:bg-foreground/90"
                        >
                            {processing && <Spinner />}
                            Masuk
                        </Button>
                    </>
                )}
            </Form>

            <div className="mt-4">
                <PasskeyVerify
                    label="Masuk dengan passkey"
                    loadingLabel="Mengautentikasi…"
                    showSeparator={false}
                    buttonClassName="h-14 rounded-full text-base font-medium"
                />
            </div>

            <p className="mt-6 text-sm text-muted-foreground">
                Belum punya akun atau Unique ID terkunci? Hubungi admin site
                Anda.
            </p>
        </>
    );
}

Login.layout = {
    title: 'Masuk ke ORION',
    description: 'Gunakan Unique ID dan kata sandi Anda.',
};
