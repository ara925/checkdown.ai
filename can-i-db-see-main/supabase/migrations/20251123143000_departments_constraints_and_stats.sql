CREATE UNIQUE INDEX IF NOT EXISTS departments_org_name_unique ON public.departments (organization_id, lower(name));

CREATE OR REPLACE FUNCTION public.prevent_department_delete_with_members()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.users WHERE department_id = OLD.id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Cannot delete department with active members';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_department_delete_with_members ON public.departments;
CREATE TRIGGER trg_prevent_department_delete_with_members
BEFORE DELETE ON public.departments
FOR EACH ROW EXECUTE FUNCTION public.prevent_department_delete_with_members();

CREATE OR REPLACE VIEW public.department_stats AS
SELECT d.id, d.name, d.organization_id, COALESCE(COUNT(u.id), 0)::int AS member_count
FROM public.departments d
LEFT JOIN public.users u ON u.department_id = d.id AND u.deleted_at IS NULL
GROUP BY d.id, d.name, d.organization_id;