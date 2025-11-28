import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { subscribe, clear, getState } from "@/lib/logging/store";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";

function formatTs(ts: number) {
  return new Date(ts).toLocaleTimeString();
}

function NetworkTab() {
  const [filter, setFilter] = useState("");
  const [items, setItems] = useState(getState().fetch);
  useEffect(() => {
    const unsubscribe = subscribe((s) => setItems(s.fetch));
    return () => { unsubscribe(); };
  }, []);
  const filtered = useMemo(() => {
    if (!filter) return items.slice().reverse();
    return items.slice().reverse().filter((i) => i.url.toLowerCase().includes(filter.toLowerCase()));
  }, [items, filter]);
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Network</CardTitle>
          <div className="flex gap-2">
            <Input placeholder="Filter by URL" value={filter} onChange={(e) => setFilter(e.target.value)} className="w-64" />
            <Button variant="outline" onClick={() => clear("fetch")}>Clear</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {filtered.map((e, idx) => (
            <div key={idx} className="p-3 border rounded-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge>{e.method}</Badge>
                  <span className="font-mono text-sm">{formatTs(e.ts)}</span>
                </div>
                <div className="text-sm text-muted-foreground">{e.durationMs ? `${e.durationMs} ms` : ""}</div>
              </div>
              <div className="mt-1 break-all font-mono text-xs">{e.url}</div>
              {typeof e.status === "number" && (
                <div className="mt-1 text-sm">Status: <Badge variant={e.status >= 400 ? "destructive" : "secondary"}>{e.status}</Badge></div>
              )}
              {e.error && (
                <pre className="mt-2 bg-muted p-2 rounded text-xs overflow-x-auto">{JSON.stringify(e.error, null, 2)}</pre>
              )}
              {e.requestBody && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm">Request Body</summary>
                  <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">{typeof e.requestBody === "string" ? e.requestBody : JSON.stringify(e.requestBody, null, 2)}</pre>
                </details>
              )}
              {e.requestHeaders && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm">Request Headers</summary>
                  <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">{JSON.stringify(e.requestHeaders, null, 2)}</pre>
                </details>
              )}
              {e.responseBody && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm">Response Body</summary>
                  <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">{typeof e.responseBody === "string" ? e.responseBody : JSON.stringify(e.responseBody, null, 2)}</pre>
                </details>
              )}
            </div>
          ))}
          {filtered.length === 0 && <div className="text-sm text-muted-foreground">No network events</div>}
        </div>
      </CardContent>
    </Card>
  );
}

function ConsoleTab() {
  const [items, setItems] = useState(getState().console);
  useEffect(() => {
    const unsubscribe = subscribe((s) => setItems(s.console));
    return () => { unsubscribe(); };
  }, []);
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Console</CardTitle>
          <Button variant="outline" onClick={() => clear("console")}>Clear</Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {items.slice().reverse().map((e, idx) => (
            <div key={idx} className="p-3 border rounded-md">
              <div className="flex items-center gap-2">
                <Badge>{e.level}</Badge>
                <span className="font-mono text-sm">{formatTs(e.ts)}</span>
              </div>
              <pre className="mt-2 bg-muted p-2 rounded text-xs overflow-x-auto">{e.args.map((a) => typeof a === "string" ? a : JSON.stringify(a, null, 2)).join(" ")}</pre>
            </div>
          ))}
          {items.length === 0 && <div className="text-sm text-muted-foreground">No console events</div>}
        </div>
      </CardContent>
    </Card>
  );
}

function ErrorsTab() {
  const [items, setItems] = useState(getState().errors);
  useEffect(() => {
    const unsubscribe = subscribe((s) => setItems(s.errors));
    return () => { unsubscribe(); };
  }, []);
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Errors</CardTitle>
          <Button variant="outline" onClick={() => clear("errors")}>Clear</Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {items.slice().reverse().map((e, idx) => (
            <div key={idx} className="p-3 border rounded-md">
              <div className="flex items-center gap-2">
                <Badge>{e.type}</Badge>
                <span className="font-mono text-sm">{formatTs(e.ts)}</span>
              </div>
              <pre className="mt-2 bg-muted p-2 rounded text-xs overflow-x-auto">{JSON.stringify(e.data, null, 2)}</pre>
            </div>
          ))}
          {items.length === 0 && <div className="text-sm text-muted-foreground">No error events</div>}
        </div>
      </CardContent>
    </Card>
  );
}

