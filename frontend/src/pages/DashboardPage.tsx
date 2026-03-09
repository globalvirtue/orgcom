import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Phone, CheckCircle, XCircle, Clock, DollarSign, TrendingUp, BarChart3 } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend,
} from 'recharts';

interface Overview {
    totalCalls: number;
    answeredCalls: number;
    failedCalls: number;
    answerRate: number;
    avgDuration: number;
    totalCost: number;
}

interface CampaignSummary {
    id: string;
    name: string;
    status: string;
    totalCalls: number;
    answeredCalls: number;
    answerRate: number;
    totalCost: number;
    languageBreakdown: Record<string, { total: number; answered: number }>;
}

const COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#e9d5ff', '#f3e8ff'];

export function DashboardPage() {
    const [overview, setOverview] = useState<Overview | null>(null);
    const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);

            const [overviewRes, campaignsRes] = await Promise.all([
                api.get(`/dashboard/overview?${params}`),
                api.get('/dashboard/campaigns'),
            ]);
            setOverview(overviewRes.data);
            setCampaigns(campaignsRes.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const statsCards = overview ? [
        { label: 'Total Calls', value: overview.totalCalls, icon: Phone, color: 'text-indigo-600', bg: 'bg-indigo-50' },
        { label: 'Answered', value: overview.answeredCalls, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { label: 'Failed', value: overview.failedCalls, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
        { label: 'Answer Rate', value: formatPercent(overview.answerRate), icon: TrendingUp, color: 'text-violet-600', bg: 'bg-violet-50' },
        { label: 'Avg Duration', value: `${overview.avgDuration}s`, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
        { label: 'Total Cost', value: formatCurrency(overview.totalCost), icon: DollarSign, color: 'text-cyan-600', bg: 'bg-cyan-50' },
    ] : [];

    const pieData = overview ? [
        { name: 'Answered', value: overview.answeredCalls },
        { name: 'Failed', value: overview.failedCalls },
    ].filter(d => d.value > 0) : [];

    const barData = campaigns.map((c) => ({
        name: c.name.length > 15 ? c.name.substring(0, 15) + '...' : c.name,
        calls: c.totalCalls,
        answered: c.answeredCalls,
        cost: c.totalCost,
    }));

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-pulse-soft text-muted-foreground">Loading dashboard...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Dashboard</h1>
                    <p className="text-muted-foreground">Overview of your voice messaging performance</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2">
                        <Label className="text-xs whitespace-nowrap">From</Label>
                        <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-36 h-8 text-xs" />
                    </div>
                    <div className="flex items-center gap-2">
                        <Label className="text-xs whitespace-nowrap">To</Label>
                        <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-36 h-8 text-xs" />
                    </div>
                    <Button size="sm" onClick={fetchData}>Filter</Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {statsCards.map((stat, i) => (
                    <Card key={i} className="animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${stat.bg}`}>
                                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                                    <p className="text-lg font-bold">{stat.value}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Campaign Performance */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <BarChart3 className="w-4 h-4" />
                            Campaign Performance
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {barData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={barData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                    <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                                    <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                                    <Tooltip
                                        contentStyle={{
                                            background: 'hsl(var(--card))',
                                            border: '1px solid hsl(var(--border))',
                                            borderRadius: '8px',
                                            fontSize: '12px',
                                        }}
                                    />
                                    <Bar dataKey="calls" fill="#6366f1" radius={[4, 4, 0, 0]} name="Total Calls" />
                                    <Bar dataKey="answered" fill="#10b981" radius={[4, 4, 0, 0]} name="Answered" />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
                                No campaign data yet. Create campaigns and send messages to see analytics.
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Call Outcomes */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Call Outcomes</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {pieData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={280}>
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={100}
                                        paddingAngle={4}
                                        dataKey="value"
                                    >
                                        {pieData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : '#ef4444'} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
                                No call data yet. Send voice messages to see outcomes.
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Campaign Table */}
            {campaigns.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Campaign Summaries</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left py-3 px-2 font-medium text-muted-foreground">Campaign</th>
                                        <th className="text-left py-3 px-2 font-medium text-muted-foreground">Status</th>
                                        <th className="text-right py-3 px-2 font-medium text-muted-foreground">Calls</th>
                                        <th className="text-right py-3 px-2 font-medium text-muted-foreground">Answered</th>
                                        <th className="text-right py-3 px-2 font-medium text-muted-foreground">Rate</th>
                                        <th className="text-right py-3 px-2 font-medium text-muted-foreground">Cost</th>
                                        <th className="text-left py-3 px-2 font-medium text-muted-foreground">Languages</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {campaigns.map((c) => (
                                        <tr key={c.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                                            <td className="py-3 px-2 font-medium">{c.name}</td>
                                            <td className="py-3 px-2">
                                                <Badge variant={c.status === 'active' ? 'success' : 'secondary'}>{c.status}</Badge>
                                            </td>
                                            <td className="py-3 px-2 text-right">{c.totalCalls}</td>
                                            <td className="py-3 px-2 text-right">{c.answeredCalls}</td>
                                            <td className="py-3 px-2 text-right">{formatPercent(c.answerRate)}</td>
                                            <td className="py-3 px-2 text-right">{formatCurrency(c.totalCost)}</td>
                                            <td className="py-3 px-2">
                                                <div className="flex flex-wrap gap-1">
                                                    {Object.keys(c.languageBreakdown).map((lang) => (
                                                        <Badge key={lang} variant="outline" className="text-xs">{lang}</Badge>
                                                    ))}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
