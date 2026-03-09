import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Phone } from 'lucide-react';

export function SignupPage() {
    const { signup } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({ email: '', password: '', name: '', organizationName: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await signup(form);
            navigate('/');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Signup failed');
        } finally {
            setLoading(false);
        }
    };

    const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm((prev) => ({ ...prev, [field]: e.target.value }));

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-violet-50 to-indigo-50 p-4">
            <div className="w-full max-w-md animate-fade-in">
                <div className="flex items-center justify-center gap-3 mb-8">
                    <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-violet-600 text-white shadow-lg shadow-primary/30">
                        <Phone className="w-6 h-6" />
                    </div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-violet-600 bg-clip-text text-transparent">
                        RemindMe
                    </h1>
                </div>

                <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
                    <CardHeader className="text-center">
                        <CardTitle className="text-xl">Create your account</CardTitle>
                        <CardDescription>Register your organization to get started</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {error && (
                                <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-lg">{error}</div>
                            )}
                            <div className="space-y-2">
                                <Label htmlFor="orgName">Organization Name</Label>
                                <Input id="orgName" placeholder="Acme Corp" value={form.organizationName} onChange={update('organizationName')} required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="name">Your Name</Label>
                                <Input id="name" placeholder="John Doe" value={form.name} onChange={update('name')} required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input id="email" type="email" placeholder="admin@company.com" value={form.email} onChange={update('email')} required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password">Password</Label>
                                <Input id="password" type="password" placeholder="Min 8 characters" value={form.password} onChange={update('password')} required minLength={8} />
                            </div>
                            <Button type="submit" className="w-full" disabled={loading}>
                                {loading ? 'Creating account...' : 'Create account'}
                            </Button>
                        </form>

                        <p className="text-center text-sm text-muted-foreground mt-4">
                            Already have an account?{' '}
                            <Link to="/login" className="text-primary font-medium hover:underline">
                                Sign in
                            </Link>
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
