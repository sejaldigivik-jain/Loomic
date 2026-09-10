"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  UserPlus,
  Search,
  MoreHorizontal,
  Shield,
  Crown,
  Pencil,
  Eye,
  Trash2,
  Mail,
  Clock,
  CheckCircle2,
  XCircle,
  MessageSquare,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { authenticatedFetch, useSocialFlow } from "@/lib/store";
import { PLATFORMS } from "@/lib/platforms";
import {
  type TeamMember,
  type ApprovalRequest,
} from "@/lib/mock-data";
import { cn, timeAgo } from "@/lib/utils";
import { toast } from "sonner";

const ROLE_CONFIG: Record<
  TeamMember["role"],
  { icon: typeof Crown; color: string; description: string }
> = {
  Owner: { icon: Crown, color: "text-amber-500", description: "Full access, billing owner" },
  Admin: { icon: Shield, color: "text-primary", description: "Manage members & accounts" },
  Editor: { icon: Pencil, color: "text-success", description: "Create, edit & publish" },
  Contributor: { icon: Pencil, color: "text-muted-foreground", description: "Create & submit for approval" },
  Viewer: { icon: Eye, color: "text-muted-foreground", description: "Read-only access" },
};

const STATUS_STYLES: Record<TeamMember["status"], string> = {
  active: "bg-success/15 text-success",
  invited: "bg-warning/15 text-warning",
  suspended: "bg-danger/15 text-danger",
};

const APPROVAL_STATUS_CONFIG: Record<
  ApprovalRequest["status"],
  { label: string; color: string; icon: typeof CheckCircle2 }
> = {
  pending: { label: "Pending review", color: "bg-warning/15 text-warning border-warning/30", icon: Clock },
  approved: { label: "Approved", color: "bg-success/15 text-success border-success/30", icon: CheckCircle2 },
  rejected: { label: "Rejected", color: "bg-danger/15 text-danger border-danger/30", icon: XCircle },
  changes_requested: { label: "Changes requested", color: "bg-primary/15 text-primary border-primary/30", icon: AlertCircle },
};

/**
 * TeamView — Sprint 10: Team Collaboration.
 *
 * Combines three collaboration primitives:
 *   1. Members directory — list, search, filter, role management, invite
 *   2. Approval workflow — queue of posts awaiting review
 *   3. Activity overview — pending invitations & quick stats
 *
 * Designed to feel like Linear's team settings: dense, scannable,
 * every action one click away.
 */
