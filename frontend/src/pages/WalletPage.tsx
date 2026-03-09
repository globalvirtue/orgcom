import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Wallet as WalletIcon, ArrowUpCircle, ArrowDownCircle, CreditCard, Banknote } from 'lucide-react';

interface Transaction {
    id: string;
    type: 'credit' | 'debit';
    amount: string;
    description: string | null;
    reference: string | null;
    createdAt: string;
}

export function WalletPage() {
    const { user } = useAuth();
    const [balance, setBalance] = useState(0);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [amount, setAmount] = useState('');
    const [loading, setLoading] = useState(true);
    const [funding, setFunding] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [bRes, tRes] = await Promise.all([
                api.get('/wallet/balance'),
                api.get('/wallet/transactions'),
            ]);
            setBalance(bRes.data.balance);
            setTransactions(tRes.data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, []);

    const handleFund = async (e: React.FormEvent) => {
        e.preventDefault();
        const amt = parseFloat(amount);
        if (!amt || amt <= 0) return;
        setFunding(true);
        try {
            const res = await api.post('/wallet/fund', { amount: amt });
            if (res.data.url) {
                window.location.href = res.data.url;
            } else {
                // Mocked mode
                alert(`Wallet credited with ${formatCurrency(amt)} (mock mode)`);
                setAmount('');
                fetchData();
            }
        } catch (err: any) {
            alert(err.response?.data?.error || 'Funding failed');
        } finally {
            setFunding(false);
        }
    };

    const isAdmin = user?.role === 'admin';

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Wallet</h1>
                <p className="text-muted-foreground">Manage your balance and track transactions</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Balance Card */}
                <Card className="md:col-span-1 bg-gradient-to-br from-primary to-violet-600 text-white border-0">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                                <WalletIcon className="w-5 h-5" />
                            </div>
                            <p className="text-white/80 text-sm font-medium">Current Balance</p>
                        </div>
                        <p className="text-3xl font-bold">{formatCurrency(balance)}</p>
                        <p className="text-white/60 text-xs mt-2">{transactions.length} total transactions</p>
                    </CardContent>
                </Card>

                {/* Fund Wallet */}
                {isAdmin && (
                    <Card className="md:col-span-2">
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <CreditCard className="w-4 h-4" />
                                Fund Wallet
                            </CardTitle>
                            <CardDescription>Add funds via Kora Pay to pay for voice calls</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleFund} className="flex gap-3 items-end">
                                <div className="flex-1 space-y-2">
                                    <Label>Amount (NGN)</Label>
                                    <div className="relative">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground italic">₦</div>
                                        <Input
                                            type="number"
                                            min="1"
                                            step="0.01"
                                            placeholder="50.00"
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                            className="pl-8"
                                            required
                                        />
                                    </div>
                                </div>
                                <Button type="submit" disabled={funding}>
                                    {funding ? 'Processing...' : 'Add Funds'}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Transactions */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Transaction History</CardTitle>
                </CardHeader>
                <CardContent>
                    {transactions.length === 0 ? (
                        <div className="text-center text-muted-foreground py-12">
                            <WalletIcon className="w-12 h-12 mx-auto mb-4 opacity-30" />
                            <p>No transactions yet. Fund your wallet to get started.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {transactions.map((t) => (
                                <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${t.type === 'credit' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                                        }`}>
                                        {t.type === 'credit' ? <ArrowUpCircle className="w-4 h-4" /> : <ArrowDownCircle className="w-4 h-4" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium">{t.description || 'Transaction'}</p>
                                        <p className="text-xs text-muted-foreground">{formatDate(t.createdAt)}</p>
                                    </div>
                                    <p className={`font-semibold ${t.type === 'credit' ? 'text-emerald-600' : 'text-red-600'}`}>
                                        {t.type === 'credit' ? '+' : '-'}{formatCurrency(parseFloat(t.amount))}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
