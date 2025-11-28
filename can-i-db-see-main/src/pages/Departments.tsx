import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, ChevronDown, Search, Plus } from "lucide-react";
import { useSessionSetup } from "@/hooks/useSessionSetup";
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext } from "@/components/ui/pagination";

interface Department {
  id: number;
  name: string;
  memberCount?: number;
}
interface DepartmentStatsRow {
  id: number;
  name: string;
  organization_id: number;
  member_count: number;
}

function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [newDeptName, setNewDeptName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [isPrivileged, setIsPrivileged] = useState(false);
  const [teamId, setTeamId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 9;
  
  useSessionSetup();

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData) {
      const user = JSON.parse(userData);
      setIsPrivileged(user.role === "admin" || user.role === "owner");
    }
    fetchDepartments();
    fetchTeam();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const fetchDepartments = async () => {
    try {
      // Ensure session is set up before querying
      const userData = localStorage.getItem("user");
      if (userData) {
        const user = JSON.parse(userData);
        if (user.organization_id) {
          await supabase.rpc('set_session_variables', {
            _user_id: user.id,
            _organization_id: user.organization_id,
            _department_id: user.department_id || null,
            _role: user.role || 'member'
          });
        }
      }

      const { data, error } = await (supabase as any)
        .from("department_stats")
        .select("*")
        .order("name");

      if (error) throw error;

      const rows = (data || []) as DepartmentStatsRow[];
      setDepartments(
        rows.map((r) => ({ id: r.id, name: r.name, memberCount: r.member_count }))
      );
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTeam = async () => {
    try {
      const userData = localStorage.getItem("user");
      if (!userData) return;
      const user = JSON.parse(userData);
      if (!user.organization_id) return;
      const { data } = await supabase
        .from("teams")
        .select("id")
        .eq("organization_id", user.organization_id)
        .limit(1)
        .maybeSingle();
      if (data?.id) setTeamId(data.id);
    } catch {}
  };

  const logActivity = async (action: string, relatedId?: number) => {
    try {
      const userData = localStorage.getItem("user");
      if (!userData || !teamId) return;
      const user = JSON.parse(userData);
      await supabase.from("activity_logs").insert({
        team_id: teamId,
        user_id: user.id,
        organization_id: user.organization_id,
        action,
        related_entity_type: "department",
        related_entity_id: relatedId ?? null,
      });
    } catch {}
  };

  const handleCreate = async () => {
    const name = newDeptName.trim();
    if (!isPrivileged) {
      toast({ title: "Insufficient permissions", description: "Only admins and owners can create departments.", variant: "destructive" });
      await logActivity("Department create denied - insufficient privileges");
      return;
    }
    if (!name) return;
    if (name.length < 2 || name.length > 60) {
      toast({ title: "Invalid name", description: "Department name must be between 2 and 60 characters.", variant: "destructive" });
      return;
    }
    if (!/^[A-Za-z0-9][A-Za-z0-9 _-]*$/.test(name)) {
      toast({ title: "Invalid characters", description: "Use letters, numbers, spaces, hyphens or underscores.", variant: "destructive" });
      return;
    }
    if (departments.some((d) => d.name.toLowerCase() === name.toLowerCase())) {
      toast({ title: "Duplicate", description: "A department with this name already exists.", variant: "destructive" });
      return;
    }

    try {
      const userData = localStorage.getItem("user");
      if (!userData) {
        throw new Error("No user data found");
      }

      const user = JSON.parse(userData);

      const { error, data } = await supabase
        .from("departments")
        .insert({ name, organization_id: user.organization_id })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Success",
        description: "Department created successfully",
      });

      setNewDeptName("");
      fetchDepartments();
      await logActivity("Department created", data?.id);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      if (!isPrivileged) {
        toast({ title: "Insufficient permissions", description: "Only admins and owners can delete departments.", variant: "destructive" });
        await logActivity("Department delete denied - insufficient privileges", id);
        return;
      }
      const { error } = await supabase
        .from("departments")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Department deleted successfully",
      });

      fetchDepartments();
      await logActivity("Department deleted", id);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const filteredDepartments = departments.filter((dept) =>
    dept.name.toLowerCase().includes(debouncedSearch.toLowerCase())
  );
  const totalPages = Math.max(1, Math.ceil(filteredDepartments.length / pageSize));
  const currentPageItems = filteredDepartments.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Departments</h1>
            <p className="text-muted-foreground mt-1">
              Organize your team into departments for better collaboration
            </p>
          </div>

          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search departments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  New Department Name
                </label>
                <div className="flex gap-3">
                  <Input
                    placeholder="Enter department name"
                    value={newDeptName}
                    onChange={(e) => setNewDeptName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  />
                  <Button
                    onClick={handleCreate}
                    disabled={!isPrivileged || !newDeptName.trim()}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Department
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {currentPageItems.map((dept) => (
            <Card key={dept.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="text-lg font-semibold">{dept.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {dept.memberCount} {dept.memberCount === 1 ? "member" : "members"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="icon" variant="ghost" disabled={!isPrivileged}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={!isPrivileged}
                      onClick={() => handleDelete(dept.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                    <Button size="icon" variant="ghost" disabled={!isPrivileged}>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Pagination className="mt-4">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setPage((p) => Math.max(1, p - 1));
                }}
              />
            </PaginationItem>
            <PaginationItem>
              <span className="px-3 py-2 text-sm text-muted-foreground">{page} / {totalPages}</span>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setPage((p) => Math.min(totalPages, p + 1));
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </DashboardLayout>
  );
}

export default function Departments() {
  return (
    <ProtectedRoute>
      <DepartmentsPage />
    </ProtectedRoute>
  );
}
