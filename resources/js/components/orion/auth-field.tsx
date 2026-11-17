import type { LucideIcon } from 'lucide-react';
import type { ComponentProps } from 'react';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/** Filled auth input (login, 2FA): no border, muted fill, 50/52 px tall, leading icon. */
const FILLED =
    'h-[50px] rounded-2xl border-0 bg-muted text-[15px] shadow-none md:h-[52px] md:text-[15px] focus-visible:ring-2 focus-visible:ring-ring';

type AuthFieldProps = Omit<ComponentProps<'input'>, 'id'> & {
    id: string;
    label: string;
    icon?: LucideIcon;
    error?: string;
};

export function AuthField({
    id,
    label,
    icon: Icon,
    error,
    type,
    className,
    ...props
}: AuthFieldProps) {
    const inputClassName = cn(FILLED, Icon && 'pl-12', className);

    return (
        <div className="grid gap-2">
            <Label htmlFor={id} className="text-sm font-medium">
                {label}
            </Label>
            <div className="relative">
                {Icon && (
                    <Icon
                        aria-hidden
                        strokeWidth={1.6}
                        className="pointer-events-none absolute top-1/2 left-4 z-10 size-[18px] -translate-y-1/2 text-muted-foreground"
                    />
                )}
                {type === 'password' ? (
                    <PasswordInput
                        id={id}
                        aria-invalid={error ? true : undefined}
                        className={cn(inputClassName, 'pr-12')}
                        {...props}
                    />
                ) : (
                    <Input
                        id={id}
                        type={type}
                        aria-invalid={error ? true : undefined}
                        className={inputClassName}
                        {...props}
                    />
                )}
            </div>
            <InputError message={error} />
        </div>
    );
}
