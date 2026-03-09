import React, { useEffect, useState, useRef, useMemo } from 'react';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Plus, Upload, Users, Trash2, Search, Filter, Pencil,
    MoreVertical, CheckSquare, Square, X, Download,
    ChevronLeft, ChevronRight, UserPlus, FolderPlus, FolderMinus,
    ArrowRight
} from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

interface Recipient {
    id: string;
    phone: string;
    name: string | null;
    languagePreference: string | null;
    createdAt: string;
    orgId: string;
}

interface Group {
    id: string;
    name: string;
    recipientCount?: number;
    createdAt: string;
}

interface Meta {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export function RecipientsPage() {
    // State
    const [recipients, setRecipients] = useState<Recipient[]>([]);
    const [meta, setMeta] = useState<Meta>({ total: 0, page: 1, limit: 50, totalPages: 0 });
    const [groups, setGroups] = useState<Group[]>([]);
    const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [languageFilter, setLanguageFilter] = useState('');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'recipients' | 'import'>('recipients');

    // Modals & Popovers
    const [showAddModal, setShowAddModal] = useState(false);
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [showBulkGroupModal, setShowBulkGroupModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [editingRecipient, setEditingRecipient] = useState<Recipient | null>(null);

    // Refs
    const fileRef = useRef<HTMLInputElement>(null);

    const fetchData = async (page = 1) => {
        setLoading(true);
        try {
            const params: any = { page, limit: 50 };
            if (search) params.search = search;
            if (languageFilter) params.language = languageFilter;
            if (selectedGroup) params.groupId = selectedGroup;

            const [rRes, gRes] = await Promise.all([
                api.get('/recipients', { params }),
                api.get('/recipients/groups/list'),
            ]);

            setRecipients(rRes.data.data);
            setMeta(rRes.data.meta);
            setGroups(gRes.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData(1);
    }, [selectedGroup, languageFilter]);

    // Handle Search with debounce or simple button
    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchData(1);
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === recipients.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(recipients.map(r => r.id));
        }
    };

    const toggleSelectOne = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleBulkDelete = async () => {
        if (!confirm(`Delete ${selectedIds.length} recipients?`)) return;
        try {
            await api.post('/recipients/bulk-delete', { recipientIds: selectedIds });
            setSelectedIds([]);
            fetchData(meta.page);
        } catch (err: any) {
            alert(err.response?.data?.error || 'Bulk delete failed');
        }
    };

    const handleBulkAssign = async (groupId: string) => {
        try {
            await api.post('/recipients/bulk-assign-group', {
                recipientIds: selectedIds,
                groupId
            });
            setSelectedIds([]);
            setShowBulkGroupModal(false);
            fetchData(meta.page);
        } catch (err: any) {
            alert(err.response?.data?.error || 'Bulk assignment failed');
        }
    };

    const handleBulkRemove = async () => {
        if (!selectedGroup) return;
        if (!confirm(`Remove ${selectedIds.length} recipients from this group?`)) return;
        try {
            await api.post('/recipients/bulk-remove-group', {
                recipientIds: selectedIds,
                groupId: selectedGroup
            });
            setSelectedIds([]);
            fetchData(meta.page);
        } catch (err: any) {
            alert(err.response?.data?.error || 'Bulk removal failed');
        }
    };

    const handleDeleteOne = async (id: string) => {
        if (!confirm('Delete this recipient?')) return;
        try {
            await api.delete(`/recipients/${id}`);
            fetchData(meta.page);
        } catch (err: any) {
            alert(err.response?.data?.error || 'Delete failed');
        }
    };

    const handleGroupDelete = async (id: string) => {
        if (!confirm('Delete this group? Recipients will NOT be deleted.')) return;
        try {
            await api.delete(`/recipients/groups/${id}`);
            if (selectedGroup === id) setSelectedGroup(null);
            fetchData(meta.page);
        } catch (err: any) {
            alert(err.response?.data?.error || 'Delete failed');
        }
    };

