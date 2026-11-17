import { Form, Head, Link, setLayoutProps } from '@inertiajs/react';
import { REGEXP_ONLY_DIGITS } from 'input-otp';
import { ArrowLeft, KeyRound } from 'lucide-react';
import { useState } from 'react';
import InputError from '@/components/input-error';
import { AuthField } from '@/components/orion/auth-field';
import { Button } from '@/components/ui/button';
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSlot,
} from '@/components/ui/input-otp';
import { Spinner } from '@/components/ui/spinner';
import { OTP_MAX_LENGTH } from '@/hooks/use-two-factor-auth';
import { login } from '@/routes';
import { store } from '@/routes/two-factor/login';

export default function TwoFactorChallenge() {
    const [showRecoveryInput, setShowRecoveryInput] = useState(false);
    const [code, setCode] = useState('');

    setLayoutProps(
        showRecoveryInput
            ? {
                  title: 'Kode pemulihan',
                  description:
                      'Masukkan salah satu kode pemulihan darurat Anda.',
              }
            : {
                  title: 'Verifikasi dua langkah',
                  description:
                      'Masukkan 6 digit kode dari aplikasi autentikator Anda.',
              },
    );

    const toggleRecoveryMode = (clearErrors: () => void): void => {
        setShowRecoveryInput(!showRecoveryInput);
        clearErrors();
        setCode('');
    };

    return (
        <>
            <Head title="Verifikasi dua langkah" />

            <Form
                {...store.form()}
                className="flex flex-col gap-5"
                resetOnError
                resetOnSuccess={!showRecoveryInput}
            >
                {({ errors, processing, clearErrors }) => (
                    <>
                        {showRecoveryInput ? (
                            <AuthField
                                id="recovery_code"
                                name="recovery_code"
                                label="Kode pemulihan"
                                icon={KeyRound}
                                autoFocus
                                required
                                autoComplete="one-time-code"
                                spellCheck={false}
                                placeholder="xxxxxxxxxx-xxxxxxxxxx"
                                error={errors.recovery_code}
                            />
                        ) : (
                            <div className="flex flex-col gap-2">
                                <InputOTP
                                    name="code"
                                    maxLength={OTP_MAX_LENGTH}
                                    value={code}
                                    onChange={(value) => setCode(value)}
                                    disabled={processing}
                                    pattern={REGEXP_ONLY_DIGITS}
                                    autoFocus
                                    aria-label="Kode autentikasi 6 digit"
                                >
                                    <InputOTPGroup className="w-full justify-between gap-2">
                                        {Array.from(
                                            { length: OTP_MAX_LENGTH },
                                            (_, index) => (
                                                <InputOTPSlot
                                                    key={index}
                                                    index={index}
                                                    className="h-[60px] w-[52px] rounded-xl border-0 bg-muted text-xl font-semibold tabular-nums shadow-none first:rounded-xl first:border-0 last:rounded-xl"
                                                />
                                            ),
                                        )}
                                    </InputOTPGroup>
                                </InputOTP>
                                <InputError message={errors.code} />
                            </div>
                        )}

                        <Button
                            type="submit"
                            disabled={processing}
                            className="h-14 rounded-full bg-foreground text-base font-semibold text-background hover:bg-foreground/90"
                        >
                            {processing && <Spinner />}
                            Verifikasi
                        </Button>

                        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                            <Link
                                href={login()}
                                className="inline-flex min-h-11 items-center gap-1.5 text-muted-foreground hover:text-foreground"
                            >
                                <ArrowLeft className="size-4" />
                                Kembali
                            </Link>
                            <button
                                type="button"
                                className="min-h-11 font-medium underline-offset-4 hover:underline"
                                onClick={() => toggleRecoveryMode(clearErrors)}
                            >
                                {showRecoveryInput
                                    ? 'Gunakan kode autentikator'
                                    : 'Gunakan kode pemulihan'}
                            </button>
                        </div>
                    </>
                )}
            </Form>
        </>
    );
}