function QueriesTab() {
  const [items, setItems] = useState(getState().queries);
  useEffect(() => {
    const unsubscribe = subscribe((s) => setItems(s.queries));
    return () => { unsubscribe(); };
  }, []);
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Queries</CardTitle>
          <Button variant="outline" onClick={() => clear("queries")}>Clear</Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {items.slice().reverse().map((e, idx) => (
            <div key={idx} className="p-3 border rounded-md">
              <div className="flex items-center gap-2">
                <Badge>{e.type}</Badge>
                <span className="font-mono text-sm">{formatTs(e.ts)}</span>
              </div>
              <div className="text-xs">Status: {e.status || ""}</div>
              <pre className="mt-2 bg-muted p-2 rounded text-xs overflow-x-auto">{JSON.stringify(e.key, null, 2)}</pre>
              {e.error && <pre className="mt-2 bg-muted p-2 rounded text-xs overflow-x-auto">{JSON.stringify(e.error, null, 2)}</pre>}
            </div>
          ))}
          {items.length === 0 && <div className="text-sm text-muted-foreground">No query events</div>}
        </div>
      </CardContent>
    </Card>
  );
}

function DevToolsPage() {
  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8 space-y-6">
        <h2 className="text-3xl font-bold">DevTools</h2>
        <p className="text-muted-foreground">Runtime diagnostics for network, console, errors, and queries.</p>
        <Tabs defaultValue="all" className="space-y-6">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="network">Network</TabsTrigger>
            <TabsTrigger value="console">Console</TabsTrigger>
            <TabsTrigger value="errors">Errors</TabsTrigger>
            <TabsTrigger value="queries">Queries</TabsTrigger>
          </TabsList>
          <TabsContent value="all"><AllTab /></TabsContent>
          <TabsContent value="network"><NetworkTab /></TabsContent>
          <TabsContent value="console"><ConsoleTab /></TabsContent>
          <TabsContent value="errors"><ErrorsTab /></TabsContent>
          <TabsContent value="queries"><QueriesTab /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

export default function DevTools() {
  return (
    <ProtectedRoute>
      <DevToolsPage />
    </ProtectedRoute>
  );
}

function AllTab() {
  const [state, setState] = useState(getState());
  useEffect(() => {
    const unsubscribe = subscribe((s) => setState(s));
    return () => { unsubscribe(); };
  }, []);
  const merged = useMemo(() => {
    const items: { ts: number; type: string; payload: any }[] = [];
    state.fetch.forEach((e) => items.push({ ts: e.ts, type: "network", payload: e }));
    state.console.forEach((e) => items.push({ ts: e.ts, type: "console", payload: e }));
    state.errors.forEach((e) => items.push({ ts: e.ts, type: "error", payload: e }));
    state.queries.forEach((e) => items.push({ ts: e.ts, type: "query", payload: e }));
    return items.sort((a, b) => b.ts - a.ts);
  }, [state]);
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>All</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => clear("fetch")}>Clear Network</Button>
            <Button variant="outline" onClick={() => clear("console")}>Clear Console</Button>
            <Button variant="outline" onClick={() => clear("errors")}>Clear Errors</Button>
            <Button variant="outline" onClick={() => clear("queries")}>Clear Queries</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {merged.map((e, idx) => (
            <div key={idx} className="p-3 border rounded-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge>{e.type}</Badge>
                  <span className="font-mono text-sm">{formatTs(e.ts)}</span>
                </div>
              </div>
              {e.type === "network" && (
                <div className="mt-1">
                  <div className="break-all font-mono text-xs">{e.payload.method} {e.payload.url}</div>
                  {typeof e.payload.status === "number" && <div className="text-xs">Status: {e.payload.status}</div>}
                </div>
              )}
              {e.type === "console" && (
                <pre className="mt-2 bg-muted p-2 rounded text-xs overflow-x-auto">{e.payload.args.map((a: any) => typeof a === "string" ? a : JSON.stringify(a, null, 2)).join(" ")}</pre>
              )}
              {e.type === "error" && (
                <pre className="mt-2 bg-muted p-2 rounded text-xs overflow-x-auto">{JSON.stringify(e.payload.data, null, 2)}</pre>
              )}
              {e.type === "query" && (
                <div className="mt-1 text-xs">{e.payload.type} {JSON.stringify(e.payload.key)}</div>
              )}
            </div>
          ))}
          {merged.length === 0 && <div className="text-sm text-muted-foreground">No events</div>}
        </div>
      </CardContent>
    </Card>
  );
}