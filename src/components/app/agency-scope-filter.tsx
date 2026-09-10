"use client";

import { useEffect, useMemo } from "react";
import { Users, BriefcaseBusiness, Share2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSocialFlow } from "@/lib/store";
import { PLATFORMS } from "@/lib/platforms";

export function AgencyScopeFilter() {
  const {
    workspaceId, workspaces, agencyMembers, agencyClients, agencyMemberId, agencyClientId, agencyPlatformId,
    loadAgencyDirectory, setAgencyMemberFilter, setAgencyClientFilter, setAgencyPlatformFilter,
  } = useSocialFlow();
  const role = workspaces.find((w) => w.id === workspaceId)?.role;
  const canFilter = role === "owner";

  useEffect(() => { if (canFilter) void loadAgencyDirectory(); }, [canFilter, workspaceId, loadAgencyDirectory]);

  const clients = useMemo(() => {
    if (agencyMemberId === "all") return agencyClients;
    return agencyClients.filter((client) => client.members.some((member) => member.userId === agencyMemberId));
  }, [agencyClients, agencyMemberId]);

  if (!canFilter) return null;

  return (
    <div className="hidden items-center gap-2 xl:flex">
      <Select value={agencyMemberId} onValueChange={(value) => void setAgencyMemberFilter(value)}>
        <SelectTrigger className="h-9 w-[170px] bg-card/60 text-xs"><Users className="mr-1.5 h-3.5 w-3.5 text-primary" /><SelectValue placeholder="Team member" /></SelectTrigger>
        <SelectContent><SelectItem value="all">All team members</SelectItem>{agencyMembers.map((member) => <SelectItem key={member.userId} value={member.userId}>{member.name}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={agencyClientId} onValueChange={(value) => void setAgencyClientFilter(value)}>
        <SelectTrigger className="h-9 w-[170px] bg-card/60 text-xs"><BriefcaseBusiness className="mr-1.5 h-3.5 w-3.5 text-primary" /><SelectValue placeholder="Client" /></SelectTrigger>
        <SelectContent><SelectItem value="all">All clients</SelectItem>{clients.map((client) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={agencyPlatformId} onValueChange={(value) => void setAgencyPlatformFilter(value)}>
        <SelectTrigger className="h-9 w-[155px] bg-card/60 text-xs"><Share2 className="mr-1.5 h-3.5 w-3.5 text-primary" /><SelectValue placeholder="Platform" /></SelectTrigger>
        <SelectContent><SelectItem value="all">All platforms</SelectItem>{Object.values(PLATFORMS).map((platform) => <SelectItem key={platform.id} value={platform.id}>{platform.name}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}
