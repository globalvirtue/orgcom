import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Settings, UserPlus, Shield, Mail, Copy } from 'lucide-react';

interface OrgUser {
    id: string;
    email: string;
    name: string;
    role: string;
    createdAt: string;
}

export function SettingsPage() {
    const { user, organization } = useAuth();
    const [users, setUsers] = useState<OrgUser[]>([]);
    const [showInvite, setShowInvite] = useState(false);
    const [inviteForm, setInviteForm] = useState({ email: '', role: 'campaign_manager' });
    const [inviteResult, setInviteResult] = useState<{ token: string; email: string } | null>(null);
    const [loading, setLoading] = useState(true);

    const isAdmin = user?.role === 'admin';

    const fetchUsers = async () => {
        if (!isAdmin) { setLoading(false); return; }
        try {
            const res = await api.get('/auth/users');
            setUsers(res.data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchUsers(); }, []);

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await api.post('/auth/invite', inviteForm);
            setInviteResult(res.data);
            setInviteForm({ email: '', role: 'campaign_manager' });
            fetchUsers();
        } catch (err: any) {
            alert(err.response?.data?.error || 'Invite failed');
        }
    };

    const copyToken = (token: string) => {
        navigator.clipboard.writeText(token);
        alert('Token copied to clipboard!');
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Settings</h1>
                <p className="text-muted-foreground">Organization settings and user management</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Organization Info */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Settings className="w-4 h-4" />
                            Organization
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs text-muted-foreground">Name</p>
                                <p className="font-medium">{organization?.name}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Default Language</p>
                                <p className="font-medium">{organization?.defaultLanguage || 'en'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Timezone</p>
                                <p className="font-medium">{organization?.timezone || 'Africa/Lagos'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Your Role</p>
                                <Badge variant="default" className="capitalize">{user?.role}</Badge>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Your Profile */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Shield className="w-4 h-4" />
                            Your Profile
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div>
                            <p className="text-xs text-muted-foreground">Name</p>
                            <p className="font-medium">{user?.name}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Email</p>
                            <p className="font-medium">{user?.email}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* User Management (Admin only) */}
            {isAdmin && (
                <>
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold">Team Members</h2>
                        <Button onClick={() => setShowInvite(!showInvite)}>
                            <UserPlus className="w-4 h-4 mr-2" />Invite User
                        </Button>
                    </div>

                    {showInvite && (
                        <Card className="animate-fade-in">
                            <CardContent className="pt-6">
                                <form onSubmit={handleInvite} className="flex flex-wrap gap-4 items-end">
                                    <div className="flex-1 space-y-2">
                                        <Label>Email</Label>
                                        <Input
                                            type="email"
                                            placeholder="user@company.com"
                                            value={inviteForm.email}
                                            onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Role</Label>
                                        <select
                                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                                            value={inviteForm.role}
                                            onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                                        >
                                            <option value="admin">Admin</option>
                                            <option value="campaign_manager">Campaign Manager</option>
                                            <option value="viewer">Viewer</option>
                                        </select>
                                    </div>
                                    <Button type="submit">Send Invite</Button>
                                </form>

                                {inviteResult && (
                                    <div className="mt-4 p-3 bg-muted rounded-lg space-y-2">
                                        <p className="text-sm">
                                            <Mail className="w-4 h-4 inline mr-1" />
                                            Invitation created for <strong>{inviteResult.email}</strong>
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <code className="text-xs bg-background px-2 py-1 rounded border flex-1 truncate">{inviteResult.token}</code>
                                            <Button variant="outline" size="sm" onClick={() => copyToken(inviteResult.token)}>
                                                <Copy className="w-3 h-3 mr-1" />Copy
                                            </Button>
                                        </div>
                                        <p className="text-xs text-muted-foreground">Share this token with the user. They'll use it at /accept-invite.</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    <Card>
                        <CardContent className="pt-6">
                            <div className="space-y-2">
                                {users.map((u) => (
                                    <div key={u.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-violet-500 flex items-center justify-center text-white text-sm font-semibold">
                                            {u.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium">{u.name}</p>
                                            <p className="text-xs text-muted-foreground">{u.email}</p>
                                        </div>
                                        <Badge variant="outline" className="capitalize">{u.role}</Badge>
                                        <span className="text-xs text-muted-foreground">{formatDate(u.createdAt)}</span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}
