import { useRef, useState } from 'react';
import { Trash2Icon, UploadCloudIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface Tileset {
    id: number;
    name: string;
    slug: string;
    min_zoom: number;
    max_zoom: number;
    tile_url: string;
}

interface Props {
    tilesets: Tileset[];
    onUploaded: (tileset: Tileset) => void;
    onDeleted: (id: number) => void;
}

export function MapTileUpload({ tilesets, onUploaded, onDeleted }: Props) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file || !name.trim()) {
            return;
        }

        setUploading(true);
        setError(null);

        const form = new FormData();
        form.append('name', name.trim());
        form.append('tiles', file);

        try {
            const res = await fetch('/fleet/map/tiles', {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content ?? '',
                },
                body: form,
            });

            if (!res.ok) {
                const data = await res.json();
                setError(data.message ?? 'Upload gagal.');
                return;
            }

            const tileset: Tileset = await res.json();
            onUploaded(tileset);
            setName('');
            setFile(null);
            if (fileRef.current) {
                fileRef.current.value = '';
            }
            setOpen(false);
        } catch {
            setError('Terjadi kesalahan jaringan.');
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (tileset: Tileset) => {
        if (!confirm(`Hapus peta "${tileset.name}"?`)) {
            return;
        }

        await fetch(`/fleet/map/tiles/${tileset.id}`, {
            method: 'DELETE',
            headers: {
                'X-CSRF-TOKEN': (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content ?? '',
            },
        });

        onDeleted(tileset.id);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="secondary" size="sm" title="Kelola peta kustom">
                    <UploadCloudIcon className="h-3.5 w-3.5" />
                    Peta Kustom
                </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Peta Kustom Tim Engineering</DialogTitle>
                    <DialogDescription>
                        Upload file ZIP berisi tile peta dengan struktur{' '}
                        <code className="text-primary">{'{z}/{x}/{y}.png'}</code>.
                    </DialogDescription>
                </DialogHeader>

                {tilesets.length > 0 && (
                    <div className="space-y-1.5">
                        <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Tersimpan</p>
                        {tilesets.map((t) => (
                            <div key={t.id} className="bg-muted flex items-center justify-between rounded-md px-3 py-2">
                                <span className="text-sm">{t.name}</span>
                                <button
                                    onClick={() => handleDelete(t)}
                                    className="text-muted-foreground hover:text-destructive transition-colors"
                                    title="Hapus peta"
                                >
                                    <Trash2Icon className="h-4 w-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="tileset-name">Nama Peta</Label>
                        <Input
                            id="tileset-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Contoh: Site Tambang Q2 2025"
                            required
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="tileset-file">File ZIP Tiles</Label>
                        <Input
                            id="tileset-file"
                            ref={fileRef}
                            type="file"
                            accept=".zip"
                            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                            required
                        />
                        <p className="text-muted-foreground text-xs">
                            Maks. 500 MB. Struktur ZIP:{' '}
                            <code className="text-primary">{'{z}/{x}/{y}.png'}</code>
                        </p>
                    </div>

                    {error && <p className="text-destructive text-xs">{error}</p>}

                    <DialogFooter>
                        <Button type="submit" disabled={uploading || !name.trim() || !file} className="w-full">
                            {uploading ? 'Mengupload...' : 'Upload Peta'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
