import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Brain, CalendarCheck, Flame, LayoutDashboard, ListChecks, LogOut, Menu, MessageSquare,
  PanelLeftClose, PanelLeftOpen, Repeat, Search, Settings, Sparkles, Trophy, User as UserIcon, Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SparkLogo, SparkMark } from "@/components/Logo";
import { SparkAvatar } from "@/components/Avatar";
import { ChaosModal } from "@/components/ChaosModal";
import { useApp } from "@/state";

export const NAV = [
  { href: "/", label: "Heute", icon: LayoutDashboard },
  { href: "/genius", label: "Genius", icon: Brain },
  { href: "/missionen", label: "Missionen", icon: ListChecks },
  { href: "/chats", label: "Chats", icon: MessageSquare },
  { href: "/wiederholung", label: "Wiederholung", icon: Repeat },
  { href: "/bestenliste", label: "Bestenliste", icon: Trophy },
  { href: "/finanzen", label: "Finanzen", icon: Wallet },
];

const EXTRA = [
  { href: "/profil", label: "Profil", icon: UserIcon },
  { href: "/einstellungen", label: "Einstellungen", icon: Settings },
  { href: "/wrapped", label: "Wochen-Rückblick", icon: CalendarCheck },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, companion, stats, logout } = useApp();
  const [location, navigate] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [chaosOpen, setChaosOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const avatarConfig = companion
    ? { preset: companion.preset, style: companion.style, skin: companion.skin, hair: companion.hair, hairstyle: companion.hairstyle, eyes: companion.eyes, outfit: companion.outfit }
    : null;

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar (Desktop) */}
      <aside
        className={`hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 md:flex ${collapsed ? "w-[68px]" : "w-60"}`}
        data-testid="nav-sidebar"
      >
        <div className="flex h-14 items-center justify-between px-3">
          <Link href="/">{collapsed ? <span className="text-primary"><SparkMark size={22} /></span> : <SparkLogo />}</Link>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCollapsed((c) => !c)} data-testid="button-toggle-sidebar" aria-label="Seitenleiste umschalten">
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        </div>
        <nav className="flex-1 space-y-1 px-2 py-2">
          {NAV.map((item) => {
            const active = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <span
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm hover-elevate ${active ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground" : "text-sidebar-foreground/80"}`}
                  data-testid={`link-nav-${item.label.toLowerCase()}`}
                  title={item.label}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </span>
              </Link>
            );
          })}
          <div className="my-2 border-t border-sidebar-border" />
          {EXTRA.slice(0, 2).map((item) => (
            <Link key={item.href} href={item.href}>
              <span
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm hover-elevate ${location === item.href ? "bg-sidebar-accent font-medium" : "text-sidebar-foreground/80"}`}
                data-testid={`link-nav-${item.label.toLowerCase()}`}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </span>
            </Link>
          ))}
        </nav>
        {!collapsed && (
          <div className="m-2 rounded-md border border-sidebar-border bg-sidebar-accent/40 p-3">
            <p className="text-xs text-muted-foreground">Rang</p>
            <p className="text-sm font-semibold">{stats?.rank || "Funke"}</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${stats?.rankProgress || 0}%` }} />
            </div>
          </div>
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/85 px-3 backdrop-blur md:px-5">
          <div className="md:hidden"><Link href="/"><SparkLogo compact /></Link></div>
          <button
            className="ml-auto flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-card px-3 text-left text-sm text-muted-foreground hover-elevate md:ml-0 md:max-w-sm"
            onClick={() => setPaletteOpen(true)}
            data-testid="button-search"
          >
            <Search className="h-4 w-4 shrink-0" />
            <span className="truncate">Suchen …</span>
            <kbd className="ml-auto hidden shrink-0 rounded border border-border px-1.5 text-[10px] sm:inline">⌘K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="secondary" className="gap-1 px-2 py-1" data-testid="status-streak">
                  <Flame className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold">{stats?.streak ?? 0}</span>
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Streak: {stats?.streak ?? 0} Tage in Folge</TooltipContent>
            </Tooltip>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-border bg-card hover-elevate" data-testid="button-avatar-menu" aria-label="Konto-Menü">
                  {avatarConfig ? <SparkAvatar config={avatarConfig} size={34} animate={false} /> : <UserIcon className="h-4 w-4" />}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate">{user?.name || user?.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {EXTRA.map((item) => (
                  <DropdownMenuItem key={item.href} onClick={() => navigate(item.href)} data-testid={`menu-${item.label.toLowerCase()}`}>
                    <item.icon className="mr-2 h-4 w-4" /> {item.label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => void logout()} data-testid="menu-logout">
                  <LogOut className="mr-2 h-4 w-4" /> Abmelden
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto spark-scroll" data-testid="main-content">{children}</main>

        {/* Bottom-Tabs (Mobile) */}
        <nav className="fixed inset-x-0 bottom-0 z-30 flex items-stretch justify-between border-t border-border bg-background/95 px-1 backdrop-blur md:hidden" data-testid="nav-bottom">
          {NAV.slice(0, 5).map((item) => {
            const active = location === item.href;
            return (
              <Link key={item.href} href={item.href} className="flex-1">
                <span className={`flex flex-col items-center gap-0.5 py-2 text-[10px] ${active ? "text-primary" : "text-muted-foreground"}`} data-testid={`tab-${item.label.toLowerCase()}`}>
                  <item.icon className="h-5 w-5" />
                  <span className="truncate">{item.label}</span>
                </span>
              </Link>
            );
          })}
          <button className="flex-1" onClick={() => setPaletteOpen(true)} data-testid="tab-mehr" aria-label="Mehr">
            <span className="flex flex-col items-center gap-0.5 py-2 text-[10px] text-muted-foreground">
              <Menu className="h-5 w-5" />
              <span>Mehr</span>
            </span>
          </button>
        </nav>

        {/* Chaos-Button */}
        <div className="pointer-events-none fixed bottom-20 right-4 z-40 md:bottom-6 md:right-6">
          <Button
            className="pointer-events-auto h-14 w-14 rounded-full shadow-lg"
            onClick={() => setChaosOpen(true)}
            data-testid="button-chaos"
            aria-label="Kopf leeren"
          >
            <Sparkles className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <ChaosModal open={chaosOpen} onOpenChange={setChaosOpen} />

      <CommandDialog open={paletteOpen} onOpenChange={setPaletteOpen}>
        <CommandInput placeholder="Wohin möchtest du?" data-testid="input-command" />
        <CommandList>
          <CommandEmpty>Nichts gefunden.</CommandEmpty>
          <CommandGroup heading="Bereiche">
            {[...NAV, ...EXTRA].map((item) => (
              <CommandItem
                key={item.href}
                value={item.label}
                onSelect={() => { navigate(item.href); setPaletteOpen(false); }}
                data-testid={`command-${item.label.toLowerCase()}`}
              >
                <item.icon className="mr-2 h-4 w-4" /> {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Aktionen">
            <CommandItem value="Kopf leeren" onSelect={() => { setChaosOpen(true); setPaletteOpen(false); }} data-testid="command-chaos">
              <Sparkles className="mr-2 h-4 w-4" /> Kopf leeren
            </CommandItem>
            <CommandItem value="Abmelden" onSelect={() => { void logout(); setPaletteOpen(false); }} data-testid="command-logout">
              <LogOut className="mr-2 h-4 w-4" /> Abmelden
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-xl font-semibold tracking-tight" data-testid="text-page-title">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Page({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-6xl px-4 pb-28 pt-5 md:px-6 md:pb-10 md:pt-7">{children}</div>;
}
