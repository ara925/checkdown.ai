import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { ReactNode } from "react";

describe("onboarding flow", () => {
  beforeEach(() => { localStorage.clear(); vi.resetModules(); });

  it("does not auto-open when logged out", async () => {
    const mod = await import("@/lib/onboarding/Onboarding");
    function Wrapper({ children }: { children: ReactNode }) { return <mod.OnboardingProvider>{children}</mod.OnboardingProvider>; }
    const { result } = renderHook(() => mod.useOnboarding(), { wrapper: Wrapper });
    expect(result.current.isOpen).toBe(false);
  });

  it("can start when authenticated and completes", async () => {
    vi.mock("@/lib/auth/useAuth", () => ({ useAuth: () => ({ user: { id: 123, name: "T", email: "t@example.com", role: "user", organization_id: 1, department_id: null }, supabaseUser: null, loading: false, signOut: async () => {} }) }));
    const mod = await import("@/lib/onboarding/Onboarding");
    function Wrapper({ children }: { children: ReactNode }) { return <mod.OnboardingProvider>{children}</mod.OnboardingProvider>; }
    const { result } = renderHook(() => mod.useOnboarding(), { wrapper: Wrapper });
    expect(result.current.canStart).toBe(true);
    act(() => { result.current.start(); });
    expect(result.current.isOpen).toBe(true);
    act(() => { result.current.next(); });
    expect(result.current.stepIndex).toBe(1);
    act(() => { result.current.complete(); });
    const key = `onboarding.completed:v1:${"123"}`;
    expect(localStorage.getItem(key)).toBe("true");
  });
});