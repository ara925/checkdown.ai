import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { initQueryLogging } from "./queryLogger";

export function QueryLoggingBridge() {
  const qc = useQueryClient();
  useEffect(() => {
    initQueryLogging(qc);
  }, [qc]);
  return null;
}