    return (
        <div className="flex h-[calc(100vh-140px)] -m-4 lg:-m-6 bg-background overflow-hidden relative">
            {/* Sidebar: Groups */}
            <aside className="w-64 border-r bg-card flex flex-col shrink-0">
                <div className="p-4 border-b flex items-center justify-between">
                    <h2 className="font-semibold flex items-center gap-2 text-sm">
                        <Users className="w-4 h-4 text-primary" /> Recipient Groups
                    </h2>
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-colors" onClick={() => setShowGroupModal(true)}>
                        <Plus className="w-4 h-4" />
                    </Button>
                </div>
                <nav className="flex-1 overflow-y-auto p-2 space-y-1">
                    <button
                        onClick={() => setSelectedGroup(null)}
                        className={cn(
                            "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                            selectedGroup === null ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                        )}
                    >
                        <span className="flex items-center gap-2"><Users className="w-4 h-4" /> All Recipients</span>
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-bold", selectedGroup === null ? "bg-white/20 text-white" : "bg-muted text-muted-foreground")}>{meta.total}</span>
                    </button>
                    {groups.map(g => (
                        <button
                            key={g.id}
                            onClick={() => setSelectedGroup(g.id)}
                            className={cn(
                                "group w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                                selectedGroup === g.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                            )}
                        >
                            <span className="truncate flex items-center gap-2">
                                <span className={cn("w-1.5 h-1.5 rounded-full", selectedGroup === g.id ? "bg-primary" : "bg-muted-foreground/30")} />
                                {g.name}
                            </span>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] opacity-60 font-mono">{g.recipientCount ?? 0}</span>
                                <Trash2
                                    className="w-3.5 h-3.5 text-destructive hover:scale-125 transition-transform opacity-0 group-hover:opacity-100"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleGroupDelete(g.id);
                                    }}
                                />
                            </div>
                        </button>
                    ))}
                </nav>
            </aside>

            {/* Main Content: Table */}
            <main className="flex-1 flex flex-col min-w-0 bg-background">
                {/* Toolbar */}
                <div className="p-4 border-b space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <form onSubmit={handleSearch} className="flex-1 max-w-sm relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by name or phone..."
                                className="pl-9 h-9"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </form>
                        <div className="flex items-center gap-2">
                            <select
                                className="h-9 px-3 rounded-md border border-input bg-background text-sm outline-none focus:ring-1 focus:ring-ring"
                                value={languageFilter}
                                onChange={(e) => setLanguageFilter(e.target.value)}
                            >
                                <option value="">All Languages</option>
                                <option value="en">English</option>
                                <option value="yo">Yoruba</option>
                                <option value="ig">Igbo</option>
                                <option value="ha">Hausa</option>
                                <option value="pcm">Pidgin</option>
                            </select>
                            <Button variant="outline" size="sm" onClick={() => setShowImportModal(true)}>
                                <Upload className="w-4 h-4 mr-2" /> Import
                            </Button>
                            <Button size="sm" onClick={() => setShowAddModal(true)}>
                                <Plus className="w-4 h-4 mr-2" /> Add
                            </Button>
                        </div>
                    </div>

                    {/* Bulk Action Bar */}
                    {selectedIds.length > 0 && (
                        <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-lg p-2 animate-in fade-in slide-in-from-top-2">
                            <div className="flex items-center gap-3 ml-2">
                                <span className="text-sm font-medium text-primary">{selectedIds.length} selected</span>
                                <div className="h-4 w-[1px] bg-primary/20" />
                                <Button variant="ghost" size="sm" className="h-8 text-primary hover:text-primary hover:bg-primary/10" onClick={() => setShowBulkGroupModal(true)}>
                                    <FolderPlus className="w-4 h-4 mr-2" /> Assign Group
                                </Button>
                                {selectedGroup && (
                                    <Button variant="ghost" size="sm" className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleBulkRemove}>
                                        <FolderMinus className="w-4 h-4 mr-2" /> Remove from Group
                                    </Button>
                                )}
                                <Button variant="ghost" size="sm" className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleBulkDelete}>
                                    <Trash2 className="w-4 h-4 mr-2" /> Delete
                                </Button>
                            </div>
                            <Button variant="ghost" size="sm" className="h-8" onClick={() => setSelectedIds([])}>
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    )}
                </div>

