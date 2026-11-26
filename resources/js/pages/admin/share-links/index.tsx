import { Head, useForm } from '@inertiajs/react';
import { Check, Copy, ExternalLink, Link2, Plus } from 'lucide-react';
import { useState } from 'react';
import InputError from '@/components/input-error';
import { EmptyState, LastSeen } from '@/components/orion/misc';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useClipboard } from '@/hooks/use-clipboard';
import { cn } from '@/lib/utils';
import adminShareLinks from '@/routes/admin/share-links';

type ShareLink = {
    id: number;
    name: string;
    url: string;
    expires_at: string | null;
    is_expired: boolean;
    last_accessed_at: string | null;
    created_by: string | null;
    created_at: string;
};

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

function CreateLinkDialog() {
    const [open, setOpen] = useState(false);
    const { data, setData, post, processing, errors, reset } = useForm({
        name: '',
        expires_at: '',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post(adminShareLinks.store.url(), {
            preserveScroll: true,
            onSuccess: () => {
                setOpen(false);
                reset();
            },
        });
    };

    return (
        <>
            <Button onClick={() => setOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                New link
            </Button>

            <Dialog
                open={open}
                onOpenChange={(v) => {
                    setOpen(v);

                    if (!v) {
                        reset();
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>New live map link</DialogTitle>
                        <DialogDescription>
                            Anyone with the link can watch unit positions,
                            trails, speed and status — no login needed.
                        </DialogDescription>
                    </DialogHeader>

                    <form
                        id="create-share-link-form"
                        onSubmit={handleSubmit}
                        className="space-y-4"
                    >
                        <div className="grid gap-2">
                            <Label htmlFor="share_link_name">Name</Label>
                            <Input
                                id="share_link_name"
                                value={data.name}
                                onChange={(e) =>
                                    setData('name', e.target.value)
                                }
                                placeholder="e.g. TV Control Room"
                                autoComplete="off"
                            />
                            <InputError message={errors.name} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="share_link_expires_at">
                                Expires{' '}
                                <span className="font-normal text-muted-foreground">
                                    (optional)
                                </span>
                            </Label>
                            <Input
                                id="share_link_expires_at"
                                type="date"
                                value={data.expires_at}
                                onChange={(e) =>
                                    setData('expires_at', e.target.value)
                                }
                            />
                            <InputError message={errors.expires_at} />
                        </div>
                    </form>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            form="create-share-link-form"
                            disabled={processing}
                        >
                            Create link
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

function RevokeLinkDialog({ link }: { link: ShareLink }) {
    const [open, setOpen] = useState(false);
    const { delete: destroy, processing } = useForm({});

    return (
        <>
            <Button
                variant="outline"
                size="sm"
                className="min-h-11 border-danger/40 text-danger hover:bg-danger-bg hover:text-danger md:min-h-8"
                onClick={() => setOpen(true)}
                aria-label={`Revoke ${link.name}`}
            >
                Revoke
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Revoke link</DialogTitle>
                        <DialogDescription>
                            Revoke <strong>{link.name}</strong>? Screens using
                            this link stop updating immediately.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            disabled={processing}
                            onClick={() =>
                                destroy(adminShareLinks.destroy.url(link.id), {
                                    preserveScroll: true,
                                    onSuccess: () => setOpen(false),
                                })
                            }
                        >
                            Revoke
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

function LinkStatus({ link }: { link: ShareLink }) {
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap',
                link.is_expired
                    ? 'bg-offline-bg text-offline'
                    : 'bg-online-bg text-online',
            )}
        >
            <span
                className={cn(
                    'size-1.5 rounded-full',
                    link.is_expired ? 'bg-offline' : 'bg-online',
                )}
            />
            {link.is_expired ? 'Expired' : 'Active'}
        </span>
    );
}

export default function ShareLinksIndex({ links }: { links: ShareLink[] }) {
    const [copiedText, copy] = useClipboard();

    return (
        <>
            <Head title="Live Map Links" />

            <div className="flex flex-col gap-5 p-4 md:p-7">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight md:text-[28px]">
                        Live Map Links
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Share a read-only, real-time map of every unit — for
                        control-room screens or people without an ORION account.
                    </p>
                </div>

                <section className="max-w-5xl overflow-hidden rounded-xl border bg-card">
                    <header className="flex items-center justify-between gap-4 px-4 py-4 md:px-6">
                        <h2 className="text-lg font-semibold">Links</h2>
                        <CreateLinkDialog />
                    </header>

                    {links.length === 0 ? (
                        <EmptyState
                            icon={<Link2 className="size-6" />}
                            title="No live map links yet"
                            className="border-t"
                        >
                            Create a link, then open it on a TV or send it to
                            the engineering team.
                        </EmptyState>
                    ) : (
                        <ul className="divide-y border-t">
                            {links.map((link) => {
                                const copied = copiedText === link.url;

                                return (
                                    <li
                                        key={link.id}
                                        className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:px-6"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="truncate font-medium">
                                                    {link.name}
                                                </span>
                                                <LinkStatus link={link} />
                                            </div>
                                            <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                                                {link.url}
                                            </p>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                Opened{' '}
                                                {link.last_accessed_at ? (
                                                    <LastSeen
                                                        at={
                                                            link.last_accessed_at
                                                        }
                                                        staleAfterSec={
                                                            Number.MAX_SAFE_INTEGER
                                                        }
                                                    />
                                                ) : (
                                                    'never'
                                                )}
                                                {' · '}
                                                {link.expires_at
                                                    ? `expires ${formatDate(link.expires_at)}`
                                                    : 'no expiry'}
                                                {' · '}created{' '}
                                                {formatDate(link.created_at)}
                                                {link.created_by &&
                                                    ` by ${link.created_by}`}
                                            </p>
                                        </div>

                                        <div className="flex shrink-0 items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="min-h-11 md:min-h-8"
                                                onClick={() => copy(link.url)}
                                                aria-label={`Copy link ${link.name}`}
                                            >
                                                {copied ? <Check /> : <Copy />}
                                                {copied ? 'Copied' : 'Copy'}
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="min-h-11 md:min-h-8"
                                                asChild
                                            >
                                                <a
                                                    href={link.url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    aria-label={`Open ${link.name} in a new tab`}
                                                >
                                                    <ExternalLink /> Open
                                                </a>
                                            </Button>
                                            <RevokeLinkDialog link={link} />
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </section>
            </div>
        </>
    );
}

ShareLinksIndex.layout = {
    breadcrumbs: [
        {
            title: 'Live Map Links',
            href: adminShareLinks.index(),
        },
    ],
};