export function TeamView() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [pendingInviteCount, setPendingInviteCount] = useState(0);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [assignmentMember, setAssignmentMember] = useState<TeamMember | null>(null);
  const [assignmentClients, setAssignmentClients] = useState<{ id: string; name: string; status: string }[]>([]);
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [savingAssignments, setSavingAssignments] = useState(false);
  const { workspaceId, accessToken, user, loadAgencyDirectory } = useSocialFlow();

  const loadTeam = async () => {
    if (!workspaceId || !accessToken) return;
    try {
      const headers = { Authorization: `Bearer ${accessToken}` };
      const [memberRes, approvalRes] = await Promise.all([
        authenticatedFetch(`/api/v1/teams/members?workspaceId=${encodeURIComponent(workspaceId)}&pageSize=100`, { headers }),
        authenticatedFetch(`/api/v1/approvals?workspaceId=${encodeURIComponent(workspaceId)}`, { headers }),
      ]);
      const memberJson = await memberRes.json();
      const approvalJson = await approvalRes.json();
      if (!memberRes.ok) throw new Error(memberJson.error?.message ?? "Could not load team");
      const mappedMembers: TeamMember[] = (memberJson.data?.members ?? []).map((m: any) => ({
        id: m.id,
        userId: m.userId,
        assignedClients: (m.assignedAccounts ?? []).map((account: any) => ({
          id: account.id,
          name: account.displayName || account.handle,
          status: account.status,
        })),
        name: m.name ?? m.email,
        email: m.email,
        role: `${String(m.role).charAt(0).toUpperCase()}${String(m.role).slice(1)}` as TeamMember["role"],
        initials: (m.name ?? m.email).split(/\s+/).map((v: string) => v[0]).join("").slice(0, 2).toUpperCase(),
        gradient: "from-indigo-500 to-violet-500",
        lastActive: m.isActive ? "Active workspace" : "Member",
        status: "active" as const,
      }));
      setMembers(mappedMembers);
      setPendingInviteCount(memberJson.data?.pendingInvitations?.length ?? 0);
      void loadAgencyDirectory();
      if (approvalRes.ok) {
        setApprovals((approvalJson.data ?? []).map((a: any) => ({
          id: a.id,
          postContent: a.postContent,
          author: {
            name: a.author?.name ?? a.author?.email ?? "Team member",
            initials: (a.author?.name ?? a.author?.email ?? "TM").split(/\s+/).map((v: string) => v[0]).join("").slice(0, 2).toUpperCase(),
            gradient: "from-sky-500 to-blue-600",
          },
          platforms: a.platforms ?? [],
          requestedAt: a.requestedAt,
          status: a.status,
          dueBy: a.resolvedAt ?? a.requestedAt,
          commentCount: a.commentCount ?? 0,
        })));
      }
    } catch (error) {
      toast.error("Could not load team", { description: error instanceof Error ? error.message : "Unknown error" });
    }
  };

  useEffect(() => { void loadTeam(); }, [workspaceId, accessToken]);

  const currentMember = members.find((m) => m.email === user?.email);
  const canManageRoles = currentMember?.role === "Owner" || currentMember?.role === "Admin";
  const isWorkspaceOwner = currentMember?.role === "Owner";

  const updateMemberRole = async (member: TeamMember, role: TeamMember["role"]) => {
    if (!accessToken || !canManageRoles) return;
    const res = await authenticatedFetch(`/api/v1/teams/members/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ role: role.toLowerCase() }),
    });
    const json = await res.json();
    if (!res.ok) { toast.error("Role update failed", { description: json.error?.message ?? "Could not update member" }); return; }
    toast.success(`${member.name} is now ${role}`);
    await loadTeam();
  };

  const transferOwnership = async (member: TeamMember) => {
    if (!accessToken || !isWorkspaceOwner) return;
    const res = await authenticatedFetch(`/api/v1/teams/members/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ role: "owner" }),
    });
    const json = await res.json();
    if (!res.ok) { toast.error("Ownership transfer failed", { description: json.error?.message ?? "Could not transfer ownership" }); return; }
    toast.success(`Workspace ownership transferred to ${member.name}`);
    await loadTeam();
  };

  const removeMember = async (member: TeamMember) => {
    if (!accessToken || !isWorkspaceOwner) return;
    if (!window.confirm(`Remove ${member.name} from this workspace?`)) return;
    const res = await authenticatedFetch(`/api/v1/teams/members/${member.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const json = await res.json();
    if (!res.ok) { toast.error("Remove failed", { description: json.error?.message ?? "Could not remove member" }); return; }
    toast.success(`${member.name} removed from the workspace`);
    await loadTeam();
  };

  const openClientAssignments = async (member: TeamMember) => {
    if (!workspaceId || !accessToken || !isWorkspaceOwner) return;
    const res = await authenticatedFetch(`/api/v1/accounts?workspaceId=${encodeURIComponent(workspaceId)}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const json = await res.json();
    if (!res.ok) { toast.error("Could not load connected clients", { description: json.error?.message ?? "Request failed" }); return; }
    setAssignmentMember(member);
    setAssignmentClients((json.data ?? []).map((account: any) => ({
      id: account.id,
      name: `${account.displayName || account.handle}${account.handle && account.displayName !== account.handle ? ` (${account.handle})` : ""}`,
      status: account.status,
    })));
    setSelectedClientIds((member.assignedClients ?? []).map((client) => client.id));
    setAssignmentOpen(true);
  };

  const saveClientAssignments = async () => {
    if (!assignmentMember || !accessToken) return;
    setSavingAssignments(true);
    try {
      const res = await authenticatedFetch(`/api/v1/teams/members/${assignmentMember.id}/accounts`, {
        method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ accountIds: selectedClientIds }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Could not save assignments");
      toast.success(`Client assignments saved for ${assignmentMember.name}`);
      setAssignmentOpen(false);
      await loadTeam();
    } catch (error) { toast.error("Assignment update failed", { description: error instanceof Error ? error.message : "Unknown error" }); }
    finally { setSavingAssignments(false); }
  };

  const filteredMembers = members.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === "all" || m.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const pendingApprovals = approvals.filter((a) => a.status === "pending" || a.status === "changes_requested");
  const completedApprovals = approvals.filter((a) => a.status === "approved" || a.status === "rejected");


  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Team
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage members, client assignments, roles and approval workflows for your workspace.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isWorkspaceOwner && (
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-primary to-accent text-white shadow-glow">
                  <UserPlus className="mr-1.5 h-4 w-4" />
                  Create member
                </Button>
              </DialogTrigger>
              <CreateMemberDialog onClose={() => setCreateOpen(false)} onCreated={loadTeam} />
            </Dialog>
          )}
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Mail className="mr-1.5 h-4 w-4" />
                Invite by email
              </Button>
            </DialogTrigger>
            <InviteDialog onClose={() => setInviteOpen(false)} onInvited={loadTeam} />
          </Dialog>
        </div>
      </motion.div>

      <Dialog open={assignmentOpen} onOpenChange={setAssignmentOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assigned clients — {assignmentMember?.name}</DialogTitle><DialogDescription>Each connected Instagram/social account is a client. Select any number of connected accounts for this team member.</DialogDescription></DialogHeader>
          <div className="max-h-80 space-y-2 overflow-y-auto py-2">
            {assignmentClients.map((client) => { const checked = selectedClientIds.includes(client.id); return (
              <label key={client.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/30">
                <input type="checkbox" checked={checked} onChange={(e) => setSelectedClientIds((ids) => e.target.checked ? [...ids, client.id] : ids.filter((id) => id !== client.id))} className="h-4 w-4 accent-primary" />
                <span className="text-sm font-medium">{client.name}</span>
              </label>
            ); })}
            {assignmentClients.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No connected accounts yet. Connect an Instagram account from Accounts first.</p>}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setAssignmentOpen(false)}>Cancel</Button><Button onClick={() => void saveClientAssignments()} disabled={savingAssignments}>{savingAssignments ? "Saving…" : "Save assignments"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Team members" value={members.filter((m) => m.role !== "Owner").length} icon={UserPlus} gradient="from-indigo-500 to-violet-500" />
        <StatCard label="Pending approvals" value={pendingApprovals.length} icon={Clock} gradient="from-amber-500 to-pink-500" />
        <StatCard label="Pending invitations" value={pendingInviteCount} icon={Mail} gradient="from-emerald-500 to-teal-500" />
        <StatCard label="Active this week" value={members.filter((m) => m.role !== "Owner" && m.status === "active").length} icon={CheckCircle2} gradient="from-sky-500 to-blue-600" />
      </div>

      <Tabs defaultValue="members" className="space-y-4">
        <TabsList>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="approvals">
            Approvals
            {pendingApprovals.length > 0 && (
              <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                {pendingApprovals.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="roles">Roles & permissions</TabsTrigger>
        </TabsList>

        {/* Members tab */}
        <TabsContent value="members" className="space-y-4">
          <Card className="border-border">
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search members..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-full sm:w-44">
                    <SelectValue placeholder="Filter by role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All roles</SelectItem>
                    <SelectItem value="Owner">Owner</SelectItem>
                    <SelectItem value="Admin">Admin</SelectItem>
                    <SelectItem value="Editor">Editor</SelectItem>
                    <SelectItem value="Contributor">Contributor</SelectItem>
                    <SelectItem value="Viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {filteredMembers.map((member, i) => (
                  <motion.div
                    key={member.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.04 }}
                    className="flex items-center gap-4 p-4 transition-colors hover:bg-muted/30"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className={cn("bg-gradient-to-br text-white", member.gradient)}>
                        {member.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium">{member.name}</p>
                        {member.status === "invited" && (
                          <Badge variant="outline" className={cn("text-[10px]", STATUS_STYLES[member.status])}>
                            Invited
                          </Badge>
                        )}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{member.email}{member.role !== "Owner" ? ` · ${(member.assignedClients ?? []).length} client${(member.assignedClients ?? []).length === 1 ? "" : "s"}` : ""}</p>
                    </div>
                    <div className="hidden sm:block">
                      <RoleBadge role={member.role} />
                    </div>
                    <div className="hidden md:block w-32 text-xs text-muted-foreground">
                      {member.lastActive}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel>Role & access</DropdownMenuLabel>
                        {(["Admin", "Editor", "Contributor", "Viewer"] as TeamMember["role"][]).map((role) => (
                          <DropdownMenuItem
                            key={role}
                            disabled={!canManageRoles || member.role === "Owner" || member.role === role}
                            onClick={() => void updateMemberRole(member, role)}
                          >
                            <Shield className="mr-2 h-3.5 w-3.5" />
                            Set as {role}
                          </DropdownMenuItem>
                        ))}
                        {member.role !== "Owner" && member.email !== user?.email && (
                          <DropdownMenuItem
                            disabled={!isWorkspaceOwner}
                            onClick={() => void transferOwnership(member)}
                          >
                            <Crown className="mr-2 h-3.5 w-3.5" />
                            Transfer ownership
                          </DropdownMenuItem>
                        )}
                        {member.role !== "Owner" && (
                          <DropdownMenuItem disabled={!isWorkspaceOwner} onClick={() => void openClientAssignments(member)}>
                            <Shield className="mr-2 h-3.5 w-3.5" />
                            Assign clients
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          disabled={!isWorkspaceOwner || member.role === "Owner" || member.email === user?.email}
                          className="text-danger focus:text-danger"
                          onClick={() => void removeMember(member)}
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" />
                          Remove member
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </motion.div>
                ))}
                {filteredMembers.length === 0 && (
                  <div className="p-12 text-center">
                    <p className="text-sm text-muted-foreground">No members match your filters.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Approvals tab */}
        <TabsContent value="approvals" className="space-y-4">
          {pendingApprovals.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Awaiting your review ({pendingApprovals.length})
              </h3>
              {pendingApprovals.map((req, i) => (
                <ApprovalCard key={req.id} request={req} delay={i * 0.06} onAction={loadTeam} />
              ))}
            </div>
          )}
          {completedApprovals.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Recently resolved
              </h3>
              {completedApprovals.map((req, i) => (
                <ApprovalCard key={req.id} request={req} delay={i * 0.06} compact onAction={loadTeam} />
              ))}
            </div>
          )}
          {pendingApprovals.length === 0 && completedApprovals.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                <CheckCircle2 className="h-10 w-10 text-success mb-3" />
                <p className="text-sm font-medium">No approval requests</p>
                <p className="text-xs text-muted-foreground mt-1">Posts from contributors will appear here for review.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Roles & permissions tab */}
        <TabsContent value="roles" className="space-y-4">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Role hierarchy</CardTitle>
              <p className="text-xs text-muted-foreground">
                Higher roles inherit all permissions of lower roles. Only Owners can manage billing.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {(Object.keys(ROLE_CONFIG) as TeamMember["role"][]).map((role, i) => {
                const cfg = ROLE_CONFIG[role];
                const Icon = cfg.icon;
                const count = members.filter((m) => m.role === role).length;
                return (
                  <motion.div
                    key={role}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.05 }}
                    className="flex items-center gap-4 rounded-xl border border-border bg-card/50 p-4"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                      <Icon className={cn("h-5 w-5", cfg.color)} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{role}</p>
                        <Badge variant="secondary" className="text-[10px]">{count} {count === 1 ? "member" : "members"}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{cfg.description}</p>
                    </div>
                    <div className="hidden sm:flex gap-1.5">
                      {["Create", "Publish", "Approve", "Manage", "Billing"].map((perm, idx) => {
                        const hasPermission = i >= [4, 3, 2, 1, 0][idx];
                        return (
                          <span
                            key={perm}
                            className={cn(
                              "rounded px-1.5 py-0.5 text-[10px] font-medium",
                              hasPermission ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                            )}
                          >
                            {perm}
                          </span>
                        );
                      })}
                    </div>
                  </motion.div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                             */
/* -------------------------------------------------------------------------- */

function StatCard({
  label,
  value,
  icon: Icon,
  gradient,
}: {
  label: string;
  value: number;
  icon: typeof UserPlus;
  gradient: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="relative overflow-hidden border-border">
        <div className={cn("absolute -right-4 -top-4 h-16 w-16 rounded-full bg-gradient-to-br opacity-15 blur-xl", gradient)} />
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
            <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br text-white", gradient)}>
              <Icon className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 font-display text-2xl font-semibold">{value}</div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function RoleBadge({ role }: { role: TeamMember["role"] }) {
  const cfg = ROLE_CONFIG[role];
  const Icon = cfg.icon;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs font-medium">
      <Icon className={cn("h-3 w-3", cfg.color)} />
      {role}
    </span>
  );
}

function ApprovalCard({ request, delay, compact = false, onAction }: { request: ApprovalRequest; delay: number; compact?: boolean; onAction: () => Promise<void> }) {
  const { workspaceId, accessToken } = useSocialFlow();
  const act = async (action: "approve" | "reject" | "request_changes") => {
    if (!workspaceId || !accessToken) return;
    const res = await authenticatedFetch("/api/v1/approvals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ workspaceId, postId: request.id, action }),
    });
    const json = await res.json();
    if (!res.ok) { toast.error(json.error?.message ?? "Approval action failed"); return; }
    toast.success(action === "approve" ? "Post approved" : action === "reject" ? "Post rejected" : "Changes requested");
    await onAction();
  };
  const statusCfg = APPROVAL_STATUS_CONFIG[request.status];
  const StatusIcon = statusCfg.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
    >
      <Card className={cn("border-border transition-colors", !compact && "hover:border-primary/40")}>
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <Avatar className="h-9 w-9 flex-shrink-0">
              <AvatarFallback className={cn("bg-gradient-to-br text-white text-xs", request.author.gradient)}>
                {request.author.initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{request.author.name}</span>
                <span className="text-xs text-muted-foreground">requested approval</span>
                <span className="text-xs text-muted-foreground">· {timeAgo(request.requestedAt)}</span>
              </div>
              <p className={cn("mt-1.5 text-sm", compact ? "line-clamp-1" : "line-clamp-2")}>{request.postContent}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {request.platforms.map((pid) => {
                  const p = PLATFORMS[pid];
                  const PIcon = p.icon;
                  return (
                    <span key={pid} className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                      <PIcon className={cn("h-2.5 w-2.5", p.color)} />
                      {p.name}
                    </span>
                  );
                })}
                <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium", statusCfg.color)}>
                  <StatusIcon className="h-2.5 w-2.5" />
                  {statusCfg.label}
                </span>
                {request.commentCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                    <MessageSquare className="h-2.5 w-2.5" />
                    {request.commentCount}
                  </span>
                )}
              </div>
            </div>
            {!compact && request.status === "pending" && (
              <div className="hidden sm:flex flex-shrink-0 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() => void act("request_changes")}
                >
                  Request changes
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 border-danger/30 text-danger hover:bg-danger/10"
                  onClick={() => void act("reject")}
                >
                  <XCircle className="mr-1 h-3.5 w-3.5" />
                  Reject
                </Button>
                <Button
                  size="sm"
                  className="h-8 bg-gradient-to-r from-success to-teal-500 text-white"
                  onClick={() => void act("approve")}
                >
                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                  Approve
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}


function CreateMemberDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => Promise<void> }) {
  const { workspaceId, accessToken } = useSocialFlow();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<TeamMember["role"]>("Editor");
  const [accounts, setAccounts] = useState<{ id: string; displayName: string; handle: string; platform: string }[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!workspaceId || !accessToken) return;
    authenticatedFetch(`/api/v1/accounts?workspaceId=${encodeURIComponent(workspaceId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error?.message ?? "Could not load connected accounts");
        setAccounts(json.data ?? []);
      })
      .catch((error) => toast.error("Could not load clients", { description: error instanceof Error ? error.message : "Request failed" }));
  }, [workspaceId, accessToken]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceId || !accessToken || !name.trim() || !email.trim() || password.length < 8) return;
    setSaving(true);
    try {
      const res = await authenticatedFetch("/api/v1/teams/members/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          workspaceId,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          role: role.toLowerCase(),
          accountIds: selectedAccountIds,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Could not create team member");
      toast.success(`${name.trim()} created`, {
        description: `${role} · ${selectedAccountIds.length} client${selectedAccountIds.length === 1 ? "" : "s"} assigned`,
      });
      setName("");
      setEmail("");
      setPassword("");
      setRole("Editor");
      setSelectedAccountIds([]);
      onClose();
      await onCreated();
    } catch (error) {
      toast.error("Create member failed", { description: error instanceof Error ? error.message : "Unknown error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogContent className="max-w-xl">
      <DialogHeader>
        <DialogTitle>Create team member</DialogTitle>
        <DialogDescription>
          Create their login, choose a role, and assign connected Instagram/social accounts as clients. They will not get a separate agency workspace.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="member-name">Name</Label>
            <Input id="member-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Rahul Sharma" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="member-email">Login email</Label>
            <Input id="member-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="rahul@company.com" required />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="member-password">Temporary password</Label>
            <Input id="member-password" type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimum 8 characters" required />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={(value) => setRole(value as TeamMember["role"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["Admin", "Editor", "Contributor", "Viewer"] as TeamMember["role"][]).map((item) => (
                  <SelectItem key={item} value={item}>{item} — {ROLE_CONFIG[item].description}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Assign clients</Label>
          <p className="text-xs text-muted-foreground">Every connected account below is treated as one client.</p>
          <div className="max-h-52 space-y-2 overflow-y-auto rounded-lg border border-border p-2">
            {accounts.map((account) => {
              const checked = selectedAccountIds.includes(account.id);
              const label = `${account.displayName || account.handle}${account.handle && account.displayName !== account.handle ? ` (${account.handle})` : ""}`;
              return (
                <label key={account.id} className="flex cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-muted/40">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => setSelectedAccountIds((ids) => e.target.checked ? [...ids, account.id] : ids.filter((id) => id !== account.id))}
                    className="h-4 w-4 accent-primary"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{label}</div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{account.platform}</div>
                  </div>
                </label>
              );
            })}
            {accounts.length === 0 && <div className="p-4 text-center text-xs text-muted-foreground">No connected accounts yet.</div>}
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving || password.length < 8} className="bg-gradient-to-r from-primary to-accent text-white">
            {saving ? "Creating…" : "Create member"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function InviteDialog({ onClose, onInvited }: { onClose: () => void; onInvited: () => Promise<void> }) {
  const { workspaceId, accessToken } = useSocialFlow();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamMember["role"]>("Editor");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !workspaceId || !accessToken) return;
    const res = await authenticatedFetch("/api/v1/teams/members", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ workspaceId, email, role: role.toLowerCase() }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error("Invitation failed", { description: json.error?.message ?? "Could not invite member" });
      return;
    }
    const inviteUrl = json.data?.inviteUrl as string | undefined;
    if (!json.data?.emailSent && inviteUrl && navigator.clipboard) {
      await navigator.clipboard.writeText(inviteUrl).catch(() => undefined);
    }
    toast.success(`Invitation created for ${email}`, {
      description: json.data?.member
        ? `${email} already had an account and was added as ${role}.`
        : json.data?.emailSent
          ? `Invitation email sent · Role: ${role}`
          : `Email delivery is not configured. The invite link was copied to your clipboard.`,
    });
    setEmail("");
    onClose();
    await onInvited();
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Invite team member</DialogTitle>
        <DialogDescription>
          They&apos;ll receive an email invitation to join your workspace.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="invite-email">Email address</Label>
          <Input
            id="invite-email"
            type="email"
            placeholder="colleague@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Role</Label>
          <Select value={role} onValueChange={(v) => setRole(v as TeamMember["role"])}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(ROLE_CONFIG) as TeamMember["role"][])
                .filter((r) => r !== "Owner")
                .map((r) => (
                  <SelectItem key={r} value={r}>
                    {r} — {ROLE_CONFIG[r].description}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="bg-gradient-to-r from-primary to-accent text-white">
            <Mail className="mr-1.5 h-4 w-4" />
            Send invitation
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