                {/* Table Area */}
                <div className="flex-1 overflow-auto relative">
                    <table className="w-full text-left border-collapse min-w-[600px]">
                        <thead className="sticky top-0 bg-card z-10 border-b shadow-sm">
                            <tr>
                                <th className="p-4 w-10">
                                    <button onClick={toggleSelectAll}>
                                        {selectedIds.length === recipients.length && recipients.length > 0 ? (
                                            <CheckSquare className="w-4 h-4 text-primary" />
                                        ) : (
                                            <Square className="w-4 h-4 text-muted-foreground" />
                                        )}
                                    </button>
                                </th>
                                <th className="p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recipient</th>
                                <th className="p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Language</th>
                                <th className="p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Added</th>
                                <th className="p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td className="p-4"><div className="w-4 h-4 bg-muted rounded" /></td>
                                        <td className="p-4"><div className="h-4 bg-muted rounded w-32" /></td>
                                        <td className="p-4"><div className="h-4 bg-muted rounded w-16" /></td>
                                        <td className="p-4"><div className="h-4 bg-muted rounded w-24" /></td>
                                        <td className="p-4 text-right"><div className="w-8 h-8 bg-muted rounded inline-block" /></td>
                                    </tr>
                                ))
                            ) : recipients.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-20 text-center text-muted-foreground">
                                        <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                        <p>No recipients found matching your criteria</p>
                                    </td>
                                </tr>
                            ) : (
                                recipients.map((r) => (
                                    <tr key={r.id} className={cn(
                                        "group hover:bg-muted/30 transition-colors",
                                        selectedIds.includes(r.id) && "bg-primary/5"
                                    )}>
                                        <td className="p-4">
                                            <button onClick={() => toggleSelectOne(r.id)}>
                                                {selectedIds.includes(r.id) ? (
                                                    <CheckSquare className="w-4 h-4 text-primary" />
                                                ) : (
                                                    <Square className="w-4 h-4 text-muted-foreground group-hover:text-primary/50" />
                                                )}
                                            </button>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col">
                                                <span className="font-medium">{r.name || 'Untitled Member'}</span>
                                                <span className="text-xs text-muted-foreground font-mono">{r.phone}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            {r.languagePreference ? (
                                                <Badge variant="outline" className="capitalize font-normal">{r.languagePreference}</Badge>
                                            ) : (
                                                <span className="text-xs text-muted-foreground italic">—</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-sm text-muted-foreground">
                                            {formatDate(r.createdAt)}
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => setEditingRecipient(r)}>
                                                    <Pencil className="w-4 h-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteOne(r.id)}>
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="p-4 border-t flex items-center justify-between bg-card shrink-0">
                    <p className="text-sm text-muted-foreground">
                        Showing <b>{(meta.page - 1) * meta.limit + 1}-{Math.min(meta.page * meta.limit, meta.total)}</b> of <b>{meta.total}</b> recipients
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={meta.page <= 1 || loading}
                            onClick={() => fetchData(meta.page - 1)}
                        >
                            <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={meta.page >= meta.totalPages || loading}
                            onClick={() => fetchData(meta.page + 1)}
                        >
                            Next <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                    </div>
                </div>
            </main>

            {/* Float Action Button (Optional duplication for convenience) */}
            <div className="absolute bottom-6 right-6 lg:hidden">
                <Button size="icon" className="h-14 w-14 rounded-full shadow-lg" onClick={() => setShowAddModal(true)}>
                    <Plus className="w-6 h-6" />
                </Button>
            </div>

            {/* Modals Implementation (Simplified placeholders for logic) */}
            {showAddModal && <AddRecipientModal groups={groups} defaultGroupId={selectedGroup} onClose={() => setShowAddModal(false)} onRefresh={() => fetchData(meta.page)} />}
            {showGroupModal && <AddGroupModal onClose={() => setShowGroupModal(false)} onRefresh={() => fetchData(meta.page)} />}
            {showBulkGroupModal && (
                <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-sm">
                        <div className="p-4 border-b flex items-center justify-between font-semibold">
                            Assign to Group
                            <Button variant="ghost" size="icon" onClick={() => setShowBulkGroupModal(false)}><X className="w-4 h-4" /></Button>
                        </div>
                        <div className="p-4 space-y-4">
                            <p className="text-sm text-muted-foreground">Select a group to add {selectedIds.length} selected recipients to.</p>
                            <div className="grid gap-2">
                                {groups.map(g => (
                                    <Button key={g.id} variant="outline" className="justify-start" onClick={() => handleBulkAssign(g.id)}>
                                        <FolderPlus className="w-4 h-4 mr-2" /> {g.name}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </Card>
                </div>
            )}
            {showImportModal && <ImportModal targetGroupId={selectedGroup} onClose={() => setShowImportModal(false)} onRefresh={() => fetchData(1)} />}
            {editingRecipient && (
                <EditRecipientModal
                    recipient={editingRecipient}
                    groups={groups}
                    onClose={() => setEditingRecipient(null)}
                    onRefresh={() => fetchData(meta.page)}
                />
            )}
        </div>
    );
}

// --- Sub-components (Modals) ---

function AddRecipientModal({ groups, defaultGroupId, onClose, onRefresh }: { groups: Group[], defaultGroupId: string | null, onClose: () => void, onRefresh: () => void }) {
    const [form, setForm] = useState<{ phone: string, name: string, languagePreference: string, groupIds: string[] }>({
        phone: '',
        name: '',
        languagePreference: 'en',
        groupIds: defaultGroupId ? [defaultGroupId] : []
    });
    const [submitting, setSubmitting] = useState(false);

    const toggleGroup = (id: string) => {
        setForm(prev => ({
            ...prev,
            groupIds: prev.groupIds.includes(id)
                ? prev.groupIds.filter(gid => gid !== id)
                : [...prev.groupIds, id]
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await api.post('/recipients', form);
            onRefresh();
            onClose();
        } catch (err: any) {
            alert(err.response?.data?.error || 'Failed to add recipient');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
            <Card className="w-full max-w-md shadow-2xl overflow-hidden">
                <div className="p-4 border-b flex items-center justify-between font-bold text-lg">
                    Add New Recipient
                    <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
                </div>
                <form onSubmit={handleSubmit} className="max-h-[85vh] overflow-y-auto">
                    <div className="p-6 space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Phone Number *</label>
                            <Input placeholder="+234..." value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} required />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Full Name (Optional)</label>
                            <Input placeholder="John Doe" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Language Preference</label>
                            <select
                                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                                value={form.languagePreference}
                                onChange={e => setForm({ ...form, languagePreference: e.target.value })}
                            >
                                <option value="en">English</option>
                                <option value="yo">Yoruba</option>
                                <option value="ig">Igbo</option>
                                <option value="ha">Hausa</option>
                                <option value="pcm">Pidgin</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Assign to Groups</label>
                            <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-1 border rounded-md">
                                {groups.map(g => (
                                    <button
                                        key={g.id}
                                        type="button"
                                        onClick={() => toggleGroup(g.id)}
                                        className={cn(
                                            "flex items-center gap-2 px-2 py-1 responsive-text rounded border text-left transition-colors",
                                            form.groupIds.includes(g.id)
                                                ? "bg-primary/10 border-primary text-primary"
                                                : "hover:bg-muted border-transparent"
                                        )}
                                    >
                                        {form.groupIds.includes(g.id) ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3" />}
                                        <span className="truncate">{g.name}</span>
                                    </button>
                                ))}
                                {groups.length === 0 && <p className="col-span-2 text-xs text-muted-foreground p-2">No groups created yet</p>}
                            </div>
                        </div>
                    </div>
                    <div className="p-4 border-t flex justify-end gap-2 bg-muted/20">
                        <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
                        <Button type="submit" disabled={submitting}>
                            {submitting ? 'Adding...' : 'Add Recipient'}
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    );
}

function AddGroupModal({ onClose, onRefresh }: { onClose: () => void, onRefresh: () => void }) {
    const [name, setName] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await api.post('/recipients/groups', { name });
            onRefresh();
            onClose();
        } catch (err: any) {
            alert(err.response?.data?.error || 'Failed to create group');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
            <Card className="w-full max-w-sm">
                <div className="p-4 border-b flex items-center justify-between font-bold">
                    Create New Group
                    <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="p-6 space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Group Name</label>
                            <Input placeholder="e.g., Drivers, VIPs" value={name} onChange={e => setName(e.target.value)} required />
                        </div>
                    </div>
                    <div className="p-4 border-t flex justify-end gap-2">
                        <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
                        <Button type="submit" disabled={submitting}>Create</Button>
                    </div>
                </form>
            </Card>
        </div>
    );
}

function ImportModal({ targetGroupId, onClose, onRefresh }: { targetGroupId: string | null, onClose: () => void, onRefresh: () => void }) {
    const [mode, setMode] = useState<'upload' | 'paste'>('upload');
    const [step, setStep] = useState<'input' | 'preview'>('input');
    const [csvData, setCsvData] = useState<any[]>([]);
    const [pasteValue, setPasteValue] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const validatePhone = (phone: string) => {
        return /^\+?[1-9]\d{1,14}$/.test(phone.replace(/\s+/g, ''));
    };

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const ext = file.name.split('.').pop()?.toLowerCase();
        if (ext === 'xlsx' || ext === 'xls') {
            const reader = new FileReader();
            reader.onload = (evt) => {
                const bstr = evt.target?.result;
                const workbook = XLSX.read(bstr, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const data = XLSX.utils.sheet_to_json(sheet);

                const normalized = data.map((row: any) => ({
                    phone: String(row.phone || row.Phone || row.phone_number || '').trim(),
                    name: row.name || row.Name || row.full_name || '',
                    language: row.language || row.Language || row.language_preference || 'en',
                    isValid: validatePhone(String(row.phone || row.Phone || row.phone_number || '').trim())
                }));
                setCsvData(normalized);
                setStep('preview');
            };
            reader.readAsBinaryString(file);
        } else {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    const validated = results.data.map((row: any) => ({
                        ...row,
                        phone: row.phone || row.Phone || row.phone_number || '',
                        name: row.name || row.Name || row.full_name || '',
                        language: row.language || row.Language || row.language_preference || 'en',
                        isValid: validatePhone(row.phone || row.Phone || row.phone_number || '')
                    }));
                    setCsvData(validated);
                    setStep('preview');
                }
            });
        }
    };

    const handlePasteSubmit = () => {
        const lines = pasteValue.split(/[\n,;]+/).map(l => l.trim()).filter(Boolean);
        const data = lines.map(line => ({
            phone: line,
            name: '',
            language: 'en',
            isValid: validatePhone(line)
        }));
        setCsvData(data);
        setStep('preview');
    };

    const handleImport = async () => {
        setSubmitting(true);
        try {
            if (mode === 'upload') {
                const formData = new FormData();
                const file = fileRef.current?.files?.[0];
                if (file) {
                    formData.append('file', file);
                    if (targetGroupId) formData.append('groupId', targetGroupId);
                    await api.post('/recipients/bulk', formData, {
                        headers: { 'Content-Type': 'multipart/form-data' },
                    });
                }
            } else {
                const validRecipients = csvData
                    .filter(r => r.isValid)
                    .map(r => ({
                        phone: r.phone,
                        name: r.name || null,
                        languagePreference: r.language || 'en'
                    }));
                await api.post('/recipients/bulk-json', {
                    recipients: validRecipients,
                    groupId: targetGroupId
                });
            }
            onRefresh();
            onClose();
        } catch (err: any) {
            alert(err.response?.data?.error || 'Import failed');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
            <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95">
                <div className="p-4 border-b flex items-center justify-between font-bold text-lg">
                    <div className="flex items-center gap-2">
                        <Upload className="w-5 h-5 text-primary" />
                        {step === 'input' ? 'Bulk Import Recipients' : 'Review Import Data'}
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
                </div>

                <div className="flex-1 overflow-auto p-6">
                    {step === 'input' ? (
                        <div className="space-y-6">
                            <div className="flex p-1 bg-muted rounded-lg w-fit">
                                <Button
                                    variant={mode === 'upload' ? 'secondary' : 'ghost'}
                                    size="sm"
                                    onClick={() => setMode('upload')}
                                    className={cn(mode === 'upload' && "bg-background shadow-sm")}
                                >
                                    CSV/Excel Upload
                                </Button>
                                <Button
                                    variant={mode === 'paste' ? 'secondary' : 'ghost'}
                                    size="sm"
                                    onClick={() => setMode('paste')}
                                    className={cn(mode === 'paste' && "bg-background shadow-sm")}
                                >
                                    Paste Numbers
                                </Button>
                            </div>

                            {mode === 'upload' ? (
                                <div className="space-y-6">
                                    <div
                                        className="text-center py-20 border-2 border-dashed border-muted-foreground/20 rounded-2xl bg-muted/5 hover:bg-muted/10 transition-colors cursor-pointer group"
                                        onClick={() => fileRef.current?.click()}
                                    >
                                        <div className="w-16 h-16 bg-background rounded-full flex items-center justify-center mx-auto mb-4 border shadow-sm group-hover:scale-110 transition-transform">
                                            <Upload className="w-8 h-8 text-primary" />
                                        </div>
                                        <p className="font-semibold text-lg">Click to select CSV/Excel file</p>
                                        <p className="text-sm text-muted-foreground mt-1 px-10">
                                            Ensure your file has headers: <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-primary">phone</span>,
                                            <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-primary mx-1">name</span>,
                                            and <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-primary">language</span>.
                                        </p>
                                        <input
                                            type="file"
                                            ref={fileRef}
                                            className="hidden"
                                            accept=".csv, .xlsx, .xls"
                                            onChange={handleFile}
                                        />
                                    </div>

                                    <div className="bg-muted/30 rounded-xl p-4 border border-dashed text-left space-y-3">
                                        <h4 className="text-sm font-semibold flex items-center gap-2">
                                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Pro Tip</Badge>
                                            Required File Format
                                        </h4>
                                        <div className="grid grid-cols-3 gap-2 text-[11px]">
                                            <div className="p-2 bg-background rounded border">
                                                <p className="font-bold text-primary mb-1">phone (Required)</p>
                                                <p className="text-muted-foreground leading-tight">Must include country code (e.g., +234...)</p>
                                            </div>
                                            <div className="p-2 bg-background rounded border">
                                                <p className="font-bold text-primary mb-1">name (Optional)</p>
                                                <p className="text-muted-foreground leading-tight">Recipient's full name for personalization.</p>
                                            </div>
                                            <div className="p-2 bg-background rounded border">
                                                <p className="font-bold text-primary mb-1">language (Optional)</p>
                                                <p className="text-muted-foreground leading-tight">Values: en, yo, ig, ha, pcm (Default: en)</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <p className="text-sm text-muted-foreground">
                                        Paste phone numbers separated by new lines, commas, or semicolons.
                                    </p>
                                    <textarea
                                        className="w-full h-48 p-4 rounded-xl border bg-background font-mono text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                        placeholder="+2348030000000&#10;+2348030000001&#10;..."
                                        value={pasteValue}
                                        onChange={e => setPasteValue(e.target.value)}
                                    />
                                    <Button className="w-full py-6 text-lg shadow-lg shadow-primary/10" onClick={handlePasteSubmit} disabled={!pasteValue.trim()}>
                                        Preview Recipients <ArrowRight className="w-5 h-5 ml-2" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-semibold text-lg">Validating {csvData.length} entries</h3>
                                    <p className="text-sm text-muted-foreground">
                                        {csvData.filter(r => !r.isValid).length > 0
                                            ? `${csvData.filter(r => !r.isValid).length} invalid entries will be skipped.`
                                            : 'Everything looks great!'}
                                    </p>
                                </div>
                                <Button variant="outline" size="sm" onClick={() => setStep('input')}>Back to start</Button>
                            </div>

                            <div className="border rounded-xl overflow-hidden bg-card shadow-inner">
                                <div className="max-h-64 overflow-auto">
                                    <table className="w-full text-xs text-left border-collapse">
                                        <thead className="bg-muted sticky top-0 z-10">
                                            <tr>
                                                <th className="p-3 border-b font-semibold">Status</th>
                                                <th className="p-3 border-b font-semibold">Phone</th>
                                                <th className="p-3 border-b font-semibold">Name</th>
                                                <th className="p-3 border-b font-semibold">Language</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {csvData.map((row, i) => (
                                                <tr key={i} className={cn(!row.isValid && "bg-destructive/5 text-destructive")}>
                                                    <td className="p-3">
                                                        {row.isValid
                                                            ? <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Valid</Badge>
                                                            : <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">Invalid</Badge>
                                                        }
                                                    </td>
                                                    <td className="p-3 font-mono">{row.phone}</td>
                                                    <td className="p-3">{row.name || '—'}</td>
                                                    <td className="p-3 uppercase">{row.language}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t flex justify-end gap-3 bg-muted/20 rounded-b-2xl">
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    {step === 'preview' && (
                        <Button
                            onClick={handleImport}
                            disabled={submitting || csvData.filter(r => r.isValid).length === 0}
                            className="px-8 shadow-lg shadow-primary/20"
                        >
                            {submitting ? 'Importing...' : `Import ${csvData.filter(r => r.isValid).length} Contacts`}
                        </Button>
                    )}
                </div>
            </Card>
        </div>
    );
}

function EditRecipientModal({ recipient, groups, onClose, onRefresh }: { recipient: Recipient, groups: Group[], onClose: () => void, onRefresh: () => void }) {
    const [form, setForm] = useState<{ phone: string, name: string, languagePreference: string, groupIds: string[] }>({
        phone: recipient.phone,
        name: recipient.name || '',
        languagePreference: recipient.languagePreference || 'en',
        groupIds: []
    });
    const [loadingIds, setLoadingIds] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        // Fetch current group memberships
        api.get(`/recipients/${recipient.id}`).then(res => {
            setForm(prev => ({ ...prev, groupIds: res.data.groupIds || [] }));
        }).catch(err => {
            console.error('Failed to fetch memberships:', err);
        }).finally(() => {
            setLoadingIds(false);
        });
    }, [recipient.id]);

    const toggleGroup = (id: string) => {
        setForm(prev => ({
            ...prev,
            groupIds: prev.groupIds.includes(id)
                ? prev.groupIds.filter(gid => gid !== id)
                : [...prev.groupIds, id]
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await api.put(`/recipients/${recipient.id}`, form);
            onRefresh();
            onClose();
        } catch (err: any) {
            alert(err.response?.data?.error || 'Failed to update recipient');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
            <Card className="w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 overflow-hidden">
                <div className="p-4 border-b flex items-center justify-between font-bold text-lg">
                    Edit Recipient
                    <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
                </div>
                <form onSubmit={handleSubmit} className="max-h-[85vh] overflow-y-auto">
                    <div className="p-6 space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Phone Number *</label>
                            <Input placeholder="+234..." value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} required />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Full Name (Optional)</label>
                            <Input placeholder="John Doe" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Language Preference</label>
                            <select
                                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                                value={form.languagePreference}
                                onChange={e => setForm({ ...form, languagePreference: e.target.value })}
                            >
                                <option value="en">English</option>
                                <option value="yo">Yoruba</option>
                                <option value="ig">Igbo</option>
                                <option value="ha">Hausa</option>
                                <option value="pcm">Pidgin</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Group Memberships</label>
                            {loadingIds ? (
                                <div className="h-20 animate-pulse bg-muted rounded-md" />
                            ) : (
                                <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-1 border rounded-md">
                                    {groups.map(g => (
                                        <button
                                            key={g.id}
                                            type="button"
                                            onClick={() => toggleGroup(g.id)}
                                            className={cn(
                                                "flex items-center gap-2 px-2 py-1 responsive-text rounded border text-left transition-colors",
                                                form.groupIds.includes(g.id)
                                                    ? "bg-primary/10 border-primary text-primary"
                                                    : "hover:bg-muted border-transparent"
                                            )}
                                        >
                                            {form.groupIds.includes(g.id) ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3" />}
                                            <span className="truncate">{g.name}</span>
                                        </button>
                                    ))}
                                    {groups.length === 0 && <p className="col-span-2 text-xs text-muted-foreground p-2">No groups created yet</p>}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="p-4 border-t flex justify-end gap-2 bg-muted/20">
                        <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
                        <Button type="submit" disabled={submitting}>
                            {submitting ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    );
}

// Utility
function cn(...inputs: any[]) {
    return inputs.filter(Boolean).join(' ');
}
