"use client";

import { useEffect, useState } from "react";
import { WorkflowCard } from "./WorkflowCard";
import { CreateWorkflowDialog } from "./CreateWorkflowDialog";
import { AutomationWorkflow } from "@/lib/workflows/types";
import { Loader2 } from "lucide-react";

export function WorkflowList() {
  const [workflows, setWorkflows] = useState<AutomationWorkflow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWorkflows = async () => {
    try {
      const response = await fetch("/api/workflows");
      const data = await response.json();

      if (data.success) {
        setWorkflows(data.workflows);
      }
    } catch (error) {
      console.error("Failed to fetch workflows:", error);
    } finally {
      setLoading(false);
    }
  };

  const removeWorkflow = (id: string) => {
    setWorkflows((prev) => prev.filter((workflow) => workflow.id !== id));
  };

  useEffect(() => {
    fetchWorkflows();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Financial Automations</h2>
          <p className="text-muted-foreground">
            Create programmable money operations with natural language
          </p>
        </div>
        <CreateWorkflowDialog onWorkflowCreated={fetchWorkflows} />
      </div>

      {workflows.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <p className="text-muted-foreground mb-4">
            No automations yet. Create your first one!
          </p>
          <CreateWorkflowDialog onWorkflowCreated={fetchWorkflows} />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {workflows.map((workflow) => (
            <WorkflowCard
              key={workflow.id}
              workflow={workflow}
              onUpdate={fetchWorkflows}
              onDeleted={removeWorkflow}
            />
          ))}
        </div>
      )}
    </div>
  );
}
