import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Lock, Plus, Eye, EyeOff, ExternalLink, Trash2, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/useAuth";

interface VaultEntry {
  id: number;
  service: string;
  client_name: string;
  url: string | null;
  username: string | null;
  notes: string | null;
  secret_iv: string | null;
  secret_ciphertext: string | null;
  secret_auth_tag: string | null;
  created_at: string;
  updated_at: string;
  organization_id?: number;
  created_by?: number;
}

// AES-256-GCM encryption utilities
const ENCRYPTION_KEY_NAME = 'vault_encryption_key';

async function getOrCreateEncryptionKey(): Promise<CryptoKey> {
  const storedKey = localStorage.getItem(ENCRYPTION_KEY_NAME);
  
  if (storedKey) {
    const keyBytes = Uint8Array.from(atob(storedKey), c => c.charCodeAt(0));
    return await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
  }
  
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const exportedKey = await crypto.subtle.exportKey('raw', key);
  const keyBase64 = btoa(String.fromCharCode(...new Uint8Array(exportedKey)));
  localStorage.setItem(ENCRYPTION_KEY_NAME, keyBase64);
  return key;
}

async function encryptPassword(password: string): Promise<{ iv: string; ciphertext: string; authTag: string }> {
  const key = await getOrCreateEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  const encryptedArray = new Uint8Array(encrypted);
  const ciphertext = encryptedArray.slice(0, -16);
  const authTag = encryptedArray.slice(-16);
  
  return {
    iv: btoa(String.fromCharCode(...iv)),
    ciphertext: btoa(String.fromCharCode(...ciphertext)),
    authTag: btoa(String.fromCharCode(...authTag))
  };
}

async function decryptPassword(iv: string, ciphertext: string, authTag: string): Promise<string> {
  const key = await getOrCreateEncryptionKey();
  const ivBytes = Uint8Array.from(atob(iv), c => c.charCodeAt(0));
  const ciphertextBytes = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
  const authTagBytes = Uint8Array.from(atob(authTag), c => c.charCodeAt(0));
  
  const combined = new Uint8Array(ciphertextBytes.length + authTagBytes.length);
  combined.set(ciphertextBytes);
  combined.set(authTagBytes, ciphertextBytes.length);
  
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes }, key, combined);
  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

function VaultPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<VaultEntry | null>(null);
  const [showPassword, setShowPassword] = useState<{ [key: number]: boolean }>({});
  const [decryptedPasswords, setDecryptedPasswords] = useState<Map<number, string>>(new Map());
  
  const [service, setService] = useState("");
  const [clientName, setClientName] = useState("");
  const [url, setUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    fetchEntries();
  }, []);

  const fetchEntries = async () => {
    try {
      if (!user?.organization_id) throw new Error("Missing organization context");
      const { data, error } = await supabase
        .from("accounts_vault")
        .select("*")
        .eq("organization_id", user.organization_id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setEntries(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to fetch vault entries",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setService("");
    setClientName("");
    setUrl("");
    setUsername("");
    setPassword("");
    setNotes("");
    setEditingEntry(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (!user?.id || !user.organization_id) throw new Error("You must be authenticated to save credentials");
      const encrypted = password ? await encryptPassword(password) : null;
      
      const entryData = {
        service,
        client_name: clientName,
        url: url || null,
        username: username || null,
        notes: notes || null,
        secret_iv: encrypted?.iv || null,
        secret_ciphertext: encrypted?.ciphertext || null,
        secret_auth_tag: encrypted?.authTag || null,
        organization_id: user.organization_id,
        created_by: user.id,
      };

      if (editingEntry) {
        const { error } = await supabase
          .from("accounts_vault")
          .update(entryData)
          .eq("id", editingEntry.id);

        if (error) throw error;
        toast({ title: "Success", description: "Credential updated" });
      } else {
        const { error } = await supabase
          .from("accounts_vault")
          .insert(entryData);

        if (error) throw error;
        toast({ title: "Success", description: "Credential saved" });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchEntries();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save credential",
      });
    }
  };

  const handleEdit = (entry: VaultEntry) => {
    setEditingEntry(entry);
    setService(entry.service);
    setClientName(entry.client_name);
    setUrl(entry.url || "");
    setUsername(entry.username || "");
    setPassword("");
    setNotes(entry.notes || "");
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this credential?")) return;

    try {
      const { error } = await supabase
        .from("accounts_vault")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
      toast({ title: "Success", description: "Credential deleted" });
      fetchEntries();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete credential",
      });
    }
  };

  const togglePasswordVisibility = async (entry: VaultEntry) => {
    const id = entry.id;
    const isVisible = showPassword[id];
    
    if (isVisible) {
      setShowPassword(prev => ({ ...prev, [id]: false }));
      const newDecrypted = new Map(decryptedPasswords);
      newDecrypted.delete(id);
      setDecryptedPasswords(newDecrypted);
    } else {
      if (entry.secret_iv && entry.secret_ciphertext && entry.secret_auth_tag) {
        try {
          const decrypted = await decryptPassword(entry.secret_iv, entry.secret_ciphertext, entry.secret_auth_tag);
          const newDecrypted = new Map(decryptedPasswords);
          newDecrypted.set(id, decrypted);
          setDecryptedPasswords(newDecrypted);
          setShowPassword(prev => ({ ...prev, [id]: true }));
        } catch (error) {
          toast({ variant: "destructive", title: "Error", description: "Failed to decrypt password" });
        }
      }
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Lock className="h-8 w-8" />
              Credentials Vault
            </h1>
            <p className="text-muted-foreground mt-1">
              Securely store and manage client credentials for your organization
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Credential
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingEntry ? "Edit" : "Add"} Credential</DialogTitle>
                <DialogDescription>
                  Store encrypted credentials for client systems
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="service">Service/Platform *</Label>
                    <Input
                      id="service"
                      value={service}
                      onChange={(e) => setService(e.target.value)}
                      placeholder="e.g., WordPress, cPanel"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="clientName">Client Name *</Label>
                    <Input
                      id="clientName"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="e.g., Acme Corp"
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="url">URL</Label>
                  <Input
                    id="url"
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com/admin"
                  />
                </div>
                <div>
                  <Label htmlFor="username">Username/Email</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="admin@example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                  />
                </div>
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Additional information"
                    rows={3}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingEntry ? "Update" : "Save"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-muted-foreground">Loading...</p>
            </CardContent>
          </Card>
        ) : entries.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Lock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No credentials stored</h3>
              <p className="text-muted-foreground mb-4">
                Start by adding your first client credential
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {entries.map((entry) => (
              <Card key={entry.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {entry.service}
                        <Badge variant="secondary">{entry.client_name}</Badge>
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {entry.url && (
                          <a
                            href={entry.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 hover:underline"
                          >
                            {entry.url}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleEdit(entry)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(entry.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {entry.username && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Username</Label>
                      <p className="font-mono text-sm">{entry.username}</p>
                    </div>
                  )}
                  {entry.secret_ciphertext && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Password</Label>
                      <div className="flex items-center gap-2">
                        <code className="font-mono text-sm">
                          {showPassword[entry.id] ? decryptedPasswords.get(entry.id) || "••••••••" : "••••••••"}
                        </code>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => togglePasswordVisibility(entry)}
                        >
                          {showPassword[entry.id] ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                  {entry.notes && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Notes</Label>
                      <p className="text-sm whitespace-pre-wrap">{entry.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle className="text-sm">Security Notice</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>
              ⚠️ Basic encryption for demo. Production requires AES-256-GCM with proper key management and audit logging.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

export default function Vault() {
  return (
    <ProtectedRoute>
      <VaultPage />
    </ProtectedRoute>
  );
}
