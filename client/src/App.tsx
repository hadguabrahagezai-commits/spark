import { useEffect } from "react";
import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider, useApp } from "@/state";
import { AppShell } from "@/components/Layout";
import Onboarding from "@/pages/Onboarding";
import Heute from "@/pages/Heute";
import Genius from "@/pages/Genius";
import Missionen from "@/pages/Missionen";
import Chats from "@/pages/Chats";
import Wiederholung from "@/pages/Wiederholung";
import Bestenliste from "@/pages/Bestenliste";
import Finanzen from "@/pages/Finanzen";
import Einstellungen from "@/pages/Einstellungen";
import Profil from "@/pages/Profil";
import Wrapped from "@/pages/Wrapped";
import NotFound from "@/pages/not-found";

function Shell() {
  const { token, user, login } = useApp();

  useEffect(() => {
    const match = window.location.hash.match(/token=([a-f0-9]+)/i);
    if (match && !token) {
      void login(match[1]).catch(() => {});
      window.location.hash = "#/";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!token || !user || !user.onboarded) return <Onboarding />;

  return (
    <AppShell>
      <Switch>
        <Route path="/" component={Heute} />
        <Route path="/genius" component={Genius} />
        <Route path="/missionen" component={Missionen} />
        <Route path="/chats" component={Chats} />
        <Route path="/wiederholung" component={Wiederholung} />
        <Route path="/bestenliste" component={Bestenliste} />
        <Route path="/finanzen" component={Finanzen} />
        <Route path="/einstellungen" component={Einstellungen} />
        <Route path="/profil" component={Profil} />
        <Route path="/wrapped" component={Wrapped} />
        <Route component={NotFound} />
      </Switch>
    </AppShell>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <TooltipProvider>
          <Toaster />
          <Router hook={useHashLocation}>
            <Shell />
          </Router>
        </TooltipProvider>
      </AppProvider>
    </QueryClientProvider>
  );
}

export default App;
