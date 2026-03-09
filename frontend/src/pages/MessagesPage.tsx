import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import { formatDate, formatCurrency } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, MessageSquare, Play, Pause, Languages, Volume2, Send, Calendar, Trash2 } from 'lucide-react';

interface Message {
    id: string;
    sourceText: string;
    sourceLanguage: string;
    targetLanguages: string[];
    translations: Record<string, string> | null;
    audioUrls: Record<string, string> | null;
    status: 'draft' | 'scheduled' | 'sending' | 'completed';
    scheduledAt: string | null;
    campaignId: string | null;
    createdAt: string;
}

interface Campaign { id: string; name: string; }
interface Group { id: string; name: string; }
interface Language { code: string; name: string; }

const STATUS_COLORS: Record<string, 'default' | 'secondary' | 'warning' | 'success'> = {
    draft: 'secondary',
    scheduled: 'warning',
    sending: 'default',
    completed: 'success',
};

export function MessagesPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [languages, setLanguages] = useState<Language[]>([]);
    const [showWizard, setShowWizard] = useState(false);
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [playingAudio, setPlayingAudio] = useState<string | null>(null);
    const audioRef = React.useRef<HTMLAudioElement | null>(null);

    const [recipients, setRecipients] = useState<any[]>([]);



    // Form state
    const [form, setForm] = useState({
        sourceText: '',
        sourceLanguage: 'en',
        targetLanguages: [] as string[],
        campaignId: '',
        groupIds: [] as string[],
        recipientIds: [] as string[],
        scheduledAt: '',
    });
    const [currentMessage, setCurrentMessage] = useState<Message | null>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [mRes, cRes, gRes, lRes, rRes] = await Promise.all([
                api.get('/messages'),
                api.get('/campaigns'),
                api.get('/recipients/groups/list'),
                api.get('/dashboard/languages'),
                api.get('/recipients'),
            ]);
            setMessages(mRes.data);
            setCampaigns(cRes.data);
            setGroups(gRes.data);
            setLanguages(lRes.data);
            setRecipients(rRes.data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, []);

    const toggleRecipient = (id: string) => {
        setForm((prev) => ({
            ...prev,
            recipientIds: prev.recipientIds.includes(id)
                ? prev.recipientIds.filter((r) => r !== id)
                : [...prev.recipientIds, id],
        }));
    };

    const toggleLanguage = (code: string) => {
        setForm((prev) => ({
            ...prev,
            targetLanguages: prev.targetLanguages.includes(code)
                ? prev.targetLanguages.filter((l) => l !== code)
                : [...prev.targetLanguages, code],
        }));
    };

    const toggleGroup = (id: string) => {
        setForm((prev) => ({
            ...prev,
            groupIds: prev.groupIds.includes(id)
                ? prev.groupIds.filter((g) => g !== id)
                : [...prev.groupIds, id],
        }));
    };

    // Step 1: Create message
    const handleCreate = async () => {
        setProcessing(true);
        try {
            const res = await api.post('/messages', {
                sourceText: form.sourceText,
                sourceLanguage: form.sourceLanguage,
                targetLanguages: form.targetLanguages,
                campaignId: form.campaignId || null,
                groupIds: form.groupIds.length > 0 ? form.groupIds : undefined,
                recipientIds: form.recipientIds.length > 0 ? form.recipientIds : undefined,
            });
            setCurrentMessage(res.data);
            setStep(2);
        } catch (err: any) {
            alert(err.response?.data?.error || 'Failed');
        } finally {
            setProcessing(false);
        }
    };

    // Step 2: Translate
    const handleTranslate = async () => {
        if (!currentMessage) return;
        setProcessing(true);
        try {
            const res = await api.post(`/messages/${currentMessage.id}/translate`);
            setCurrentMessage(res.data);
            setStep(3);
        } catch (err: any) {
            alert(err.response?.data?.error || 'Translation failed');
        } finally {
            setProcessing(false);
        }
    };

    // Step 3: Generate Audio
    const handleGenerateAudio = async () => {
        if (!currentMessage) return;
        setProcessing(true);
        try {
            const res = await api.post(`/messages/${currentMessage.id}/generate-audio`);
            setCurrentMessage(res.data);
            setStep(4);
        } catch (err: any) {
            alert(err.response?.data?.error || 'Audio generation failed');
        } finally {
            setProcessing(false);
        }
    };

    // Step 4: Send or schedule
    const handleSend = async (scheduled: boolean) => {
        if (!currentMessage) return;
        setProcessing(true);
        try {
            if (scheduled && form.scheduledAt) {
                // Update message to scheduled status (would be handled via the send endpoint)
                await api.put(`/messages/${currentMessage.id}`, { scheduledAt: form.scheduledAt });
            }
            await api.post(`/voice/send/${currentMessage.id}`);
            setShowWizard(false);
            setStep(1);
            setCurrentMessage(null);
            setForm({ sourceText: '', sourceLanguage: 'en', targetLanguages: [], campaignId: '', groupIds: [], recipientIds: [], scheduledAt: '' });
            fetchData();
        } catch (err: any) {
            alert(err.response?.data?.error || 'Send failed');
        } finally {
            setProcessing(false);
        }
    };

    const playAudio = (url: string) => {
        if (playingAudio === url) {
            audioRef.current?.pause();
            setPlayingAudio(null);
        } else {
            if (audioRef.current) audioRef.current.pause();
            const audio = new Audio(url);
            audio.play();
            audio.onended = () => setPlayingAudio(null);
            audioRef.current = audio;
            setPlayingAudio(url);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this message?')) return;
        try {
            await api.delete(`/messages/${id}`);
            fetchData();
        } catch (err: any) {
            alert(err.response?.data?.error || 'Delete failed');
        }
    };

    const resetWizard = () => {
        setShowWizard(false);
        setStep(1);
        setCurrentMessage(null);
        setForm({ sourceText: '', sourceLanguage: 'en', targetLanguages: [], campaignId: '', groupIds: [], recipientIds: [], scheduledAt: '' });
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Messages</h1>
                    <p className="text-muted-foreground">Create, translate, and send multilingual voice messages</p>
                </div>
                <Button onClick={() => setShowWizard(true)}>
                    <Plus className="w-4 h-4 mr-2" />New Message
                </Button>
            </div>

            {/* Message Wizard */}
            {showWizard && (
                <Card className="animate-fade-in border-primary/20">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">
                                {step === 1 && '✍️ Compose Message'}
                                {step === 2 && '🌍 Translate'}
                                {step === 3 && '🔊 Generate Audio'}
                                {step === 4 && '📤 Preview & Send'}
                            </CardTitle>
                            <div className="flex gap-1">
                                {[1, 2, 3, 4].map((s) => (
                                    <div key={s} className={`w-8 h-1.5 rounded-full transition-colors ${s <= step ? 'bg-primary' : 'bg-muted'}`} />
                                ))}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {/* Step 1: Compose */}
                        {step === 1 && (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Message Text *</Label>
                                    <Textarea
                                        placeholder="Type your message here..."
                                        value={form.sourceText}
                                        onChange={(e) => setForm({ ...form, sourceText: e.target.value })}
                                        rows={4}
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Source Language *</Label>
                                        <select
                                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                            value={form.sourceLanguage}
                                            onChange={(e) => setForm({ ...form, sourceLanguage: e.target.value })}
                                        >
                                            {languages.map((l) => (
                                                <option key={l.code} value={l.code}>{l.name} ({l.code})</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Campaign (optional)</Label>
                                        <select
                                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                            value={form.campaignId}
                                            onChange={(e) => setForm({ ...form, campaignId: e.target.value })}
                                        >
                                            <option value="">None</option>
                                            {campaigns.map((c) => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Target Languages * (select at least 1)</Label>
                                    <div className="flex flex-wrap gap-2">
                                        {languages.map((l) => (
                                            <button
                                                key={l.code}
                                                type="button"
                                                onClick={() => toggleLanguage(l.code)}
                                                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${form.targetLanguages.includes(l.code)
                                                    ? 'bg-primary text-primary-foreground border-primary'
                                                    : 'border-input bg-background hover:bg-accent'
                                                    }`}
                                            >
                                                {l.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Recipient Groups</Label>
                                    <div className="flex flex-wrap gap-2">
                                        {groups.map((g) => (
                                            <button
                                                key={g.id}
                                                type="button"
                                                onClick={() => toggleGroup(g.id)}
                                                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${form.groupIds.includes(g.id)
                                                    ? 'bg-primary text-primary-foreground border-primary'
                                                    : 'border-input bg-background hover:bg-accent'
                                                    }`}
                                            >
                                                {g.name}
                                            </button>
                                        ))}
                                        {groups.length === 0 && <p className="text-sm text-muted-foreground">No groups created yet</p>}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Individual Recipients</Label>
                                    <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-1">
                                        {recipients.length === 0 ? (
                                            <p className="text-sm text-muted-foreground p-2">No recipients found</p>
                                        ) : (
                                            recipients.map((r) => (
                                                <div key={r.id} className="flex items-center space-x-2">
                                                    <input
                                                        type="checkbox"
                                                        id={`r-${r.id}`}
                                                        checked={form.recipientIds.includes(r.id)}
                                                        onChange={() => toggleRecipient(r.id)}
                                                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                                    />
                                                    <label htmlFor={`r-${r.id}`} className="text-sm cursor-pointer select-none">
                                                        {r.name ? `${r.name} (${r.phone})` : r.phone}
                                                    </label>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                <div className="flex gap-2 pt-2">
                                    <Button onClick={handleCreate} disabled={!form.sourceText || form.targetLanguages.length === 0 || processing}>
                                        {processing ? 'Creating...' : 'Create & Continue'}
                                    </Button>
                                    <Button variant="ghost" onClick={resetWizard}>Cancel</Button>
                                </div>
                            </div>
                        )}

                        {/* Step 2: Translate */}
                        {step === 2 && currentMessage && (
                            <div className="space-y-4">
                                <div className="p-4 bg-muted rounded-lg">
                                    <p className="text-sm font-medium text-muted-foreground mb-1">Source ({currentMessage.sourceLanguage})</p>
                                    <p>{currentMessage.sourceText}</p>
                                </div>
                                <Button onClick={handleTranslate} disabled={processing}>
                                    <Languages className="w-4 h-4 mr-2" />
                                    {processing ? 'Translating...' : `Translate to ${(currentMessage.targetLanguages as string[]).length} languages`}
                                </Button>
                            </div>
                        )}

                        {/* Step 3: Generate Audio */}
                        {step === 3 && currentMessage && (
                            <div className="space-y-4">
                                <p className="text-sm text-muted-foreground">Translations ready. Review below:</p>
                                <div className="space-y-2">
                                    {currentMessage.translations && Object.entries(currentMessage.translations).map(([lang, text]) => (
                                        <div key={lang} className="p-3 border rounded-lg">
                                            <Badge variant="outline" className="mb-1">{lang}</Badge>
                                            <p className="text-sm">{text}</p>
                                        </div>
                                    ))}
                                </div>
                                <Button onClick={handleGenerateAudio} disabled={processing}>
                                    <Volume2 className="w-4 h-4 mr-2" />
                                    {processing ? 'Generating audio...' : 'Generate Audio for all languages'}
                                </Button>
                            </div>
                        )}

                        {/* Step 4: Preview & Send */}
                        {step === 4 && currentMessage && (
                            <div className="space-y-4">
                                <p className="text-sm text-muted-foreground">Audio generated. Preview and send:</p>

                                {/* Audio Previews */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {currentMessage.audioUrls && Object.entries(currentMessage.audioUrls).map(([lang, url]) => (
                                        <div key={lang} className="flex items-center gap-3 p-3 border rounded-lg">
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                onClick={() => playAudio(url)}
                                                className="shrink-0"
                                            >
                                                {playingAudio === url ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                            </Button>
                                            <div className="flex-1 min-w-0">
                                                <Badge variant="outline">{lang}</Badge>
                                                <p className="text-xs text-muted-foreground truncate mt-1">
                                                    {currentMessage.translations?.[lang]?.substring(0, 50)}...
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="space-y-2">
                                    <Label>Schedule for later (optional)</Label>
                                    <Input
                                        type="datetime-local"
                                        value={form.scheduledAt}
                                        onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                                    />
                                </div>

                                <div className="flex gap-2 pt-2">
                                    <Button onClick={() => handleSend(false)} disabled={processing}>
                                        <Send className="w-4 h-4 mr-2" />
                                        {processing ? 'Sending...' : 'Send Now'}
                                    </Button>
                                    {form.scheduledAt && (
                                        <Button variant="outline" onClick={() => handleSend(true)} disabled={processing}>
                                            <Calendar className="w-4 h-4 mr-2" />Schedule
                                        </Button>
                                    )}
                                    <Button variant="ghost" onClick={resetWizard}>Cancel</Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Messages List */}
            <Card>
                <CardContent className="pt-6">
                    {messages.length === 0 ? (
                        <div className="text-center text-muted-foreground py-12">
                            <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-30" />
                            <p>No messages yet. Create your first voice message above.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left py-3 px-2 font-medium text-muted-foreground">Message</th>
                                        <th className="text-left py-3 px-2 font-medium text-muted-foreground">Languages</th>
                                        <th className="text-left py-3 px-2 font-medium text-muted-foreground">Status</th>
                                        <th className="text-left py-3 px-2 font-medium text-muted-foreground">Created</th>
                                        <th className="text-right py-3 px-2 font-medium text-muted-foreground">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {messages.map((m) => (
                                        <tr key={m.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                                            <td className="py-3 px-2 max-w-xs truncate">{m.sourceText}</td>
                                            <td className="py-3 px-2">
                                                <div className="flex flex-wrap gap-1">
                                                    {(m.targetLanguages as string[]).map((l) => (
                                                        <Badge key={l} variant="outline" className="text-xs">{l}</Badge>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="py-3 px-2">
                                                <Badge variant={STATUS_COLORS[m.status]}>{m.status}</Badge>
                                            </td>
                                            <td className="py-3 px-2 text-muted-foreground">{formatDate(m.createdAt)}</td>
                                            <td className="py-3 px-2 text-right">
                                                <Button variant="ghost" size="icon" onClick={() => handleDelete(m.id)}>
                                                    <Trash2 className="w-4 h-4 text-destructive" />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
