"use client";

import { useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, Plus, Pencil, Archive, Users, Plug } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { authenticatedFetch, useSocialFlow } from "@/lib/store";
import { toast } from "sonner";

interface ClientRow {
  id: string;
  name: string;
  notes?: string | null;
  status: string;
  members: { userId: string; name?: string | null; email: string }[];
  accounts: { id: string; platform: string; handle: string; displayName?: string }[];
  postCount: number;
  canManage: boolean;
}
interface MemberRow { userId: string; name?: string | null; email: string; role: string; }
interface AccountRow { id: string; platform: string; handle: string; displayName: string; clientId?: string; }

export function ClientManager() {
  const { workspaceId, workspaces, reloadData, loadAgencyDirectory } = useSocialFlow();
  const role = workspaces.find((w) => w.id === workspaceId)?.role;
  const canManage = role === "owner" || role === "admin";
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editClient, setEditClient] = useState<ClientRow | null>(null);
  const [name, setName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!workspaceId) return;
    try {
      const requests: Promise<Response>[] = [authenticatedFetch(`/api/v1/clients?workspaceId=${encodeURIComponent(workspaceId)}`)];
      if (canManage) {
        requests.push(authenticatedFetch(`/api/v1/teams/members?workspaceId=${encodeURIComponent(workspaceId)}&pageSize=100`));
        requests.push(authenticatedFetch(`/api/v1/accounts?workspaceId=${encodeURIComponent(workspaceId)}`));
      }
      const responses = await Promise.all(requests);
      const clientJson = await responses[0].json();
      if (!responses[0].ok) throw new Error(clientJson.error?.message ?? "Could not load clients");
      setClients(clientJson.data ?? []);
      if (canManage) {
        const memberJson = await responses[1].json();
        const accountJson = await responses[2].json();
        setMembers(memberJson.data?.members ?? []);
        setAccounts(accountJson.data ?? []);
      }
    } catch (error) {
      toast.error("Could not load clients", { description: error instanceof Error ? error.message : "Unknown error" });
    }
  };

  useEffect(() => { void load(); }, [workspaceId, canManage]);

  const openEdit = (client: ClientRow) => {
    setEditClient(client);
    setName(client.name);
    setSelectedUsers(client.members.map((m) => m.userId));
    setSelectedAccounts(client.accounts.map((a) => a.id));
  };

  const availableAccounts = useMemo(() => role === "owner" ? accounts : accounts.filter((account) => !account.clientId || account.clientId === editClient?.id), [accounts, editClient, role]);

  const createClient = async () => {
    if (!workspaceId || !name.trim()) return;
    setSaving(true);
    try {
      const res = await authenticatedFetch("/api/v1/clients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceId, name: name.trim() }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Could not create client");
      toast.success(`${name.trim()} created`);
      setName(""); setCreateOpen(false);
      await Promise.all([load(), loadAgencyDirectory()]);
    } catch (error) { toast.error("Client creation failed", { description: error instanceof Error ? error.message : "Unknown error" }); }
    finally { setSaving(false); }
  };

  const saveAssignments = async () => {
    if (!editClient) return;
    setSaving(true);
    try {
      if (name.trim() && name.trim() !== editClient.name) {
        const rename = await authenticatedFetch(`/api/v1/clients/${editClient.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim() }) });
        const renameJson = await rename.json();
        if (!rename.ok) throw new Error(renameJson.error?.message ?? "Could not rename client");
      }
      const res = await authenticatedFetch(`/api/v1/clients/${editClient.id}/assignments`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userIds: selectedUsers, socialAccountIds: selectedAccounts }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Could not save assignments");
      toast.success("Client assignments updated");
      setEditClient(null);
      await Promise.all([load(), reloadData(), loadAgencyDirectory()]);
    } catch (error) { toast.error("Assignment update failed", { description: error instanceof Error ? error.message : "Unknown error" }); }
    finally { setSaving(false); }
  };

  const deleteClient = async (client: ClientRow) => {
    if (!window.confirm(`Archive client ${client.name}? Existing accounts, posts and history will remain intact.`)) return;
    const res = await authenticatedFetch(`/api/v1/clients/${client.id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) { toast.error("Archive failed", { description: json.error?.message ?? "Could not delete client" }); return; }
    toast.success(`${client.name} archived`);
    await Promise.all([load(), reloadData(), loadAgencyDirectory()]);
  };

  return <div className="space-y-4">
    <div className="flex items-center justify-between gap-3">
      <div>
        <h3 className="text-base font-semibold">Clients & assignments</h3>
        <p className="text-xs text-muted-foreground">Assign any number of clients to each team member, and attach each social account to a client.</p>
      </div>
      {canManage && <Button onClick={() => { setName(""); setCreateOpen(true); }}><Plus className="mr-1.5 h-4 w-4" />Add client</Button>}
    </div>

    <div className="grid gap-4 lg:grid-cols-2">
      {clients.map((client) => <Card key={client.id} className="border-border">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div><CardTitle className="flex items-center gap-2 text-base"><BriefcaseBusiness className="h-4 w-4 text-primary" />{client.name}{client.status === "archived" && <Badge variant="outline" className="text-[9px]">Archived</Badge>}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{client.postCount} tracked post{client.postCount === 1 ? "" : "s"}</p></div>
            {canManage && <div className="flex gap-1"><Button variant="ghost" size="icon" onClick={() => openEdit(client)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="text-danger" onClick={() => void deleteClient(client)}><Archive className="h-4 w-4" /></Button></div>}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div><div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium"><Users className="h-3.5 w-3.5" />Team members</div><div className="flex flex-wrap gap-1.5">{client.members.length ? client.members.map((m) => <Badge key={m.userId} variant="secondary">{m.name ?? m.email}</Badge>) : <span className="text-xs text-muted-foreground">No team member assigned</span>}</div></div>
          <div><div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium"><Plug className="h-3.5 w-3.5" />Social accounts</div><div className="flex flex-wrap gap-1.5">{client.accounts.length ? client.accounts.map((a) => <Badge key={a.id} variant="outline">{a.platform} · {a.handle}</Badge>) : <span className="text-xs text-muted-foreground">No social account assigned</span>}</div></div>
        </CardContent>
      </Card>)}
      {!clients.length && <Card className="border-dashed lg:col-span-2"><CardContent className="p-10 text-center text-sm text-muted-foreground">{canManage ? "Create your first client, then assign team members and connected accounts." : "No clients are assigned to your login yet."}</CardContent></Card>}
    </div>

    <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent><DialogHeader><DialogTitle>Create client</DialogTitle><DialogDescription>Create the client first, then assign members and accounts.</DialogDescription></DialogHeader><div className="space-y-2"><Label>Client name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Example: Gayatri Electronics" /></div><DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button><Button disabled={saving || !name.trim()} onClick={() => void createClient()}>{saving ? "Creating…" : "Create client"}</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={Boolean(editClient)} onOpenChange={(open) => !open && setEditClient(null)}><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Manage {editClient?.name}</DialogTitle><DialogDescription>Choose exactly which team members and social accounts belong to this client.</DialogDescription></DialogHeader>
      <div className="space-y-5">
        <div className="space-y-2"><Label>Client name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="space-y-2"><Label>Team members</Label><div className="grid gap-2 rounded-xl border p-3 sm:grid-cols-2">{members.map((member) => <label key={member.userId} className="flex cursor-pointer items-center gap-2 rounded-lg p-2 hover:bg-muted/50"><Checkbox checked={selectedUsers.includes(member.userId)} onCheckedChange={(checked) => setSelectedUsers((current) => checked ? [...current, member.userId] : current.filter((id) => id !== member.userId))} /><span className="min-w-0"><span className="block truncate text-sm">{member.name ?? member.email}</span><span className="block truncate text-[11px] text-muted-foreground">{member.role}</span></span></label>)}</div></div>
        <div className="space-y-2"><Label>Connected social accounts</Label><div className="grid gap-2 rounded-xl border p-3 sm:grid-cols-2">{availableAccounts.map((account) => <label key={account.id} className="flex cursor-pointer items-center gap-2 rounded-lg p-2 hover:bg-muted/50"><Checkbox checked={selectedAccounts.includes(account.id)} onCheckedChange={(checked) => setSelectedAccounts((current) => checked ? [...current, account.id] : current.filter((id) => id !== account.id))} /><span className="min-w-0"><span className="block truncate text-sm">{account.handle}</span><span className="block truncate text-[11px] text-muted-foreground">{account.platform} · {account.displayName}</span></span></label>)}</div></div>
      </div>
      <DialogFooter><Button variant="outline" onClick={() => setEditClient(null)}>Cancel</Button><Button disabled={saving} onClick={() => void saveAssignments()}>{saving ? "Saving…" : "Save assignments"}</Button></DialogFooter>
    </DialogContent></Dialog>
  </div>;
}
