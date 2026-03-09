import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import {
    ChevronLeft, Megaphone, Users, Activity,
    BarChart3, Clock, AlertCircle, CheckCircle2,
    MessageSquare, Globe, ArrowUpRight, Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate, formatCurrency, cn } from '@/lib/utils';

interface CampaignDetail {
    id: string;
    name: string;
    description: string | null;
    type: 'sms' | 'voice';
    mode: 'one_time' | 'scheduled' | 'recurring';
    status: 'draft' | 'scheduled' | 'sending' | 'completed' | 'cancelled';
    audience: any;
    totalCost: string;
    scheduledAt: string | null;
    createdAt: string;
    messages: any[];
}

export function CampaignDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'recipients' | 'activity'>('overview');

    const fetchCampaign = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/campaigns/${id}`);
            setCampaign(res.data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchCampaign(); }, [id]);

    if (loading) return <div className="p-8 animate-pulse text-center">Loading campaign details...</div>;
    if (!campaign) return <div className="p-8 text-center text-destructive">Campaign not found</div>;

    const stats = {
        sent: 0,
        delivered: 0,
        failed: 0,
        pending: 0,
        rate: 85 // placeholder
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/campaigns')}>
                        <ChevronLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <h1 className="text-2xl font-bold">{campaign.name}</h1>
                            <Badge variant={campaign.status === 'completed' ? 'success' : 'default'} className="capitalize">
                                {campaign.status}
                            </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{campaign.description || 'No description provided'}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {campaign.status === 'draft' && <Button>Launch Now</Button>}
                    <Button variant="outline" className="text-destructive border-destructive/20 hover:bg-destructive/10">Cancel Campaign</Button>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total Recipients', value: campaign.messages?.[0]?.recipientCount || '...', icon: Users, color: 'text-primary' },
                    { label: 'Delivery Rate', value: `${stats.rate}%`, icon: BarChart3, color: 'text-emerald-500' },
                    { label: 'Total Spent', value: formatCurrency(Number(campaign.totalCost || 0)), icon: Globe, color: 'text-blue-500' },
                    { label: 'Created', value: formatDate(campaign.createdAt), icon: Clock, color: 'text-muted-foreground' }
                ].map((s, i) => (
                    <Card key={i} className="bg-card/50 shadow-none border-dashed border-2">
                        <CardContent className="p-4 flex items-center gap-4">
                            <div className={cn("p-2 rounded-lg bg-background border shadow-sm", s.color)}>
                                <s.icon className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">{s.label}</p>
                                <p className="text-lg font-bold truncate">{s.value}</p>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Tabs */}
            <div className="flex border-b gap-8">
                {[
                    { id: 'overview', label: 'Overview', icon: BarChart3 },
                    { id: 'recipients', label: 'Recipients', icon: Users },
                    { id: 'activity', label: 'Activity Log', icon: Activity },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={cn(
                            "flex items-center gap-2 py-4 px-1 text-sm font-medium transition-all border-b-2",
                            activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="py-2">
                {activeTab === 'overview' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <Card className="lg:col-span-2">
                            <CardHeader>
                                <CardTitle className="text-sm font-medium">Message Performance</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Delivery Status</span>
                                        <span className="font-medium">{stats.rate}% Success</span>
                                    </div>
                                    <div className="h-4 bg-muted rounded-full overflow-hidden flex">
                                        <div className="bg-emerald-500 h-full" style={{ width: '85%' }} />
                                        <div className="bg-orange-400 h-full" style={{ width: '10%' }} />
                                        <div className="bg-destructive h-full" style={{ width: '5%' }} />
                                    </div>
                                    <div className="flex gap-4 pt-1">
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500" /> Delivered
                                        </div>
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                            <div className="w-2 h-2 rounded-full bg-orange-400" /> Pending
                                        </div>
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                            <div className="w-2 h-2 rounded-full bg-destructive" /> Failed
                                        </div>
                                    </div>
                                </div>

                                <div className="border-t pt-6">
                                    <h4 className="text-sm font-medium mb-4 flex items-center gap-2">
                                        <MessageSquare className="w-4 h-4" />
                                        Broadcast Content
                                    </h4>
                                    <div className="space-y-4">
                                        <div className="p-4 bg-muted rounded-lg border">
                                            <p className="text-sm italic leading-relaxed">
                                                "{campaign.messages?.[0]?.sourceText}"
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <Badge variant="outline" className="bg-background">Source: {campaign.messages?.[0]?.sourceLanguage}</Badge>
                                            {campaign.messages?.[0]?.targetLanguages?.map((l: string) => (
                                                <Badge key={l} variant="secondary" className="capitalize">{l}</Badge>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm font-medium">Campaign Settings</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">Broadcast Type</span>
                                        <Badge variant="outline" className="uppercase">{campaign.type}</Badge>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">Execution Mode</span>
                                        <span className="font-medium capitalize">{campaign.mode.replace('_', ' ')}</span>
                                    </div>
                                    {campaign.scheduledAt && (
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-muted-foreground">Next Run</span>
                                            <span className="font-medium">{formatDate(campaign.scheduledAt)}</span>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            <Card className="bg-primary/5 border-primary/20">
                                <CardContent className="p-6">
                                    <div className="flex items-center gap-3 mb-2">
                                        <Sparkles className="w-5 h-5 text-primary" />
                                        <h4 className="font-bold">Pro Tip</h4>
                                    </div>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        This campaign uses neural translation for Hausa and Yoruba. Higher delivery rates are observed when localizing content for regional audiences.
                                    </p>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                )}

                {activeTab === 'recipients' && (
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="text-sm font-medium">Recipient Tracking</CardTitle>
                            <div className="flex items-center gap-2">
                                <Input placeholder="Search phone..." className="h-8 w-[200px]" />
                                <Button variant="outline" size="sm" className="h-8 gap-1">
                                    <Filter className="w-3 h-3" /> Filter
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-center py-20 text-muted-foreground">
                                <Users className="w-12 h-12 mx-auto mb-4 opacity-10" />
                                <p>Detailed recipient status will appear here as the campaign processes.</p>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {activeTab === 'activity' && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-medium">Broadcasting Lifecycle</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {[
                                { status: 'Broadcast Initialized', time: campaign.createdAt, detail: 'Campaign created and audience resolved.', icon: CheckCircle2, success: true },
                                { status: 'Translations Generated', time: campaign.createdAt, detail: 'Content translated to Igbo, Yoruba, Hausa.', icon: Globe, success: true },
                                { status: 'Scheduled for Release', time: campaign.scheduledAt || campaign.createdAt, detail: `Ready for delivery at ${formatDate(campaign.scheduledAt || campaign.createdAt)}`, icon: Clock, success: false },
                            ].map((log, i) => (
                                <div key={i} className="flex gap-4 group">
                                    <div className="flex flex-col items-center">
                                        <div className={cn(
                                            "w-8 h-8 rounded-full flex items-center justify-center shadow-sm",
                                            log.success ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
                                        )}>
                                            <log.icon className="w-4 h-4" />
                                        </div>
                                        {i < 2 && <div className="w-0.5 flex-1 bg-muted my-1" />}
                                    </div>
                                    <div className="flex-1 pb-6">
                                        <div className="flex justify-between items-start mb-1">
                                            <h4 className="font-semibold text-sm">{log.status}</h4>
                                            <span className="text-[10px] text-muted-foreground">{formatDate(log.time)}</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground">{log.detail}</p>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}

const Sparkles = (props: any) => (
    <svg
        {...props}
        xmlns="http://www.w3.org/2000/svg"
        width="24" height="24" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round"
    >
        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
        <path d="M5 3v4" />
        <path d="M19 17v4" />
        <path d="M3 5h4" />
        <path d="M17 19h4" />
    </svg>
);
