import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from './api';

interface User {
    id: string;
    email: string;
    name: string;
    role: 'admin' | 'campaign_manager' | 'viewer';
}

interface Organization {
    id: string;
    name: string;
    defaultLanguage?: string;
    timezone?: string;
}

interface AuthContextType {
    user: User | null;
    organization: Organization | null;
    token: string | null;
    login: (email: string, password: string) => Promise<void>;
    signup: (data: SignupData) => Promise<void>;
    logout: () => void;
    loading: boolean;
}

interface SignupData {
    email: string;
    password: string;
    name: string;
    organizationName: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [organization, setOrganization] = useState<Organization | null>(null);
    const [token, setToken] = useState<string | null>(localStorage.getItem('remindme_token'));
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (token) {
            api.get('/auth/me')
                .then((res) => {
                    setUser(res.data.user);
                    setOrganization(res.data.organization);
                })
                .catch(() => {
                    localStorage.removeItem('remindme_token');
                    setToken(null);
                })
                .finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, [token]);

    const login = async (email: string, password: string) => {
        const res = await api.post('/auth/login', { email, password });
        localStorage.setItem('remindme_token', res.data.token);
        setToken(res.data.token);
        setUser(res.data.user);
        setOrganization(res.data.organization);
    };

    const signup = async (data: SignupData) => {
        const res = await api.post('/auth/signup', data);
        localStorage.setItem('remindme_token', res.data.token);
        setToken(res.data.token);
        setUser(res.data.user);
        setOrganization(res.data.organization);
    };

    const logout = () => {
        localStorage.removeItem('remindme_token');
        setToken(null);
        setUser(null);
        setOrganization(null);
    };

    return (
        <AuthContext.Provider value={{ user, organization, token, login, signup, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
}
