import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import { formatDate, formatCurrency } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Megaphone, Trash2, Check, ChevronRight, Clock, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CampaignWizard } from '@/components/CampaignWizard';

interface Campaign {
    id: string;
    name: string;
    description: string | null;
    type: 'sms' | 'voice';
    mode: 'one_time' | 'scheduled' | 'recurring';
    status: 'draft' | 'scheduled' | 'sending' | 'completed' | 'cancelled';
    audience: any;
    totalCost: string;
    createdAt: string;
}

interface CampaignsPageProps {
    campaignType: 'sms' | 'voice';
}

export function CampaignsPage({ campaignType }: CampaignsPageProps) {
    const navigate = useNavigate();
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [showForm, setShowForm] = useState(false);
    const [loading, setLoading] = useState(true);

    const isVoice = campaignType === 'voice';
    const typeLabel = isVoice ? 'Voice' : 'SMS';

    const fetchCampaigns = async () => {
        setLoading(true);
        try {
            const res = await api.get('/campaigns');
            setCampaigns(res.data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchCampaigns(); }, []);

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this campaign?')) return;
        try {
            await api.delete(`/campaigns/${id}`);
            fetchCampaigns();
        } catch (err: any) {
            alert(err.response?.data?.error || 'Failed');
        }
    };

    const filtered = campaigns.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
        const matchesType = c.type === campaignType;
        return matchesSearch && matchesStatus && matchesType;
    });

    const getStatusVariant = (status: Campaign['status']) => {
        switch (status) {
            case 'completed': return 'success';
            case 'sending': return 'warning';
            case 'scheduled': return 'default';
            case 'cancelled': return 'destructive';
            default: return 'secondary';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">{typeLabel} Campaigns</h1>
                    <p className="text-muted-foreground">
                        {isVoice ? 'Manage your voice call broadcasts' : 'Manage your SMS message broadcasts'}
                    </p>
                </div>
                <Button onClick={() => setShowForm(true)} className="gap-2">
                    <Plus className="w-4 h-4" />New {typeLabel} Campaign
                </Button>
            </div>

            {showForm && (
                <CampaignWizard
                    campaignType={campaignType}
                    onClose={() => setShowForm(false)}
                    onSuccess={() => {
                        setShowForm(false);
                        fetchCampaigns();
                    }}
                />
            )}

            <Card className="bg-muted/30 border-none">
                <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                        <Input
                            placeholder={`Search ${typeLabel.toLowerCase()} campaigns...`}
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="bg-background"
                        />
                    </div>
                    <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                    >
                        <option value="all">All Statuses</option>
                        <option value="draft">Draft</option>
                        <option value="scheduled">Scheduled</option>
                        <option value="sending">Sending</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                </CardContent>
            </Card>

            {loading ? (
                <div className="space-y-4">
                    {[1, 2, 3].map(i => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}
                </div>
            ) : filtered.length === 0 ? (
                <Card>
                    <CardContent className="py-20 text-center">
                        {isVoice
                            ? <Megaphone className="w-12 h-12 mx-auto mb-4 opacity-20" />
                            : <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        }
                        <h3 className="text-lg font-semibold">No {typeLabel.toLowerCase()} campaigns found</h3>
                        <p className="text-muted-foreground">Start by creating your first {typeLabel.toLowerCase()} broadcast.</p>
                        <Button variant="outline" className="mt-4" onClick={() => setShowForm(true)}>
                            Create {typeLabel} Campaign
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-muted/50 text-muted-foreground font-medium border-b">
                            <tr>
                                <th className="px-6 py-4">Campaign Name</th>
                                <th className="px-6 py-4">Mode</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Cost</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {filtered.map((c) => (
                                <tr key={c.id} className="hover:bg-muted/30 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="font-semibold">{c.name}</div>
                                        <div className="text-xs text-muted-foreground mt-0.5">{formatDate(c.createdAt)}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-1 text-xs capitalize">
                                            {c.mode === 'recurring' ? <Clock className="w-3 h-3 text-primary" /> : <Check className="w-3 h-3 text-muted-foreground" />}
                                            {c.mode.replace('_', ' ')}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <Badge variant={getStatusVariant(c.status)} className="capitalize">
                                            {c.status}
                                        </Badge>
                                    </td>
                                    <td className="px-6 py-4 font-mono font-medium">
                                        {formatCurrency(Number(c.totalCost || 0))}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button variant="ghost" size="icon" onClick={() => navigate(`/campaigns/${c.id}`)}>
                                                <ChevronRight className="w-4 h-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}>
                                                <Trash2 className="w-4 h-4 text-destructive" />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
