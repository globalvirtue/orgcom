import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import {
    LayoutDashboard, Users, Megaphone, MessageSquare,
    Wallet, Settings, LogOut, Menu, X, Phone, ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NavItem {
    path: string;
    label: string;
    icon: any;
    children?: { path: string; label: string; icon: any }[];
}

const navItems: NavItem[] = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/recipients', label: 'Recipients', icon: Users },
    {
        path: '/campaigns',
        label: 'Campaigns',
        icon: Megaphone,
        children: [
            { path: '/campaigns/sms', label: 'SMS Campaigns', icon: MessageSquare },
            { path: '/campaigns/voice', label: 'Voice Campaigns', icon: Megaphone },
        ],
    },
    { path: '/wallet', label: 'Wallet', icon: Wallet },
    { path: '/settings', label: 'Settings', icon: Settings },
];

export function Layout({ children }: { children: React.ReactNode }) {
    const { user, organization, logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = React.useState(false);
    const [expandedItems, setExpandedItems] = React.useState<string[]>(() => {
        // Auto-expand if we're on a child route
        return navItems
            .filter(item => item.children && location.pathname.startsWith(item.path))
            .map(item => item.path);
    });

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const toggleExpand = (path: string) => {
        setExpandedItems(prev =>
            prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
        );
    };

    return (
        <div className="flex h-screen overflow-hidden bg-background">
            {/* Sidebar */}
            <aside
                className={cn(
                    'fixed inset-y-0 left-0 z-50 w-64 transform bg-card border-r transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0',
                    sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                )}
            >
                <div className="flex flex-col h-full">
                    {/* Logo */}
                    <div className="flex items-center gap-3 px-6 py-5 border-b">
                        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary text-primary-foreground">
                            <Phone className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold bg-gradient-to-r from-primary to-violet-500 bg-clip-text text-transparent">
                                RemindMe
                            </h1>
                            <p className="text-xs text-muted-foreground truncate max-w-[150px]">{organization?.name}</p>
                        </div>
                    </div>

                    {/* Nav */}
                    <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                        {navItems.map((item) => {
                            if (item.children) {
                                const isExpanded = expandedItems.includes(item.path);
                                const isChildActive = item.children.some(
                                    c => location.pathname === c.path || location.pathname.startsWith(c.path + '/')
                                );
                                return (
                                    <div key={item.path}>
                                        <button
                                            onClick={() => toggleExpand(item.path)}
                                            className={cn(
                                                'w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                                                isChildActive
                                                    ? 'bg-primary/10 text-primary'
                                                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                                            )}
                                        >
                                            <div className="flex items-center gap-3">
                                                <item.icon className="w-4 h-4" />
                                                {item.label}
                                            </div>
                                            <ChevronDown className={cn(
                                                "w-4 h-4 transition-transform duration-200",
                                                isExpanded && "rotate-180"
                                            )} />
                                        </button>
                                        <div className={cn(
                                            "overflow-hidden transition-all duration-200",
                                            isExpanded ? "max-h-40 opacity-100 mt-1" : "max-h-0 opacity-0"
                                        )}>
                                            <div className="ml-4 pl-4 border-l space-y-1">
                                                {item.children.map(child => {
                                                    const isActive = location.pathname === child.path ||
                                                        location.pathname.startsWith(child.path + '/');
                                                    return (
                                                        <Link
                                                            key={child.path}
                                                            to={child.path}
                                                            onClick={() => setSidebarOpen(false)}
                                                            className={cn(
                                                                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                                                                isActive
                                                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                                                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                                                            )}
                                                        >
                                                            <child.icon className="w-3.5 h-3.5" />
                                                            {child.label}
                                                        </Link>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                );
                            }

                            const isActive = location.pathname === item.path ||
                                (item.path !== '/' && location.pathname.startsWith(item.path));
                            return (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    onClick={() => setSidebarOpen(false)}
                                    className={cn(
                                        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                                        isActive
                                            ? 'bg-primary text-primary-foreground shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                                    )}
                                >
                                    <item.icon className="w-4 h-4" />
                                    {item.label}
                                </Link>
                            );
                        })}
                    </nav>

                    {/* User */}
                    <div className="border-t p-4">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-violet-500 flex items-center justify-center text-white text-sm font-semibold">
                                {user?.name?.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{user?.name}</p>
                                <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
                            </div>
                        </div>
                        <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" onClick={handleLogout}>
                            <LogOut className="w-4 h-4 mr-2" />
                            Sign out
                        </Button>
                    </div>
                </div>
            </aside>

            {/* Mobile overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Top bar */}
                <header className="flex items-center justify-between px-4 py-3 border-b bg-card lg:px-6">
                    <button className="lg:hidden" onClick={() => setSidebarOpen(true)}>
                        <Menu className="w-5 h-5" />
                    </button>
                    <div className="flex-1" />
                    <div className="text-sm text-muted-foreground">
                        {user?.email}
                    </div>
                </header>

                {/* Page content */}
                <main className="flex-1 overflow-y-auto p-4 lg:p-6">
                    <div className="animate-fade-in">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
