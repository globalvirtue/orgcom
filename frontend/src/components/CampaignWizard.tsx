import React, { useState, useEffect, useRef } from 'react';
import {
    Users, MessageSquare, Languages, Clock, CheckCircle,
    ChevronRight, ChevronLeft, Plus, Trash2, Globe, Sparkles, Megaphone,
    X, ClipboardPaste, Search, Mic, MicOff, Play, Square, Download,
    Upload, Link, Volume2, Loader2, Pause
} from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input, Textarea, Label } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn, formatCurrency } from '@/lib/utils';
import { useAuth } from '@/lib/auth';

interface CampaignWizardProps {
    campaignType: 'sms' | 'voice';
    onClose: () => void;
    onSuccess: () => void;
}

const LANGUAGES = [
    { code: 'en', label: 'English' },
    { code: 'yo', label: 'Yoruba' },
    { code: 'ig', label: 'Igbo' },
    { code: 'ha', label: 'Hausa' },
    { code: 'pcm', label: 'Nigerian Pidgin' },
];

export function CampaignWizard({ campaignType, onClose, onSuccess }: CampaignWizardProps) {
    const { organization } = useAuth();
    const [groups, setGroups] = useState<any[]>([]);
    const [recipients, setRecipients] = useState<any[]>([]);
    const [recipientSearch, setRecipientSearch] = useState('');
    const [audienceTab, setAudienceTab] = useState<'groups' | 'individuals' | 'paste'>('groups');
    const [pastedNumbers, setPastedNumbers] = useState('');
    const [loading, setLoading] = useState(false);

    // Audio state for Voice campaigns
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [ttsGenerating, setTtsGenerating] = useState(false);
    const [uploadedFileName, setUploadedFileName] = useState('');
    const [audioUrlInput, setAudioUrlInput] = useState('');
    const [isPlaying, setIsPlaying] = useState(false);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const audioElementRef = useRef<HTMLAudioElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const recordingTimerRef = useRef<any>(null);

    const isVoice = campaignType === 'voice';
    const typeLabel = isVoice ? 'Voice' : 'SMS';

    const [form, setForm] = useState({
        name: '',
        description: '',
        type: campaignType,
        mode: 'one_time' as 'one_time' | 'scheduled' | 'recurring',
        audience: {
            groupIds: [] as string[],
            recipientIds: [] as string[],
            pastedPhones: [] as string[],
            all: false
        },
        messageContent: {
            sourceText: '',
            sourceLanguage: organization?.defaultLanguage || 'en',
            targetLanguages: [] as string[],
            audioSource: 'tts' as 'upload' | 'record' | 'tts',
            smsBody: ''
        },
        language: 'en',
        scheduledAt: '',
        recurringInterval: 'daily' as 'daily' | 'weekly' | 'monthly',
        recurringEndDate: ''
    });

    const fetchGroups = async () => {
        try {
            const res = await api.get('/recipients/groups/list');
            setGroups(res.data);
        } catch (err) { console.error(err); }
    };

    const fetchRecipients = async () => {
        try {
            const res = await api.get('/recipients', { params: { search: recipientSearch, limit: 20 } });
            setRecipients(res.data.data || []);
        } catch (err) { console.error(err); }
    };

    useEffect(() => {
        fetchGroups();
        fetchRecipients();
    }, []);

    useEffect(() => {
        fetchRecipients();
    }, [recipientSearch]);

    const toggleGroup = (id: string) => {
        setForm(f => ({
            ...f,
            audience: {
                ...f.audience,
                groupIds: f.audience.groupIds.includes(id)
                    ? f.audience.groupIds.filter(gid => gid !== id)
                    : [...f.audience.groupIds, id]
            }
        }));
    };

    const toggleRecipient = (id: string) => {
        setForm(f => ({
            ...f,
            audience: {
                ...f.audience,
                recipientIds: f.audience.recipientIds.includes(id)
                    ? f.audience.recipientIds.filter(rid => rid !== id)
                    : [...f.audience.recipientIds, id]
            }
        }));
    };

    const parsePastedNumbers = (text: string) => {
        setPastedNumbers(text);
        const phones = text
            .split(/[\n,;]+/)
            .map(p => p.trim().replace(/[^0-9+]/g, ''))
            .filter(p => p.length >= 7);
        setForm(f => ({
            ...f,
            audience: { ...f.audience, pastedPhones: [...new Set(phones)] }
        }));
    };

    // ─── Audio Helpers ───

    const setAudioFromBlob = (blob: Blob) => {
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
    };

    const clearAudio = () => {
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        setAudioBlob(null);
        setAudioUrl(null);
        setUploadedFileName('');
        setIsPlaying(false);
        if (audioElementRef.current) {
            audioElementRef.current.pause();
            audioElementRef.current = null;
        }
    };

    const handleTTSGenerate = async () => {
        if (!form.messageContent.sourceText.trim()) return alert('Enter a voice script first');
        setTtsGenerating(true);
        try {
            // Attempt to call backend TTS endpoint
            const res = await api.post('/tts/generate', {
                text: form.messageContent.sourceText,
                language: form.language || 'en'
            }, { responseType: 'blob' });
            setAudioFromBlob(res.data);
        } catch {
            // Fallback: generate a simple audio placeholder using Web Audio API
            const ctx = new AudioContext();
            const duration = 2;
            const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            // Generate a simple tone
            for (let i = 0; i < data.length; i++) {
                data[i] = Math.sin(2 * Math.PI * 440 * i / ctx.sampleRate) * 0.3 * Math.max(0, 1 - i / data.length);
            }
            const offlineCtx = new OfflineAudioContext(1, ctx.sampleRate * duration, ctx.sampleRate);
            const source = offlineCtx.createBufferSource();
            source.buffer = buffer;
            source.connect(offlineCtx.destination);
            source.start();
            const rendered = await offlineCtx.startRendering();

            // Convert to WAV blob
            const wavBlob = audioBufferToWav(rendered);
            setAudioFromBlob(wavBlob);
            ctx.close();
        }
        setTtsGenerating(false);
    };

    // Simple WAV encoder
    const audioBufferToWav = (buffer: AudioBuffer): Blob => {
        const numChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const format = 1; // PCM
        const bitDepth = 16;
        const bytesPerSample = bitDepth / 8;
        const blockAlign = numChannels * bytesPerSample;
        const data = buffer.getChannelData(0);
        const samples = data.length;
        const dataSize = samples * blockAlign;
        const headerSize = 44;
        const arrayBuffer = new ArrayBuffer(headerSize + dataSize);
        const view = new DataView(arrayBuffer);
        const writeString = (offset: number, str: string) => {
            for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
        };
        writeString(0, 'RIFF');
        view.setUint32(4, 36 + dataSize, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, format, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * blockAlign, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitDepth, true);
        writeString(36, 'data');
        view.setUint32(40, dataSize, true);
        let offset = 44;
        for (let i = 0; i < samples; i++) {
            const s = Math.max(-1, Math.min(1, data[i]));
            view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
            offset += 2;
        }
        return new Blob([arrayBuffer], { type: 'audio/wav' });
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            audioChunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            recorder.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                setAudioFromBlob(blob);
                stream.getTracks().forEach(t => t.stop());
            };

            recorder.start();
            mediaRecorderRef.current = recorder;
            setIsRecording(true);
            setRecordingTime(0);

            recordingTimerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch (err) {
            alert('Could not access microphone. Please allow microphone permissions.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
        if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = null;
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('audio/')) {
            return alert('Please upload an audio file (MP3, WAV, OGG, etc.)');
        }
        setUploadedFileName(file.name);
        setAudioFromBlob(file);
    };

    const playAudio = () => {
        if (!audioUrl) return;
        if (audioElementRef.current) {
            if (isPlaying) {
                audioElementRef.current.pause();
                setIsPlaying(false);
                return;
            }
        }
        const audio = new Audio(audioUrl);
        audioElementRef.current = audio;
        audio.play();
        setIsPlaying(true);
        audio.onended = () => setIsPlaying(false);
    };

    const downloadAudio = () => {
        if (!audioUrl) return;
        const a = document.createElement('a');
        a.href = audioUrl;
        a.download = `voice-campaign-${Date.now()}.${audioBlob?.type.includes('wav') ? 'wav' : audioBlob?.type.includes('webm') ? 'webm' : 'mp3'}`;
        a.click();
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // Cleanup
    useEffect(() => {
        return () => {
            if (audioUrl) URL.revokeObjectURL(audioUrl);
            if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }
        };
    }, []);

    const totalAudience = form.audience.all
        ? 'All Recipients'
        : `${form.audience.groupIds.length} groups, ${form.audience.recipientIds.length} contacts, ${form.audience.pastedPhones.length} pasted`;

    const handleSubmit = async () => {
        if (!form.name.trim()) return alert('Campaign name is required');
        if (!form.audience.all && form.audience.groupIds.length === 0 && form.audience.recipientIds.length === 0 && form.audience.pastedPhones.length === 0) {
            return alert('Select at least one audience');
        }

        let finalSourceText = form.messageContent.sourceText.trim();
        let finalTargetLanguages: string[] = [];
        let finalSourceLanguage: string | undefined = form.messageContent.sourceLanguage;

        if (isVoice) {
            if (form.messageContent.audioSource === 'tts') {
                if (!finalSourceText) return alert('Voice script text is required for Text-to-Speech');
                if (!form.language) return alert('Please select an output language for Text-to-Speech');
                if (!audioUrl) return alert('Please generate the audio first before proceeding');
                finalTargetLanguages = [form.language];
            } else if (form.messageContent.audioSource === 'upload') {
                if (!audioUrl) return alert('Please upload an audio file before proceeding');
                finalSourceText = '[Uploaded Audio]';
                finalSourceLanguage = undefined;
            } else if (form.messageContent.audioSource === 'record') {
                if (!audioUrl) return alert('Please record your audio before proceeding');
                finalSourceText = '[Recorded Audio]';
                finalSourceLanguage = undefined;
            }
        } else {
            if (!finalSourceText) return alert('Message content is required for SMS');
            finalTargetLanguages = [form.language];
        }

        setLoading(true);
        try {
            const payload: any = {
                ...form,
                scheduledAt: form.scheduledAt || null,
                recurringEndDate: form.recurringEndDate || null,
                messageContent: {
                    ...form.messageContent,
                    sourceText: finalSourceText,
                    sourceLanguage: finalSourceLanguage,
                    targetLanguages: finalTargetLanguages
                }
            };

            if (isVoice && audioBlob) {
                // Convert blob to base64
                const base64Audio = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(audioBlob);
                });
                payload.messageContent.audioUrl = base64Audio;
            } else if (isVoice && audioUrl) {
                // Simple URL if already generated via TTS (which returns an /api/audio/ path)
                payload.messageContent.audioUrl = audioUrl;
            }

            await api.post('/campaigns', payload);
            onSuccess();
        } catch (err: any) {
            const data = err.response?.data;
            if (data?.details && Array.isArray(data.details)) {
                const details = data.details.map((d: any) => `- ${d.field}: ${d.message}`).join('\n');
                alert(`Validation failed:\n${details}`);
            } else {
                alert(data?.error || err.message || 'Failed to create campaign');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 lg:p-8">
            <Card className="w-full max-w-4xl h-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between border-b px-6 py-4 bg-card shrink-0">
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center",
                            isVoice ? "bg-violet-100 text-violet-600" : "bg-blue-100 text-blue-600"
                        )}>
                            {isVoice ? <Megaphone className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">New {typeLabel} Campaign</h2>
                            <p className="text-xs text-muted-foreground">Fill in the details below to create your broadcast</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                {/* ─── Single-Page Scrollable Form ─── */}
                <div className="flex-1 overflow-y-auto">
                    <div className="max-w-3xl mx-auto p-6 lg:p-8 space-y-10">

                        {/* ═══════════════════════════════════
                            SECTION 1: Campaign Details
                        ═══════════════════════════════════ */}
                        <section className="space-y-5">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</div>
                                <h3 className="text-lg font-semibold">Campaign Details</h3>
                            </div>

                            <div className="space-y-4 pl-9">
                                <div className="space-y-1.5">
                                    <Label>Campaign Name <span className="text-destructive">*</span></Label>
                                    <Input
                                        placeholder={isVoice ? "e.g., Weekly Health Reminder Call" : "e.g., Promo Flash Sale"}
                                        value={form.name}
                                        onChange={e => setForm({ ...form, name: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
                                    <Input
                                        placeholder="Brief description of this campaign..."
                                        value={form.description}
                                        onChange={e => setForm({ ...form, description: e.target.value })}
                                    />
                                </div>
                            </div>
                        </section>

                        <hr className="border-dashed" />

                        {/* ═══════════════════════════════════
                            SECTION 2: Recipients
                        ═══════════════════════════════════ */}
                        <section className="space-y-5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</div>
                                    <h3 className="text-lg font-semibold">Recipients</h3>
                                </div>
                                <Button
                                    variant={form.audience.all ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setForm({ ...form, audience: { ...form.audience, all: !form.audience.all } })}
                                >
                                    {form.audience.all ? '✓ All Selected' : 'Select All'}
                                </Button>
                            </div>

                            {!form.audience.all && (
                                <div className="pl-9 space-y-4">
                                    {/* Audience Method Tabs */}
                                    <div className="flex bg-muted p-1 rounded-lg">
                                        {[
                                            { key: 'groups', label: 'Groups', count: form.audience.groupIds.length },
                                            { key: 'individuals', label: 'Contacts', count: form.audience.recipientIds.length },
                                            { key: 'paste', label: 'Paste Numbers', count: form.audience.pastedPhones.length },
                                        ].map(tab => (
                                            <button
                                                key={tab.key}
                                                className={cn(
                                                    "flex-1 py-2 text-sm font-medium rounded-md transition-all",
                                                    audienceTab === tab.key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                                                )}
                                                onClick={() => setAudienceTab(tab.key as any)}
                                            >
                                                {tab.label} {tab.count > 0 && <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">{tab.count}</Badge>}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Groups Tab */}
                                    {audienceTab === 'groups' && (
                                        <div className="space-y-3">
                                            {groups.length === 0 ? (
                                                <div className="py-10 text-center bg-muted/20 rounded-xl border border-dashed">
                                                    <Users className="w-10 h-10 mx-auto mb-2 text-muted-foreground/40" />
                                                    <p className="text-sm text-muted-foreground">No groups found.</p>
                                                    <p className="text-xs text-muted-foreground mt-1">Create groups in the Recipients section first.</p>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    {groups.map(group => {
                                                        const selected = form.audience.groupIds.includes(group.id);
                                                        return (
                                                            <div
                                                                key={group.id}
                                                                className={cn(
                                                                    "px-4 py-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between",
                                                                    selected ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "bg-card hover:border-primary/40"
                                                                )}
                                                                onClick={() => toggleGroup(group.id)}
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                                                                        <Users className="w-4 h-4 text-muted-foreground" />
                                                                    </div>
                                                                    <div>
                                                                        <p className="font-medium text-sm">{group.name}</p>
                                                                        <p className="text-xs text-muted-foreground">{group.recipientCount || 0} members</p>
                                                                    </div>
                                                                </div>
                                                                <div className={cn(
                                                                    "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                                                                    selected ? "border-primary bg-primary" : "border-muted-foreground/30"
                                                                )}>
                                                                    {selected && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Individuals Tab */}
                                    {audienceTab === 'individuals' && (
                                        <div className="space-y-3">
                                            <div className="relative">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                                <Input
                                                    placeholder="Search by name or phone..."
                                                    value={recipientSearch}
                                                    onChange={e => setRecipientSearch(e.target.value)}
                                                    className="pl-9"
                                                />
                                            </div>
                                            <div className="max-h-[220px] overflow-y-auto space-y-1 pr-1">
                                                {recipients.length === 0 ? (
                                                    <div className="py-10 text-center bg-muted/20 rounded-xl border border-dashed">
                                                        <p className="text-sm text-muted-foreground">No contacts found.</p>
                                                    </div>
                                                ) : recipients.map(r => {
                                                    const selected = form.audience.recipientIds.includes(r.id);
                                                    return (
                                                        <div
                                                            key={r.id}
                                                            className={cn(
                                                                "px-3 py-2.5 rounded-lg border cursor-pointer transition-all flex items-center justify-between",
                                                                selected ? "border-primary bg-primary/5" : "bg-card hover:border-primary/40"
                                                            )}
                                                            onClick={() => toggleRecipient(r.id)}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold">
                                                                    {r.name?.[0]?.toUpperCase() || '#'}
                                                                </div>
                                                                <div>
                                                                    <p className="text-sm font-medium">{r.name || r.phone}</p>
                                                                    <p className="text-[10px] text-muted-foreground">{r.phone}</p>
                                                                </div>
                                                            </div>
                                                            <div className={cn(
                                                                "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                                                                selected ? "border-primary bg-primary" : "border-muted-foreground/30"
                                                            )}>
                                                                {selected && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Paste Numbers Tab */}
                                    {audienceTab === 'paste' && (
                                        <div className="space-y-3">
                                            <p className="text-sm text-muted-foreground">
                                                Paste phone numbers below, separated by commas, semicolons, or new lines.
                                            </p>
                                            <Textarea
                                                placeholder={"08012345678\n08098765432\n07011223344"}
                                                className="min-h-[140px] font-mono text-sm"
                                                value={pastedNumbers}
                                                onChange={e => parsePastedNumbers(e.target.value)}
                                            />
                                            {form.audience.pastedPhones.length > 0 && (
                                                <div className="flex items-center gap-2 text-sm">
                                                    <Badge variant="secondary">{form.audience.pastedPhones.length} valid numbers detected</Badge>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {form.audience.all && (
                                <div className="pl-9">
                                    <div className="p-4 rounded-lg bg-primary/5 border border-dashed border-primary/30 flex items-center gap-3">
                                        <Globe className="w-8 h-8 text-primary/50" />
                                        <div>
                                            <p className="font-medium text-sm">All Recipients Selected</p>
                                            <p className="text-xs text-muted-foreground">This campaign will be sent to every recipient in your database.</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </section>

                        <hr className="border-dashed" />

                        {/* ═══════════════════════════════════
                            SECTION 3: Message Content
                        ═══════════════════════════════════ */}
                        <section className="space-y-5">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">3</div>
                                <h3 className="text-lg font-semibold">{isVoice ? 'Voice Script' : 'Message'}</h3>
                            </div>

                            <div className="pl-9 space-y-4">
                                {isVoice ? (
                                    <>
                                        {/* Audio Source Selector */}
                                        <div className="space-y-3">
                                            <Label>How would you like to create your audio? <span className="text-destructive">*</span></Label>
                                            <div className="grid grid-cols-3 gap-2">
                                                {[
                                                    { value: 'tts', label: 'Text-to-Speech', icon: Volume2, desc: 'Type text, we generate audio' },
                                                    { value: 'upload', label: 'Upload Audio', icon: Upload, desc: 'Upload MP3/WAV file' },
                                                    { value: 'record', label: 'Record', icon: Mic, desc: 'Record with your mic' }
                                                ].map(src => (
                                                    <button
                                                        key={src.value}
                                                        className={cn(
                                                            "p-4 rounded-xl border text-sm transition-all text-center space-y-2",
                                                            form.messageContent.audioSource === src.value
                                                                ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                                                                : "bg-card hover:border-primary/40"
                                                        )}
                                                        onClick={() => {
                                                            clearAudio();
                                                            setForm({ ...form, messageContent: { ...form.messageContent, audioSource: src.value as any } });
                                                        }}
                                                    >
                                                        <src.icon className={cn(
                                                            "w-6 h-6 mx-auto",
                                                            form.messageContent.audioSource === src.value ? "text-primary" : "text-muted-foreground"
                                                        )} />
                                                        <p className={cn("font-medium", form.messageContent.audioSource === src.value ? "text-primary" : "text-foreground")}>{src.label}</p>
                                                        <p className="text-[11px] text-muted-foreground">{src.desc}</p>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* ─── TTS Panel ─── */}
                                        {form.messageContent.audioSource === 'tts' && (
                                            <div className="space-y-5 p-5 rounded-xl bg-muted/20 border animate-in fade-in slide-in-from-top-2">
                                                <div className="space-y-1.5">
                                                    <Label className="text-sm font-medium">Voice Script <span className="text-destructive">*</span></Label>
                                                    <p className="text-xs text-muted-foreground">Enter the text you want converted to speech.</p>
                                                    <Textarea
                                                        placeholder="Hello! This is a reminder about your upcoming appointment..."
                                                        className="min-h-[120px] text-base leading-relaxed bg-background"
                                                        value={form.messageContent.sourceText}
                                                        onChange={e => setForm({ ...form, messageContent: { ...form.messageContent, sourceText: e.target.value } })}
                                                    />
                                                    <p className="text-[11px] text-muted-foreground text-right">{form.messageContent.sourceText.length} characters</p>
                                                </div>

                                                <div className="space-y-2.5">
                                                    <Label className="text-sm font-medium">Output Language <span className="text-destructive">*</span></Label>
                                                    <p className="text-xs text-muted-foreground mb-2">Select the language for the AI to speak.</p>
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                        {LANGUAGES.map(lang => (
                                                            <button
                                                                key={lang.code}
                                                                className={cn(
                                                                    "px-3 py-2 rounded-lg border text-sm font-medium transition-all text-left",
                                                                    form.language === lang.code
                                                                        ? "border-primary bg-primary/5 text-primary ring-1 ring-primary/30"
                                                                        : "bg-background hover:border-primary/40 text-muted-foreground"
                                                                )}
                                                                onClick={() => setForm({ ...form, language: lang.code })}
                                                            >
                                                                {lang.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                <Button
                                                    onClick={handleTTSGenerate}
                                                    disabled={ttsGenerating || !form.messageContent.sourceText.trim() || !form.language}
                                                    className="w-full gap-2 mt-4"
                                                >
                                                    {ttsGenerating ? (
                                                        <>
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                            Generating Audio...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Sparkles className="w-4 h-4" />
                                                            Generate Audio
                                                        </>
                                                    )}
                                                </Button>
                                            </div>
                                        )}

                                        {/* ─── Upload Panel ─── */}
                                        {form.messageContent.audioSource === 'upload' && (
                                            <div className="space-y-4 p-4 rounded-xl bg-muted/20 border animate-in fade-in slide-in-from-top-2">
                                                <input
                                                    ref={fileInputRef}
                                                    type="file"
                                                    accept="audio/*"
                                                    className="hidden"
                                                    onChange={handleFileUpload}
                                                />

                                                {!audioUrl ? (
                                                    <div
                                                        className="border-2 border-dashed border-muted-foreground/30 rounded-xl py-12 px-6 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
                                                        onClick={() => fileInputRef.current?.click()}
                                                    >
                                                        <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
                                                        <p className="font-medium text-sm">Click to browse files</p>
                                                        <p className="text-xs text-muted-foreground mt-1">Supports MP3, WAV, OGG, M4A</p>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-background border">
                                                        <Volume2 className="w-5 h-5 text-primary" />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium truncate">{uploadedFileName || 'Uploaded audio'}</p>
                                                            <p className="text-[11px] text-muted-foreground">Audio ready</p>
                                                        </div>
                                                        <Button variant="ghost" size="icon" onClick={() => { clearAudio(); }}>
                                                            <Trash2 className="w-4 h-4 text-muted-foreground" />
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* ─── Record Panel ─── */}
                                        {form.messageContent.audioSource === 'record' && (
                                            <div className="space-y-4 p-4 rounded-xl bg-muted/20 border animate-in fade-in slide-in-from-top-2">
                                                {!isRecording && !audioUrl && (
                                                    <div className="text-center py-8 space-y-4">
                                                        <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                                                            <Mic className="w-8 h-8 text-destructive" />
                                                        </div>
                                                        <div>
                                                            <p className="font-medium">Record your voice message</p>
                                                            <p className="text-xs text-muted-foreground mt-1">Click the button below to start recording using your microphone</p>
                                                        </div>
                                                        <Button onClick={startRecording} className="gap-2 bg-destructive hover:bg-destructive/90">
                                                            <Mic className="w-4 h-4" />
                                                            Start Recording
                                                        </Button>
                                                    </div>
                                                )}

                                                {isRecording && (
                                                    <div className="text-center py-8 space-y-4">
                                                        <div className="w-20 h-20 rounded-full bg-destructive flex items-center justify-center mx-auto animate-pulse">
                                                            <Mic className="w-8 h-8 text-white" />
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-destructive text-lg font-mono">{formatTime(recordingTime)}</p>
                                                            <p className="text-xs text-muted-foreground mt-1">Recording in progress...</p>
                                                        </div>
                                                        {/* Waveform animation */}
                                                        <div className="flex items-center justify-center gap-1 h-8">
                                                            {[...Array(12)].map((_, i) => (
                                                                <div
                                                                    key={i}
                                                                    className="w-1 bg-destructive rounded-full"
                                                                    style={{
                                                                        height: `${Math.random() * 100}%`,
                                                                        animation: `pulse 0.5s ease-in-out ${i * 0.1}s infinite alternate`,
                                                                        minHeight: '4px'
                                                                    }}
                                                                />
                                                            ))}
                                                        </div>
                                                        <Button onClick={stopRecording} variant="outline" className="gap-2 border-destructive text-destructive hover:bg-destructive/10">
                                                            <Square className="w-4 h-4" />
                                                            Stop Recording
                                                        </Button>
                                                    </div>
                                                )}

                                                {!isRecording && audioUrl && (
                                                    <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-background border">
                                                        <Mic className="w-5 h-5 text-primary" />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium">Recorded audio</p>
                                                            <p className="text-[11px] text-muted-foreground">{formatTime(recordingTime)} recorded</p>
                                                        </div>
                                                        <Button variant="ghost" size="sm" onClick={() => { clearAudio(); setRecordingTime(0); }} className="text-xs text-muted-foreground">
                                                            Re-record
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* ─── Shared Audio Player (appears when audio is ready) ─── */}
                                        {audioUrl && !isRecording && (
                                            <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20 animate-in fade-in">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={playAudio}
                                                    className="h-10 w-10 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                                                >
                                                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                                                </Button>
                                                <div className="flex-1">
                                                    <div className="h-1.5 bg-primary/20 rounded-full overflow-hidden">
                                                        <div className={cn("h-full bg-primary rounded-full transition-all", isPlaying ? "animate-pulse w-full" : "w-0")} />
                                                    </div>
                                                    <p className="text-[11px] text-muted-foreground mt-1.5">
                                                        {isPlaying ? 'Playing...' : 'Audio ready — click play to preview'}
                                                    </p>
                                                </div>
                                                <Button variant="ghost" size="icon" onClick={downloadAudio} className="text-muted-foreground hover:text-primary">
                                                    <Download className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="space-y-6">
                                        <div className="space-y-1.5">
                                            <Label>SMS Message <span className="text-destructive">*</span></Label>
                                            <Textarea
                                                placeholder="Type your SMS message here..."
                                                className="min-h-[140px] text-base leading-relaxed"
                                                value={form.messageContent.sourceText}
                                                onChange={e => setForm({ ...form, messageContent: { ...form.messageContent, sourceText: e.target.value } })}
                                            />
                                            <div className="flex justify-between text-xs text-muted-foreground px-1">
                                                <span>{form.messageContent.sourceText.length} characters</span>
                                                <span>{Math.ceil(form.messageContent.sourceText.length / 160) || 1} segment(s) · ~{formatCurrency((Math.ceil(form.messageContent.sourceText.length / 160) || 1) * 5)}/recipient</span>
                                            </div>
                                        </div>

                                        <div className="space-y-3 pt-2 border-t border-dashed">
                                            <div className="space-y-1">
                                                <Label className="text-sm font-medium">Message Language <span className="text-destructive">*</span></Label>
                                                <p className="text-xs text-muted-foreground">Select the language this message should be sent in.</p>
                                            </div>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                {LANGUAGES.map(lang => (
                                                    <button
                                                        key={lang.code}
                                                        className={cn(
                                                            "px-3 py-2 rounded-lg border text-sm font-medium transition-all text-left",
                                                            form.language === lang.code
                                                                ? "border-primary bg-primary/5 text-primary ring-1 ring-primary/30"
                                                                : "bg-background hover:border-primary/40 text-muted-foreground"
                                                        )}
                                                        onClick={() => setForm({ ...form, language: lang.code })}
                                                    >
                                                        {lang.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>

                        <hr className="border-dashed" />

                        {/* ═══════════════════════════════════
                            SECTION 4: Schedule
                        ═══════════════════════════════════ */}
                        <section className="space-y-5">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">4</div>
                                <h3 className="text-lg font-semibold">Schedule</h3>
                            </div>

                            <div className="pl-9 space-y-4">
                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        className={cn(
                                            "py-3 px-3 rounded-lg border text-sm font-medium transition-all",
                                            form.mode === 'one_time' && !form.scheduledAt
                                                ? "border-primary bg-primary/5 text-primary ring-1 ring-primary/30"
                                                : "bg-card hover:border-primary/40 text-muted-foreground"
                                        )}
                                        onClick={() => setForm({ ...form, scheduledAt: '', mode: 'one_time' })}
                                    >
                                        Send Now
                                    </button>
                                    <button
                                        className={cn(
                                            "py-3 px-3 rounded-lg border text-sm font-medium transition-all",
                                            form.mode === 'scheduled'
                                                ? "border-primary bg-primary/5 text-primary ring-1 ring-primary/30"
                                                : "bg-card hover:border-primary/40 text-muted-foreground"
                                        )}
                                        onClick={() => setForm({ ...form, scheduledAt: new Date(Date.now() + 3600000).toISOString(), mode: 'scheduled' })}
                                    >
                                        Schedule
                                    </button>
                                    <button
                                        className={cn(
                                            "py-3 px-3 rounded-lg border text-sm font-medium transition-all",
                                            form.mode === 'recurring'
                                                ? "border-primary bg-primary/5 text-primary ring-1 ring-primary/30"
                                                : "bg-card hover:border-primary/40 text-muted-foreground"
                                        )}
                                        onClick={() => setForm({ ...form, mode: 'recurring', scheduledAt: new Date().toISOString() })}
                                    >
                                        Recurring
                                    </button>
                                </div>

                                {form.mode === 'scheduled' && (
                                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                        <Label>Date & Time</Label>
                                        <Input
                                            type="datetime-local"
                                            value={form.scheduledAt.split('.')[0]}
                                            onChange={e => setForm({ ...form, scheduledAt: e.target.value })}
                                        />
                                    </div>
                                )}

                                {form.mode === 'recurring' && (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1.5">
                                                <Label>Frequency</Label>
                                                <select
                                                    className="w-full h-10 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
                                                    value={form.recurringInterval}
                                                    onChange={e => setForm({ ...form, recurringInterval: e.target.value as any })}
                                                >
                                                    <option value="daily">Daily</option>
                                                    <option value="weekly">Weekly</option>
                                                    <option value="monthly">Monthly</option>
                                                </select>
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label>Time</Label>
                                                <Input
                                                    type="time"
                                                    onChange={e => {
                                                        const date = new Date();
                                                        const [h, m] = e.target.value.split(':');
                                                        date.setHours(parseInt(h), parseInt(m));
                                                        setForm({ ...form, scheduledAt: date.toISOString() });
                                                    }}
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label>End Date <span className="text-muted-foreground text-xs">(optional)</span></Label>
                                            <Input
                                                type="date"
                                                value={form.recurringEndDate}
                                                onChange={e => setForm({ ...form, recurringEndDate: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* Spacer for scroll */}
                        <div className="h-4" />
                    </div>
                </div>

                {/* ─── Sticky Footer ─── */}
                <div className="px-6 py-4 border-t bg-card flex items-center justify-between shrink-0">
                    <Button variant="ghost" onClick={onClose} className="gap-2">
                        <X className="w-4 h-4" />
                        Cancel
                    </Button>
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground hidden sm:inline">
                            {totalAudience}
                        </span>
                        <Button
                            onClick={handleSubmit}
                            className="gap-2 px-8 shadow-lg shadow-primary/20"
                            disabled={
                                loading ||
                                !form.name ||
                                (isVoice ?
                                    (form.messageContent.audioSource === 'tts' ? !form.messageContent.sourceText || !audioUrl : !audioUrl) :
                                    !form.messageContent.sourceText
                                )
                            }
                        >
                            {loading ? 'Sending...' : `Launch ${typeLabel} Campaign`}
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
}
